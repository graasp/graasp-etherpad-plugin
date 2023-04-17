import { FastifyInstance, FastifyPluginAsync } from 'fastify';

import { ETHERPAD_API_VERSION, PLUGIN_NAME } from './constants';
import { GraaspEtherpad } from './etherpad';
import { EtherpadPluginOptions } from './types';
import { validatePluginOptions } from './utils';

const publicPlugin: FastifyPluginAsync<EtherpadPluginOptions> = async (fastify, options) => {
  const { public: publicPlugin } = fastify;

  if (!publicPlugin) {
    throw new Error(`${PLUGIN_NAME}: Public plugin was not registered!`);
  }
  const { url: etherpadUrl, publicUrl, apiKey, cookieDomain } = validatePluginOptions(options);

  // connect to etherpad server
  const etherpad = new GraaspEtherpad({
    url: etherpadUrl,
    apiKey,
    apiVersion: ETHERPAD_API_VERSION,
  });

  // hack: only decorate the api instance (for export)
  fastify.decorate('etherpad', { api: etherpad });

  // create a route prefix for etherpad
  await fastify.register(async (fastify: FastifyInstance) => {}, { prefix: 'etherpad' });
};

export default publicPlugin;
