import { FastifyInstance, FastifyPluginAsync } from 'fastify';

import { Item } from '@graasp/sdk';

import { ETHERPAD_API_VERSION } from './constants';
import { ItemMissingExtraError, ItemNotFoundError } from './errors';
import { GraaspEtherpad } from './etherpad';
import { getEtherpadFromItem } from './schemas';
import { EtherpadExtra, EtherpadPluginOptions } from './types';
import { buildPadPath, validatePluginOptions } from './utils';

const publicPlugin: FastifyPluginAsync<EtherpadPluginOptions> = async (fastify, options) => {
  const { public: publicPlugin, taskRunner } = fastify;

  validatePluginOptions(options);
  const { url: etherpadUrl, apiKey } = options;

  if (!publicPlugin) {
    throw new Error('graasp-plugin-etherpad: Public plugin was not registered!');
  }

  const {
    graaspActor,
    items: { taskManager: itemTaskManager },
  } = publicPlugin;

  // connect to etherpad server
  const etherpad = new GraaspEtherpad({
    url: etherpadUrl,
    apiKey,
    apiVersion: ETHERPAD_API_VERSION,
  });

  // create a route prefix for etherpad
  await fastify.register(
    async (fastify: FastifyInstance) => {
      /**
       * Etherpad read-only mode
       * Access should be granted if and only if the item is public
       */
      fastify.get<{ Params: { itemId: string } }>(
        '/read/:itemId',
        { schema: getEtherpadFromItem },
        async (request, reply) => {
          const {
            params: { itemId },
          } = request;

          const getItem = itemTaskManager.createGetPublicItemTask(graaspActor, { itemId });
          const item = (await taskRunner.runSingle(getItem)) as Item<Partial<EtherpadExtra>>;

          if (!item) {
            throw new ItemNotFoundError(itemId);
          }

          if (!item.extra?.etherpad) {
            throw new ItemMissingExtraError(item);
          }

          const { padID } = item.extra.etherpad;

          const { readOnlyID } = await etherpad.getReadOnlyID({ padID });
          return { padUrl: buildPadPath({ padID: readOnlyID }, etherpadUrl) };
        },
      );
    },
    { prefix: 'etherpad' },
  );
};

export default publicPlugin;
