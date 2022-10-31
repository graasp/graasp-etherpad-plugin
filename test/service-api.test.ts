import { StatusCodes } from 'http-status-codes';
import nock from 'nock';

import { HttpMethod, TaskStatus } from '@graasp/sdk';

import { ETHERPAD_API_VERSION } from '../src/constants';
import { BuildAppType, buildApp } from './app';
import { TEST_ENV } from './config';
import { MOCK_ITEM, mockTask } from './fixtures';

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
        payload?: { code: number; message: string; data: { groupID: string } },
      ];
      createGroupPad?: [
        StatusCodes: number,
        payload?: { code: number; message: string; data: null },
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

    const payloadCreate = {
      method: HttpMethod.POST,
      url: '/etherpad/create',
      payload: {
        name: 'test-item-name',
      },
    };

    it('creates a pad successfully', async () => {
      const { app } = instance;
      const reqsParams = setUpApi();
      const res = await app.inject(payloadCreate);

      // check that the groupMapper sent to etherpad is equal to the generated padID
      const [groupMapper, padName, groupID] = await Promise.all(reqsParams);
      expect(groupMapper).toEqual(padName);

      expect(res.statusCode).toEqual(StatusCodes.OK);
      expect(res.json()).toEqual({
        ...MOCK_ITEM,
        name: 'test-item-name',
        extra: { etherpad: { padID: `${groupID}$${padName}`, groupID } },
      });
    });

    it('returns error on etherpad HTTP error', async () => {
      const { app } = instance;
      setUpApi({ createGroupPad: [StatusCodes.GATEWAY_TIMEOUT] });
      const res = await app.inject(payloadCreate);
      expect(res.statusCode).toEqual(StatusCodes.INTERNAL_SERVER_ERROR);
      expect(res.json()).toMatchObject({
        code: 'GPEPERR001',
        message: 'Internal Etherpad server error',
        origin: 'graasp-plugin-etherpad',
      });
    });

    it('returns error on etherpad server error: pad does already exist', async () => {
      const { app } = instance;
      setUpApi({
        createGroupPad: [
          StatusCodes.OK,
          { code: 1, message: 'pad does already exist', data: null },
        ],
      });
      const res = await app.inject(payloadCreate);
      expect(res.statusCode).toEqual(StatusCodes.INTERNAL_SERVER_ERROR);
      expect(res.json()).toMatchObject({
        code: 'GPEPERR001',
        message: 'Internal Etherpad server error',
        origin: 'graasp-plugin-etherpad',
      });
    });

    it('returns error on etherpad server error: groupID does not exist', async () => {
      const { app } = instance;
      setUpApi({
        createGroupPad: [
          StatusCodes.OK,
          { code: 1, message: 'groupID does not exist', data: null },
        ],
      });
      const res = await app.inject(payloadCreate);
      expect(res.statusCode).toEqual(StatusCodes.INTERNAL_SERVER_ERROR);
      expect(res.json()).toMatchObject({
        code: 'GPEPERR001',
        message: 'Internal Etherpad server error',
        origin: 'graasp-plugin-etherpad',
      });
    });

    it('deletes pad on item creation error', async () => {
      const { app, spies } = instance;
      const reqsParams = setUpApi();

      // setup intercept for /deletePad call
      const deletedPadId = new Promise((resolve, reject) => {
        api
          .get('/deletePad')
          .query(true)
          .reply((uri, body) => {
            // retrieve request params
            const url = new URL(uri, TEST_ENV.url);
            const parsed = url.searchParams;

            // check that our server sent the right params
            expect(parsed.get('apikey')).toEqual(TEST_ENV.apiKey);
            expect(parsed.get('padID')).toBeDefined();
            resolve(parsed.get('padID'));

            // emulate etherpad reply
            return [StatusCodes.OK, { code: 0, message: 'ok', data: null }];
          });
      });

      // override item creation: ensure that the task fails
      spies.createItem.mockImplementationOnce((actor, item, extra) => [
        mockTask<unknown>('mock-failing-create-item-task', actor, null, TaskStatus.NEW, () => {
          throw new Error('mock failure');
        }),
      ]);

      const res = await app.inject(payloadCreate);
      expect(res.statusCode).toEqual(StatusCodes.INTERNAL_SERVER_ERROR);
      expect(res.json()).toEqual({
        error: 'Internal Server Error',
        message: 'mock failure',
        statusCode: 500,
      });

      const [_, padName, groupID] = await Promise.all(reqsParams);
      expect(await deletedPadId).toEqual(`${groupID}$${padName}`);
    });
  });
});
