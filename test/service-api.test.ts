import { StatusCodes } from 'http-status-codes';
import nock from 'nock';

import { EtherpadPluginOptions } from '../src';
import { BuildAppType, buildApp } from './app';
import { MOCK_ITEM } from './fixtures';

const TEST_ENV: EtherpadPluginOptions = {
  url: 'http://localhost:9001',
  apiKey: Array.from({ length: 64 }, () => 'a').join(''), // format is /^[a-f\d]{64}$/
};

describe('Service API', () => {
  let instance: BuildAppType;
  let api: nock.Scope;

  beforeAll(async () => {
    instance = await buildApp({ options: TEST_ENV });
    api = nock('http://localhost:9001');
  });

  describe('create a pad', () => {
    beforeEach(() => {
      api
        .get('/createGroupPad')
        .query(true)
        .reply(StatusCodes.OK, { code: 0, message: 'ok', data: null });
    });

    it('creates a pad successfully', async () => {
      const { app } = instance;
      const res = await app.inject({
        method: 'POST',
        url: '/createGroupPad',
        payload: {
          name: 'test-item-name',
        },
      });
      const item = res.json();

      expect(res.statusCode).toEqual(StatusCodes.OK);
      expect(item).toEqual({ ...MOCK_ITEM, name: 'test-item-name' });
    });
  });
});
