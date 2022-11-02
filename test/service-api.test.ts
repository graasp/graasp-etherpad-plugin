import { StatusCodes } from 'http-status-codes';
import nock from 'nock';

import { Author, Group, PadReadOnly, Session } from '@graasp/etherpad-api';
import { HttpMethod, Item, TaskStatus } from '@graasp/sdk';

import { ETHERPAD_API_VERSION } from '../src/constants';
import { BuildAppType, buildApp } from './app';
import { TEST_ENV } from './config';
import {
  MOCK_AUTHOR_ID,
  MOCK_GROUP_ID,
  MOCK_ITEM,
  MOCK_MEMBER,
  MOCK_PAD_ID,
  MOCK_PAD_READ_ONLY_ID,
  MOCK_SESSION_ID,
  mockTask,
} from './fixtures';

type EtherpadApiResponse<T> = [
  statusCode: number,
  payload?: { code: number; message: string; data: T },
];

type Api = {
  createGroupIfNotExistsFor?: EtherpadApiResponse<Group>;
  createGroupPad?: EtherpadApiResponse<null>;
  deletePad?: EtherpadApiResponse<null>;
  getReadOnlyID?: EtherpadApiResponse<PadReadOnly | null>;
  createAuthorIfNotExistsFor?: EtherpadApiResponse<Author>;
  createSession?: EtherpadApiResponse<Session | null>;
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

  afterEach(() => {
    nock.cleanAll();
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

  describe('view a pad', () => {
    const payloadView = (mode: 'read' | 'write') => ({
      method: HttpMethod.GET,
      url: '/etherpad/view/mock-item-id',
      query: {
        mode,
      },
    });

    it('views a pad in read mode successfully', async () => {
      const { app } = instance;
      const reqParams = setUpApi({
        getReadOnlyID: [
          StatusCodes.OK,
          { code: 0, message: 'ok', data: { readOnlyID: MOCK_PAD_READ_ONLY_ID } },
        ],
      });
      const res = await app.inject(payloadView('read'));

      const { getReadOnlyID } = await reqParams;
      expect(getReadOnlyID?.get('padID')).toEqual(MOCK_PAD_ID);
      expect(res.statusCode).toEqual(StatusCodes.OK);
      expect(res.json()).toEqual({
        padUrl: `${TEST_ENV.url}/p/${MOCK_PAD_READ_ONLY_ID}`,
      });
    });

    it('views a pad in write mode successfully', async () => {
      const { app } = instance;
      const reqParams = setUpApi({
        createAuthorIfNotExistsFor: [
          StatusCodes.OK,
          { code: 0, message: 'ok', data: { authorID: MOCK_AUTHOR_ID } },
        ],
        createSession: [
          StatusCodes.OK,
          { code: 0, message: 'ok', data: { sessionID: MOCK_SESSION_ID } },
        ],
      });
      const res = await app.inject(payloadView('write'));

      const { createAuthorIfNotExistsFor, createSession } = await reqParams;
      expect(createAuthorIfNotExistsFor?.get('authorMapper')).toEqual(MOCK_MEMBER.id);
      expect(createAuthorIfNotExistsFor?.get('name')).toEqual(MOCK_MEMBER.name);
      expect(createSession?.get('groupID')).toEqual(MOCK_GROUP_ID);
      expect(createSession?.get('authorID')).toEqual(MOCK_AUTHOR_ID);
      expect(createSession?.get('validUntil')).toBeDefined();
      expect(res.statusCode).toEqual(StatusCodes.OK);
      expect(res.json()).toEqual({
        padUrl: `${TEST_ENV.url}/p/${MOCK_GROUP_ID}$mock-pad-name`,
      });
      const mockSessionIdRegex = MOCK_SESSION_ID.replace('.', '\\.');
      const mockPadIdRegex = MOCK_PAD_ID.replace('.', '\\.').replace('$', '\\$');
      const cookieRegex = new RegExp(
        `^sessionID=${mockSessionIdRegex}.*; Domain=localhost; Path=\/p\/${mockPadIdRegex}; HttpOnly$`,
      );
      expect(res.headers['set-cookie']).toMatch(cookieRegex);
    });

    it('returns error if item is not found', async () => {
      const { app, spies } = instance;
      setUpApi({
        getReadOnlyID: [
          StatusCodes.OK,
          { code: 0, message: 'ok', data: { readOnlyID: MOCK_PAD_READ_ONLY_ID } },
        ],
      });
      spies.getItem.mockImplementationOnce((actor, itemId) =>
        mockTask('mock-empty-task', actor, null as unknown as Item),
      );
      const res = await app.inject(payloadView('read'));

      expect(res.statusCode).toEqual(StatusCodes.NOT_FOUND);
      expect(res.json()).toEqual({
        code: 'GPEPERR002',
        message: 'Item not found',
        origin: 'graasp-plugin-etherpad',
        statusCode: 404,
      });
    });

    it('returns error if item is missing etherpad extra', async () => {
      const { app, spies } = instance;
      setUpApi({
        getReadOnlyID: [
          StatusCodes.OK,
          { code: 0, message: 'ok', data: { readOnlyID: MOCK_PAD_READ_ONLY_ID } },
        ],
      });
      spies.getItem.mockImplementationOnce((actor, itemId) =>
        mockTask('mock-empty-task', actor, { ...MOCK_ITEM, extra: {} }),
      );
      const res = await app.inject(payloadView('read'));

      expect(res.statusCode).toEqual(StatusCodes.INTERNAL_SERVER_ERROR);
      expect(res.json()).toEqual({
        code: 'GPEPERR003',
        message: 'Item missing etherpad extra',
        origin: 'graasp-plugin-etherpad',
        statusCode: 500,
      });
    });

    it('returns error on etherpad HTTP error', async () => {
      const { app } = instance;
      setUpApi({
        getReadOnlyID: [StatusCodes.GATEWAY_TIMEOUT],
      });
      const res = await app.inject({
        method: HttpMethod.GET,
        url: '/etherpad/view/mock-item-id',
        query: {
          mode: 'read',
        },
      });
      expect(res.statusCode).toEqual(StatusCodes.INTERNAL_SERVER_ERROR);
      expect(res.json()).toMatchObject({
        code: 'GPEPERR001',
        message: 'Internal Etherpad server error',
        origin: 'graasp-plugin-etherpad',
      });
    });

    it('returns error on etherpad server error: padID does not exist', async () => {
      const { app } = instance;
      setUpApi({
        getReadOnlyID: [StatusCodes.OK, { code: 1, message: 'padID does not exist', data: null }],
      });
      const res = await app.inject({
        method: HttpMethod.GET,
        url: '/etherpad/view/mock-item-id',
        query: {
          mode: 'read',
        },
      });
      expect(res.statusCode).toEqual(StatusCodes.INTERNAL_SERVER_ERROR);
      expect(res.json()).toMatchObject({
        code: 'GPEPERR001',
        message: 'Internal Etherpad server error',
        origin: 'graasp-plugin-etherpad',
      });
    });
  });
});
