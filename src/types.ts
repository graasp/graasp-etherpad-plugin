import { UnknownExtra } from '@graasp/sdk';

export interface EtherpadPluginOptions {
  /** URL (incl. protocol and port) of the etherpad server */
  url: string;
  /** secret api key to authorize this app against the etherpad server */
  apiKey: string;
}

export interface EtherpadExtra extends UnknownExtra {
  etherpad: {
    padID: string;
    groupID: string;
    padName: string;
  };
}
