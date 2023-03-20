import { EtherpadItemExtra } from '@graasp/sdk';

import { EtherpadPluginOptions } from './types';

export function validatePluginOptions(options: EtherpadPluginOptions) {
  const { url, apiKey } = options;

  if (!url) {
    throw new Error('Etherpad url environment variable is not defined!');
  }

  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    throw new Error('Etherpad url environment variable must contain protocol!');
  }

  const publicUrl = options.publicUrl ?? url;

  const cookieDomain = options.cookieDomain ?? new URL(publicUrl).hostname;

  if (!apiKey) {
    throw new Error('Etherpad API key environment variable is not defined!');
  }

  if (!apiKey.match(/^[a-f\d]{64}$/)) {
    throw new Error('Etherpad API key environment variable format must be /^[a-fd]{64}$/');
  }

  return {
    ...options,
    publicUrl,
    cookieDomain,
  };
}

/**
 * Builds a group pad ID
 * https://etherpad.org/doc/v1.8.18/#index_pad
 */
export function buildPadID({ groupID, padName }: { groupID: string; padName: string }) {
  return `${groupID}$${padName}`;
}

/**
 * Builds an Etherpad path to the given pad
 * https://etherpad.org/doc/v1.8.18/#index_embed-parameters
 * @param baseUrl if specified, will return the absolute url to the pad, otherwise the relative path will be given
 */
export function buildPadPath({ padID }: { padID: string }, baseUrl?: string) {
  const path = `/p/${padID}`;
  return baseUrl ? new URL(path, baseUrl).toString() : path;
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
}): EtherpadItemExtra {
  return {
    etherpad: {
      padID: buildPadID({ groupID, padName }),
      groupID,
    },
  };
}
