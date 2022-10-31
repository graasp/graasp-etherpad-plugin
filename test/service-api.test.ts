import { StatusCodes } from 'http-status-codes';
import nock from 'nock';

import { ETHERPAD_API_VERSION } from '../src/constants';
import { BuildAppType, buildApp } from './app';
import { TEST_ENV } from './config';
import { MOCK_ITEM } from './fixtures';

describe('Service API', () => {
  let instance: BuildAppType;
  let api: nock.Scope;

  beforeAll(async () => {
    instance = await buildApp({ options: TEST_ENV });
    api = nock(`http://localhost:9001/api/${ETHERPAD_API_VERSION}/`);
  });

  describe('create a pad', () => {
    /**
     * Helper to setup an emulator for the etherpad server
     * @param replies Overrides for the emulated response from etherpad
     */
    function setUpApi(replies?: {
      createGroupIfNotExists?: [
        statusCode: number,
        payload: { code: number; message: string; data: { groupID: string } },
      ];
      createGroupPad?: [
        StatusCodes: number,
        payload: { code: number; message: string; data: null },
      ];
    }) {
      const groupID = replies?.createGroupIfNotExists?.[1]?.data ?? 'g.s8oes9dhwrvt0zif';

      const groupMapper = new Promise((resolve, reject) => {
        api
          .get('/createGroupIfNotExistsFor')
          .query(true)
          .reply((uri, body) => {
            // retrieve request params
            const url = new URL(uri, TEST_ENV.url);
            const parsed = url.searchParams;

            // check that our server sent the right params
            expect(parsed.get('apikey')).toEqual(TEST_ENV.apiKey);
            expect(parsed.get('groupMapper')).toBeDefined();
            resolve(parsed.get('groupMapper'));

            // emulate etherpad reply
            return (
              replies?.createGroupIfNotExists ?? [
                StatusCodes.OK,
                {
                  code: 0,
                  message: 'ok',
                  data: { groupID },
                },
              ]
            );
          });
      });

      const padName = new Promise((resolve, reject) => {
        api
          .get('/createGroupPad')
          .query(true)
          .reply((uri, body) => {
            // retrieve request params
            const url = new URL(uri, TEST_ENV.url);
            const parsed = url.searchParams;

            // check that our server sent the right params
            expect(parsed.get('apikey')).toEqual(TEST_ENV.apiKey);
            expect(parsed.get('groupID')).toEqual(groupID);
            expect(parsed.get('padName')).toBeDefined();
            resolve(parsed.get('padName'));

            // emulate etherpad reply
            return (
              replies?.createGroupPad ?? [StatusCodes.OK, { code: 0, message: 'ok', data: null }]
            );
          });
      });

      const promisifiedGroupID = Promise.resolve(groupID);
      return [groupMapper, padName, promisifiedGroupID];
    }

    it('creates a pad successfully', async () => {
      const { app } = instance;
      const reqsParams = setUpApi();
      const res = await app.inject({
        method: 'POST',
        url: '/etherpad/create',
        payload: {
          name: 'test-item-name',
        },
      });
      const item = res.json();

      // check that the groupMapper sent to etherpad is equal to the generated padID
      const [groupMapper, padName, groupID] = await Promise.all(reqsParams);
      expect(groupMapper).toEqual(padName);

      expect(res.statusCode).toEqual(StatusCodes.OK);
      expect(item).toEqual({
        ...MOCK_ITEM,
        name: 'test-item-name',
        extra: { etherpad: { padID: `${groupID}$${padName}`, groupID } },
      });
    });
  });
});
