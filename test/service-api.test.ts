import { StatusCodes } from 'http-status-codes';
import nock from 'nock';

import { HttpMethod, TaskStatus } from '@graasp/sdk';

import { ETHERPAD_API_VERSION } from '../src/constants';
import { BuildAppType, buildApp } from './app';
import { TEST_ENV } from './config';
import { MOCK_ITEM, mockTask } from './fixtures';

const MOCK_GROUP_ID = 'g.s8oes9dhwrvt0zif';

type EtherpadApiResponse<T> = [
  statusCode: number,
  payload?: { code: number; message: string; data: T },
];

type Api = {
  createGroupIfNotExistsFor?: EtherpadApiResponse<{ groupID: string }>;
  createGroupPad?: EtherpadApiResponse<null>;
  deletePad?: EtherpadApiResponse<null>;
};

/**
 * Helper to setup an emulator for the etherpad server
 * @param replies Enables which endpoints should be emulated with the given responses
 */
function setUpApi(replies: Api): Promise<{ [Endpoint in keyof Api]: URLSearchParams }> {
  const api = nock(`${TEST_ENV.url}/api/${ETHERPAD_API_VERSION}/`);

  const endpointAndParams = Object.entries(replies).map(
    ([endpoint, response]) =>
      new Promise<[endpoint: string, params: URLSearchParams]>((resolve, reject) => {
        api
          .get(`/${endpoint}`)
          .query(true)
          .reply((uri, body) => {
            const url = new URL(uri, TEST_ENV.url);
            // check that API key is always sent
            expect(url.searchParams.get('apikey')).toEqual(TEST_ENV.apiKey);
            resolve([endpoint, url.searchParams]);
            return response;
          });
      }),
  );

  return Promise.all(endpointAndParams).then(Object.fromEntries);
}

describe('Service API', () => {
  let instance: BuildAppType;

  beforeAll(async () => {
    instance = await buildApp({ options: TEST_ENV });
  });

  describe('create a pad', () => {
    const payloadCreate = {
      method: HttpMethod.POST,
      url: '/etherpad/create',
      payload: {
        name: 'test-item-name',
      },
    };

    it('creates a pad successfully', async () => {
      const { app } = instance;
      const reqsParams = setUpApi({
        createGroupIfNotExistsFor: [
          StatusCodes.OK,
          { code: 0, message: 'ok', data: { groupID: MOCK_GROUP_ID } },
        ],
        createGroupPad: [StatusCodes.OK, { code: 0, message: 'ok', data: null }],
      });
      const res = await app.inject(payloadCreate);

      const { createGroupIfNotExistsFor, createGroupPad } = await reqsParams;
      expect(createGroupPad?.get('groupID')).toEqual(MOCK_GROUP_ID);
      // groupMapper sent to etherpad is equal to the generated padID
      expect(createGroupIfNotExistsFor?.get('groupMapper')).toEqual(createGroupPad?.get('padName'));

      expect(res.statusCode).toEqual(StatusCodes.OK);
      expect(res.json()).toEqual({
        ...MOCK_ITEM,
        name: 'test-item-name',
        extra: {
          etherpad: {
            padID: `${MOCK_GROUP_ID}$${createGroupPad?.get('padName')}`,
            groupID: MOCK_GROUP_ID,
          },
        },
      });
    });

    it('returns error on etherpad HTTP error', async () => {
      const { app } = instance;
      setUpApi({
        createGroupIfNotExistsFor: [
          StatusCodes.OK,
          { code: 0, message: 'ok', data: { groupID: MOCK_GROUP_ID } },
        ],
        createGroupPad: [StatusCodes.GATEWAY_TIMEOUT],
      });
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
        createGroupIfNotExistsFor: [
          StatusCodes.OK,
          { code: 0, message: 'ok', data: { groupID: MOCK_GROUP_ID } },
        ],
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
        createGroupIfNotExistsFor: [
          StatusCodes.OK,
          { code: 0, message: 'ok', data: { groupID: MOCK_GROUP_ID } },
        ],
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
      const reqsParams = setUpApi({
        createGroupIfNotExistsFor: [
          StatusCodes.OK,
          { code: 0, message: 'ok', data: { groupID: MOCK_GROUP_ID } },
        ],
        createGroupPad: [StatusCodes.OK, { code: 0, message: 'ok', data: null }],
        deletePad: [StatusCodes.OK, { code: 0, message: 'ok', data: null }],
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

      const { createGroupPad, deletePad } = await reqsParams;
      expect(deletePad?.get('padID')).toEqual(`${MOCK_GROUP_ID}$${createGroupPad?.get('padName')}`);
    });
  });

  describe('view a pad', () => {});
});
