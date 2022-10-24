import { EtherpadExtra, EtherpadPluginOptions } from './types';

export function validatePluginOptions(options: EtherpadPluginOptions) {
  const { url, apiKey } = options;

  if (!url) {
    throw new Error('Etherpad url environment variable is not defined!');
  }

  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    throw new Error('Etherpad url environment variable must contain protocol!');
  }

  if (!apiKey) {
    throw new Error('Etherpad API key environment variable is not defined!');
  }
}

/**
 * Wraps an object's async method calls with error handling supplied by a transformer
 * @param object
 */
export function wrapErrors<T extends Object>(object: T, transformer: (e: unknown) => Error): T {
  const generator = new Proxy(object, {
    get: (target: Object, prop: keyof Object) => {
      if (typeof target[prop] === 'function') {
        return new Proxy(target[prop], {
          apply: async (...args) => {
            try {
              return await Reflect.apply(...args);
            } catch (error) {
              throw transformer(error);
            }
          },
        });
      } else {
        return target[prop];
      }
    },
  }) as T;

  // Object.assign will trigger the property getters from the generator
  return Object.assign({}, generator) as T;
}

/**
 * Builds a group pad ID
 * https://etherpad.org/doc/v1.8.18/#index_pad
 */
export function buildPadID({ groupID, padName }: { groupID: string; padName: string }) {
  return `${groupID}$${padName}`;
}

/**
 * Builds an Etherpad extra for Item
 */
export function buildEtherpadExtra({
  groupID,
  padName,
}: {
  groupID: string;
  padName: string;
}): EtherpadExtra {
  return {
    etherpad: {
      padID: buildPadID({ groupID, padName }),
      // these properties are duplicated to later create associated sessions
      groupID,
      padName,
    },
  };
}
