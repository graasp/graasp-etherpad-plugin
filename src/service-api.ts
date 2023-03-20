import { DateTime } from 'luxon';
import { v4 } from 'uuid';

import { FastifyInstance, FastifyPluginAsync } from 'fastify';

import {
  EtherpadItemExtra,
  Item,
  ItemType,
  PermissionLevel,
  PermissionLevelCompare,
} from '@graasp/sdk';

import { ETHERPAD_API_VERSION, MAX_SESSIONS_IN_COOKIE, PLUGIN_NAME } from './constants';
import { AccessForbiddenError, ItemMissingExtraError, ItemNotFoundError } from './errors';
import { GraaspEtherpad } from './etherpad';
import { createEtherpad, getEtherpadFromItem } from './schemas';
import { EtherpadPluginOptions } from './types';
import { buildEtherpadExtra, buildPadID, buildPadPath, validatePluginOptions } from './utils';

const plugin: FastifyPluginAsync<EtherpadPluginOptions> = async (fastify, options) => {
  // get services from server instance
  const {
    items: { taskManager: itemTaskManager },
    itemMemberships: { taskManager: itemMembershipTaskManager },
    taskRunner,
    log,
  } = fastify;

  const { url: etherpadUrl, publicUrl, apiKey, cookieDomain } = validatePluginOptions(options);

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
            const padID = buildPadID({ groupID, padName });
            etherpad
              .deletePad({ padID })
              .catch((e) =>
                log.error(`${PLUGIN_NAME}: failed to delete orphan etherpad ${padID}`, e),
              );
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
          const item = (await taskRunner.runSingle(getItem)) as Item<Partial<EtherpadItemExtra>>;

          if (!item) {
            throw new ItemNotFoundError(itemId);
          }

          if (!item.extra?.etherpad) {
            throw new ItemMissingExtraError(item);
          }

          // 1. first check at least read access
          const getMembership = itemMembershipTaskManager.createGetMemberItemMembershipTask(
            member,
            {
              item,
              validatePermission: PermissionLevel.Read,
            },
          );

          let membership;
          try {
            membership = await taskRunner.runSingle(getMembership);
            if (!membership) {
              throw new Error(); // will be caught by handler below to throw same exception
            }
          } catch (error) {
            throw new AccessForbiddenError(error);
          }

          // 2. if mode was write, check that permission is at least write
          // otherwise automatically fallback to read
          const checkedMode =
            mode === 'write' &&
            PermissionLevelCompare.gte(membership.permission, PermissionLevel.Write)
              ? 'write'
              : 'read';

          const { padID, groupID } = item.extra.etherpad;

          let padUrl;
          switch (checkedMode) {
            case 'read': {
              const { readOnlyID } = await etherpad.getReadOnlyID({ padID });
              padUrl = buildPadPath({ padID: readOnlyID }, publicUrl);
              break;
            }
            case 'write': {
              padUrl = buildPadPath({ padID }, publicUrl);
              break;
            }
          }

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
            validUntil: expiration.toUnixInteger(),
          });

          // get available sessions for user
          const sessions = (await etherpad.listSessionsOfAuthor({ authorID })) ?? {};

          // split valid from expired cookies
          const now = DateTime.now();
          const { valid, expired } = Object.entries(sessions).reduce(
            ({ valid, expired }, [id, { validUntil }]) => {
              const isExpired = DateTime.fromSeconds(validUntil) <= now;
              isExpired ? expired.add(id) : valid.add(id);
              return { valid, expired };
            },
            {
              valid: new Set<string>(),
              expired: new Set<string>(),
            },
          );
          // sanity check, add the new sessionID (should already be part of the set)
          valid.add(sessionID);

          // in practice, there is (probably) a limit of 1024B per cookie value
          // https://chromestatus.com/feature/4946713618939904
          // so we can only store up to limit / (size of sessionID string + ",")
          // assuming that no other cookies are set on the etherpad domain
          // to err on the cautious side, we invalidate the oldest cookies in this case
          if (valid.size > MAX_SESSIONS_IN_COOKIE) {
            const sortedRecent = Array.from(valid).sort((a, b) => {
              // return inversed for most recent
              const timeA = DateTime.fromSeconds(sessions[a].validUntil);
              const timeB = DateTime.fromSeconds(sessions[b].validUntil);
              if (timeA < timeB) {
                return 1;
              }
              if (timeA > timeB) {
                return -1;
              }
              return 0;
            });

            const toInvalidate = sortedRecent.slice(MAX_SESSIONS_IN_COOKIE);

            // mutate valid and expired sets in place
            toInvalidate.forEach((id) => {
              valid.delete(id);
              expired.add(id);
            });
          }

          // delete expired cookies asynchronously in the background, accept failures by catching
          expired.forEach((sessionID) => {
            etherpad
              .deleteSession({ sessionID })
              .catch((e) =>
                log.error(
                  `${PLUGIN_NAME}: failed to delete etherpad session ${sessionID}`,
                  sessions[sessionID],
                  e,
                ),
              );
          });

          // set cookie with all valid cookies (users should be able to access multiple etherpads simultaneously)
          const cookieValue = Array.from(valid).join(',');
          reply.setCookie('sessionID', cookieValue, {
            domain: cookieDomain,
            path: '/',
            expires: expiration.toJSDate(),
            signed: false,
            httpOnly: false, // cookie must be available to Etherpad's JS code for it to work!
          });

          return { padUrl };
        },
      );

      /**
       * Delete etherpad on item delete
       */
      const deleteItemTaskName = itemTaskManager.getDeleteTaskName();
      taskRunner.setTaskPreHookHandler<Item<EtherpadItemExtra>>(
        deleteItemTaskName,
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

          await etherpad.deletePad({ padID });
        },
      );

      /**
       * Copy etherpad on item copy
       */
      const copyItemTaskName = itemTaskManager.getCopyTaskName();
      taskRunner.setTaskPreHookHandler<Item<EtherpadItemExtra>>(
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

          const { groupID, padName } = await createPad({ action: 'copy', sourceID: padID });
          // assign pad copy to new item's extra
          item.extra = buildEtherpadExtra({ groupID, padName });
        },
      );
    },
    { prefix: 'etherpad' },
  );
};

export default plugin;
