import { v4 } from 'uuid';

import { FastifyInstance, FastifyPluginAsync } from 'fastify';

import Etherpad from '@graasp/etherpad-api';
import { Actor, Item, ItemType } from '@graasp/sdk';

import { EtherpadServerError } from './errors';
import { createEtherpad } from './schemas';
import { EtherpadExtra, EtherpadPluginOptions } from './types';
import { buildEtherpadExtra, buildPadID, validatePluginOptions, wrapErrors } from './utils';

const plugin: FastifyPluginAsync<EtherpadPluginOptions> = async (fastify, options) => {
  // get services from server instance
  const {
    items: { taskManager: itemTaskManager },
    itemMemberships: { taskManager: itemMembershipTaskManager },
    taskRunner,
  } = fastify;

  validatePluginOptions(options);
  const { url, apiKey } = options;

  // connect to etherpad server
  const etherpad = wrapErrors(
    new Etherpad({
      url,
      apiKey,
    }),
    (error) => new EtherpadServerError(error),
  );

  /**
   * Helper method to create a pad
   */
  async function createPad(
    member: Actor,
    options: { action: 'create' } | { action: 'copy'; sourceID: string },
  ) {
    // new pad name
    const padName = v4();

    // map graasp user to etherpad group (holds only this pad)
    const { groupID } = await etherpad.createGroupIfNotExistsFor({
      groupMapper: `${member.id}.${padName}`,
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
  fastify.register(
    (fastify: FastifyInstance) => {
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

          const { groupID, padName } = await createPad(member, { action: 'create' });

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
          return taskRunner.runSingleSequence(createItem);
        },
      );

      /**
       * Etherpad read
       */

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

          await createPad(actor, { action: 'copy', sourceID: padID });
        },
      );
    },
    { prefix: 'etherpad' },
  );
};

export default plugin;
