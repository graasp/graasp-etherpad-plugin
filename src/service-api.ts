import { DateTime } from 'luxon';
import { v4 } from 'uuid';

import { FastifyInstance, FastifyPluginAsync } from 'fastify';

import { Item, ItemType, PermissionLevel } from '@graasp/sdk';

import { ETHERPAD_API_VERSION } from './constants';
import { AccessForbiddenError, ItemMissingExtraError, ItemNotFoundError } from './errors';
import { GraaspEtherpad } from './etherpad';
import { createEtherpad, getEtherpadFromItem } from './schemas';
import { EtherpadExtra, EtherpadPluginOptions } from './types';
import { buildEtherpadExtra, buildPadID, buildPadPath, validatePluginOptions } from './utils';

const plugin: FastifyPluginAsync<EtherpadPluginOptions> = async (fastify, options) => {
  // get services from server instance
  const {
    items: { taskManager: itemTaskManager },
    itemMemberships: { taskManager: itemMembershipTaskManager },
    taskRunner,
  } = fastify;

  const { url: etherpadUrl, publicUrl, apiKey } = validatePluginOptions(options);
  const domain = new URL(publicUrl).hostname;

  // connect to etherpad server
  const etherpad = new GraaspEtherpad({
    url: etherpadUrl,
    apiKey,
    apiVersion: ETHERPAD_API_VERSION,
  });

  /**
   * Helper method to create a pad
   */
  async function createPad(options: { action: 'create' } | { action: 'copy'; sourceID: string }) {
    // new pad name
    const padName = v4();

    // map pad to a group containing only itself
    const { groupID } = await etherpad.createGroupIfNotExistsFor({
      groupMapper: `${padName}`,
    });

    switch (options.action) {
      case 'create':
        await etherpad.createGroupPad({ groupID, padName });
        break;
      case 'copy':
        const { sourceID } = options;
        await etherpad.copyPad({ sourceID, destinationID: buildPadID({ groupID, padName }) });
        break;
    }

    return { groupID, padName };
  }

  // create a route prefix for etherpad
  await fastify.register(
    async (fastify: FastifyInstance) => {
      /**
       * Etherpad creation
       */
      fastify.post<{ Querystring: { parentId?: string }; Body: { name: string } }>(
        '/create',
        { schema: createEtherpad },
        async (request) => {
          const {
            member,
            query: { parentId },
            body: { name },
          } = request;

          const { groupID, padName } = await createPad({ action: 'create' });

          const partialItem = {
            name,
            type: ItemType.ETHERPAD,
            extra: buildEtherpadExtra({ groupID, padName }),
          };

          const createItem = itemTaskManager.createCreateTaskSequence(
            member,
            partialItem,
            parentId,
          );
          try {
            return await taskRunner.runSingleSequence(createItem);
          } catch (error) {
            // create item failed, delete created pad
            etherpad.deletePad({ padID: buildPadID({ groupID, padName }) });
            throw error;
          }
        },
      );

      /**
       * Etherpad view in given mode (read or write)
       * Access should be granted if and only if the user has at least write
       * access to the item. If user only has read permission, then the pad
       * should be displayed in read-only mode
       */
      fastify.get<{ Params: { itemId: string }; Querystring: { mode?: 'read' | 'write' } }>(
        '/view/:itemId',
        { schema: getEtherpadFromItem },
        async (request, reply) => {
          const {
            member,
            params: { itemId },
            query: { mode = 'read' },
          } = request;

          const getItem = itemTaskManager.createGetTask(member, itemId);
          const item = (await taskRunner.runSingle(getItem)) as Item<Partial<EtherpadExtra>>;

          if (!item) {
            throw new ItemNotFoundError(itemId);
          }

          if (!item.extra?.etherpad) {
            throw new ItemMissingExtraError(item);
          }

          const getMembership = itemMembershipTaskManager.createGetMemberItemMembershipTask(
            member,
            {
              item,
              validatePermission: mode === 'write' ? PermissionLevel.Write : PermissionLevel.Read,
            },
          );
          try {
            await taskRunner.runSingle(getMembership);
          } catch (error) {
            throw new AccessForbiddenError(error);
          }

          const { padID, groupID } = item.extra.etherpad;

          switch (mode) {
            case 'read': {
              const { readOnlyID } = await etherpad.getReadOnlyID({ padID });
              return { padUrl: buildPadPath({ padID: readOnlyID }, publicUrl) };
            }
            case 'write': {
              // map user to etherpad author
              const { authorID } = await etherpad.createAuthorIfNotExistsFor({
                authorMapper: member.id,
                name: member.name,
              });

              // start session for user on the group
              const expiration = DateTime.now().plus({ days: 1 });
              const { sessionID } = await etherpad.createSession({
                authorID,
                groupID,
                validUntil: expiration.toSeconds(),
              });

              // set cookie
              reply.setCookie('sessionID', sessionID, {
                domain,
                path: '/',
                signed: false,
                httpOnly: false, // cookie must be available to Etherpad's JS code for it to work!
              });

              return { padUrl: buildPadPath({ padID }, publicUrl) };
            }
          }
        },
      );

      /**
       * Delete etherpad on item delete
       */
      const deleteItemTaskName = itemTaskManager.getDeleteTaskName();
      taskRunner.setTaskPostHookHandler<Item<EtherpadExtra>>(
        deleteItemTaskName,
        async (item, actor) => {
          if (item.type !== ItemType.ETHERPAD) {
            return;
          }

          const { padID } = item.extra.etherpad;
          etherpad.deletePad({ padID });
        },
      );

      /**
       * Copy etherpad on item copy
       */
      const copyItemTaskName = itemTaskManager.getCopyTaskName();
      taskRunner.setTaskPreHookHandler<Item<EtherpadExtra>>(
        copyItemTaskName,
        async (item, actor) => {
          if (item.type !== ItemType.ETHERPAD) {
            return;
          }

          const padID = item?.extra?.etherpad?.padID;
          if (!padID) {
            throw new Error(
              `Illegal state: property padID is missing in etherpad extra for item ${item.id}`,
            );
          }

          await createPad({ action: 'copy', sourceID: padID });
        },
      );
    },
    { prefix: 'etherpad' },
  );
};

export default plugin;
