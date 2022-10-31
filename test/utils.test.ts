import { EtherpadPluginOptions } from '../src';
import { buildEtherpadExtra, buildPadID, buildPadPath, validatePluginOptions } from '../src/utils';
import { TEST_ENV } from './config';

describe('Utils', () => {
  describe('validate plugin options', () => {
    const correctOptions = { url: TEST_ENV.url, apiKey: TEST_ENV.apiKey };
    it('accepts correct options', () => {
      expect(() => validatePluginOptions(correctOptions)).not.toThrow();
    });

    it('throws if url is not defined', () => {
      const undefinedUrl = {
        ...correctOptions,
        url: undefined, // on purpose: this may happen if core does not use strict nullables
      } as unknown as EtherpadPluginOptions;
      expect(() => validatePluginOptions(undefinedUrl)).toThrowError(
        'Etherpad url environment variable is not defined!',
      );
    });

    it('throws if url does not start with protocol', () => {
      expect(() => validatePluginOptions({ ...correctOptions, url: 'localhost' })).toThrowError(
        'Etherpad url environment variable must contain protocol!',
      );
    });

    it('throws if api key is not defined', () => {
      const undefinedApiKey = {
        ...correctOptions,
        apiKey: undefined, // on purpose: this may happen if core does not use strict nullables
      } as unknown as EtherpadPluginOptions;
      expect(() => validatePluginOptions(undefinedApiKey)).toThrowError(
        'Etherpad API key environment variable is not defined!',
      );
    });

    it('throws if api key format is invalid', () => {
      expect(() => validatePluginOptions({ ...correctOptions, apiKey: 'invalidKey' })).toThrowError(
        'Etherpad API key environment variable format must be /^[a-fd]{64}$/',
      );
    });
  });

  it('builds correct pad ID', () => {
    expect(buildPadID({ groupID: 'g.s8oes9dhwrvt0zif', padName: 'test' })).toEqual(
      'g.s8oes9dhwrvt0zif$test',
    );
  });

  it('builds correct relative pad path', () => {
    expect(buildPadPath({ padID: 'g.s8oes9dhwrvt0zif$test' })).toEqual(
      '/p/g.s8oes9dhwrvt0zif$test',
    );
  });

  it('builds correct absolute pad url', () => {
    expect(buildPadPath({ padID: 'g.s8oes9dhwrvt0zif$test' }, 'http://localhost:9001')).toEqual(
      'http://localhost:9001/p/g.s8oes9dhwrvt0zif$test',
    );
  });

  it('builds correct etherpad item extra', () => {
    expect(buildEtherpadExtra({ groupID: 'g.s8oes9dhwrvt0zif', padName: 'test' })).toEqual({
      etherpad: {
        padID: 'g.s8oes9dhwrvt0zif$test',
        groupID: 'g.s8oes9dhwrvt0zif',
      },
    });
  });
});
