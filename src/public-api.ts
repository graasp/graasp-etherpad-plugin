import { FastifyInstance, FastifyPluginAsync } from 'fastify';

import { PLUGIN_NAME } from './constants';
import { EtherpadPluginOptions } from './types';

const publicPlugin: FastifyPluginAsync<EtherpadPluginOptions> = async (fastify, options) => {
  const { public: publicPlugin } = fastify;

  if (!publicPlugin) {
    throw new Error(`${PLUGIN_NAME}: Public plugin was not registered!`);
  }

  // create a route prefix for etherpad
  await fastify.register(async (fastify: FastifyInstance) => {}, { prefix: 'etherpad' });
};

export default publicPlugin;
