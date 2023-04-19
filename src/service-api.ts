import { v4 } from 'uuid';

import { FastifyInstance, FastifyPluginAsync } from 'fastify';

import { EtherpadItemExtra, Item } from '@graasp/sdk';

import { ETHERPAD_API_VERSION } from './constants';
import { GraaspEtherpad } from './etherpad';
import { createEtherpad, getEtherpadFromItem } from './schemas';
import { EtherpadItemService } from './service';
import { EtherpadPluginOptions } from './types';
import { validatePluginOptions } from './utils';

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

  const etherpadItemService = new EtherpadItemService(
    etherpad,
    () => v4(),
    publicUrl,
    cookieDomain,
    itemTaskManager,
    itemMembershipTaskManager,
    taskRunner,
    log,
  );
  fastify.decorate('etherpad', etherpadItemService);

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

          return await etherpadItemService.createEtherpadItem(name, member, parentId);
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

          const { cookie, padUrl } = await etherpadItemService.getEtherpadFromItem(
            itemId,
            member,
            mode,
          );

          reply.setCookie(cookie.name, cookie.value, cookie.options);
          return { padUrl };
        },
      );

      /**
       * Delete etherpad on item delete
       */
      const deleteItemTaskName = itemTaskManager.getDeleteTaskName();
      taskRunner.setTaskPreHookHandler<Item<EtherpadItemExtra>>(deleteItemTaskName, (item, actor) =>
        etherpadItemService.deleteEtherpadForItem(item, actor),
      );

      /**
       * Copy etherpad on item copy
       */
      const copyItemTaskName = itemTaskManager.getCopyTaskName();
      taskRunner.setTaskPreHookHandler<Item<EtherpadItemExtra>>(copyItemTaskName, (item, actor) =>
        etherpadItemService.copyEtherpadInMutableItem(item, actor),
      );
    },
    { prefix: 'etherpad' },
  );
};

export default plugin;
