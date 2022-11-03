import { StatusCodes } from 'http-status-codes';
import nock from 'nock';

import {
  Actor,
  HttpMethod,
  Item,
  PostHookHandlerType,
  PreHookHandlerType,
  TaskStatus,
} from '@graasp/sdk';

import plugin from '../src/service-api';
import { setUpApi } from './api';
import { BuildAppType, buildApp } from './app';
import { TEST_ENV } from './config';
import {
  COPY_ITEM_TASK_NAME,
  DELETE_ITEM_TASK_NAME,
  MOCK_AUTHOR_ID,
  MOCK_GROUP_ID,
  MOCK_ITEM,
  MOCK_MEMBER,
  MOCK_MEMBERSHIP,
  MOCK_PAD_ID,
  MOCK_PAD_READ_ONLY_ID,
  MOCK_SESSION_ID,
  MODES,
  mockTask,
} from './fixtures';

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

    it.each(['pad does already exist', 'groupID does not exist'])(
      'returns error on etherpad server error: %p',
      async (error) => {
        const { app } = instance;
        setUpApi({
          createGroupIfNotExistsFor: [
            StatusCodes.OK,
            { code: 0, message: 'ok', data: { groupID: MOCK_GROUP_ID } },
          ],
          createGroupPad: [StatusCodes.OK, { code: 1, message: error, data: null }],
        });
        const res = await app.inject(payloadCreate);

        expect(res.statusCode).toEqual(StatusCodes.INTERNAL_SERVER_ERROR);
        expect(res.json()).toMatchObject({
          code: 'GPEPERR001',
          message: 'Internal Etherpad server error',
          origin: 'graasp-plugin-etherpad',
        });
      },
    );

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
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
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

    it.each(MODES)('returns error if item is not found (%p)', async (mode) => {
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
      const res = await app.inject(payloadView(mode));

      expect(res.statusCode).toEqual(StatusCodes.NOT_FOUND);
      expect(res.json()).toEqual({
        code: 'GPEPERR002',
        message: 'Item not found',
        origin: 'graasp-plugin-etherpad',
        statusCode: StatusCodes.NOT_FOUND,
      });
    });

    it.each(MODES)('returns error if item is missing etherpad extra (%p)', async (mode) => {
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
      const res = await app.inject(payloadView(mode));

      expect(res.statusCode).toEqual(StatusCodes.INTERNAL_SERVER_ERROR);
      expect(res.json()).toEqual({
        code: 'GPEPERR003',
        message: 'Item missing etherpad extra',
        origin: 'graasp-plugin-etherpad',
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      });
    });

    it.each(MODES)('returns error if member does not have %p permission', async (mode) => {
      const { app, spies } = instance;
      setUpApi({
        getReadOnlyID: [
          StatusCodes.OK,
          { code: 0, message: 'ok', data: { readOnlyID: MOCK_PAD_READ_ONLY_ID } },
        ],
      });
      spies.getMembership.mockImplementationOnce((actor) =>
        mockTask('mock-failing-task', actor, MOCK_MEMBERSHIP, TaskStatus.NEW, () => {
          throw new Error('Mock permission denied');
        }),
      );
      const res = await app.inject(payloadView(mode));

      expect(res.statusCode).toEqual(StatusCodes.FORBIDDEN);
      expect(res.json()).toEqual({
        code: 'GPEPERR004',
        message: 'Access forbidden to this item',
        origin: 'graasp-plugin-etherpad',
        statusCode: StatusCodes.FORBIDDEN,
      });
    });

    it('returns error on etherpad HTTP error', async () => {
      const { app } = instance;
      setUpApi({
        getReadOnlyID: [StatusCodes.GATEWAY_TIMEOUT],
      });
      const res = await app.inject(payloadView('read'));
      expect(res.statusCode).toEqual(StatusCodes.INTERNAL_SERVER_ERROR);
      expect(res.json()).toMatchObject({
        code: 'GPEPERR001',
        message: 'Internal Etherpad server error',
        origin: 'graasp-plugin-etherpad',
      });
    });

    it('returns error on etherpad server error: "padID does not exist"', async () => {
      const { app } = instance;
      setUpApi({
        getReadOnlyID: [StatusCodes.OK, { code: 1, message: 'padID does not exist', data: null }],
      });
      const res = await app.inject(payloadView('read'));
      expect(res.statusCode).toEqual(StatusCodes.INTERNAL_SERVER_ERROR);
      expect(res.json()).toMatchObject({
        code: 'GPEPERR001',
        message: 'Internal Etherpad server error',
        origin: 'graasp-plugin-etherpad',
      });
    });

    it.each(["groupID doesn't exist", "authorID doesn't exist", 'validUntil is in the past'])(
      'returns error on etherpad server error: %p',
      async (error) => {
        const { app } = instance;
        setUpApi({
          createAuthorIfNotExistsFor: [
            StatusCodes.OK,
            { code: 0, message: 'ok', data: { authorID: MOCK_AUTHOR_ID } },
          ],
          createSession: [StatusCodes.OK, { code: 1, message: error, data: null }],
        });
        const res = await app.inject(payloadView('write'));
        expect(res.statusCode).toEqual(StatusCodes.INTERNAL_SERVER_ERROR);
        expect(res.json()).toMatchObject({
          code: 'GPEPERR001',
          message: 'Internal Etherpad server error',
          origin: 'graasp-plugin-etherpad',
        });
      },
    );
  });

  describe('hook handlers', () => {
    it('deletes pad when item is deleted', async () => {
      const { app, spies } = await buildApp();
      const reqsParams = setUpApi({
        deletePad: [StatusCodes.OK, { code: 0, message: 'ok', data: null }],
      });
      const deleteHandler = new Promise<PostHookHandlerType<Item, Actor>>((resolve, reject) => {
        spies.setTaskPostHookHandler.mockImplementationOnce((taskName, handler) => {
          if (taskName === DELETE_ITEM_TASK_NAME) {
            resolve(handler);
          }
        });
      });
      await app.register(plugin, TEST_ENV);
      // simulate deletion
      (await deleteHandler)(MOCK_ITEM, MOCK_MEMBER, { log: app.log });
      const { deletePad } = await reqsParams;
      expect(deletePad?.get('padID')).toEqual(MOCK_ITEM.extra.etherpad.padID);
    });

    it('copies pad when item is copied', async () => {
      const { app, spies } = await buildApp();
      const reqsParams = setUpApi({
        createGroupIfNotExistsFor: [
          StatusCodes.OK,
          { code: 0, message: 'ok', data: { groupID: MOCK_GROUP_ID } },
        ],
        copyPad: [StatusCodes.OK, { code: 0, message: 'ok', data: null }],
      });
      const copyHandler = new Promise<PreHookHandlerType<Item, Actor>>((resolve, reject) => {
        spies.setTaskPreHookHandler.mockImplementationOnce((taskName, handler) => {
          if (taskName === COPY_ITEM_TASK_NAME) {
            resolve(handler);
          }
        });
      });
      await app.register(plugin, TEST_ENV);
      // simulate item copy
      (await copyHandler)(MOCK_ITEM, MOCK_MEMBER, { log: app.log });
      const { createGroupIfNotExistsFor, copyPad } = await reqsParams;
      expect(copyPad?.get('destinationID')).toEqual(
        `${MOCK_ITEM.extra.etherpad.groupID}$${createGroupIfNotExistsFor?.get('groupMapper')}`,
      );
      expect(copyPad?.get('sourceID')).toEqual(MOCK_ITEM.extra.etherpad.padID);
    });

    it('throws if pad ID is not defined on copy', async () => {
      const { app, spies } = await buildApp();
      const reqsParams = setUpApi({
        createGroupIfNotExistsFor: [
          StatusCodes.OK,
          { code: 0, message: 'ok', data: { groupID: MOCK_GROUP_ID } },
        ],
        copyPad: [StatusCodes.OK, { code: 0, message: 'ok', data: null }],
      });
      const copyHandler = new Promise<PreHookHandlerType<Item, Actor>>((resolve, reject) => {
        spies.setTaskPreHookHandler.mockImplementationOnce((taskName, handler) => {
          if (taskName === COPY_ITEM_TASK_NAME) {
            resolve(handler);
          }
        });
      });
      await app.register(plugin, TEST_ENV);
      // simulate item copy
      const copyHandlerFn = await copyHandler;
      await expect(
        copyHandlerFn({ ...MOCK_ITEM, extra: {} }, MOCK_MEMBER, { log: app.log }),
      ).rejects.toEqual(
        new Error(
          `Illegal state: property padID is missing in etherpad extra for item ${MOCK_ITEM.id}`,
        ),
      );
    });
  });
});
