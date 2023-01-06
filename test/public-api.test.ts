import { StatusCodes } from 'http-status-codes';
import nock from 'nock';
import { createMock } from 'ts-auto-mock';

import fastify, { FastifyLoggerInstance } from 'fastify';

import {
  Actor,
  DatabaseTransactionHandler,
  HttpMethod,
  Item,
  PublicItemTaskManager,
  TaskRunner,
} from '@graasp/sdk';

import { EtherpadPluginOptions } from '../src';
import plugin from '../src/public-api';
import { setUpApi } from './api';
import { TEST_ENV } from './config';
import { MOCK_ITEM, MOCK_MEMBER, MOCK_PAD_ID, MOCK_PAD_READ_ONLY_ID, mockTask } from './fixtures';

type Awaited<T> = T extends PromiseLike<infer U> ? U : T;
type BuildAppType = Awaited<ReturnType<typeof buildPublicApp>>;

async function buildPublicApp(args: { options: EtherpadPluginOptions }) {
  const app = fastify();

  const publicItemTaskManager = createMock<PublicItemTaskManager>();
  const taskRunner = createMock<TaskRunner<Actor>>();
  const dbTrxHandler = createMock<DatabaseTransactionHandler>();
  const logger = createMock<FastifyLoggerInstance>();

  const publicPlugin = {
    graaspActor: MOCK_MEMBER,
    items: {
      taskManager: publicItemTaskManager,
    },
  };

  app.decorate('public', publicPlugin);
  app.decorate('taskRunner', taskRunner);

  // uuid schema referenced from our schema should be registered by core
  // we use a simple string schema instead
  app.addSchema({
    $id: 'http://graasp.org/',
    type: 'object',
    definitions: {
      uuid: { type: 'string' },
    },
  });

  const getPublicItem = jest
    .spyOn(publicItemTaskManager, 'createGetPublicItemTask')
    .mockImplementation((actor, { itemId }) =>
      mockTask<Item>('mock-public-item-task', actor, MOCK_ITEM),
    );

  const runSingle = jest
    .spyOn(taskRunner, 'runSingle')
    .mockImplementation((task) => (task.run(dbTrxHandler, logger), Promise.resolve(task.result)));

  if (args?.options) await app.register(plugin, args.options);

  return {
    app,
    services: {
      publicPlugin,
    },
    spies: {
      getPublicItem,
      runSingle,
    },
  };
}

describe('Public API', () => {
  let instance: BuildAppType;

  beforeAll(async () => {
    instance = await buildPublicApp({ options: TEST_ENV });
  });

  afterEach(() => {
    nock.cleanAll();
  });

  const payloadRead = {
    method: HttpMethod.GET,
    url: '/etherpad/read/mock-item-id',
  };

  it('throws error if public plugin is not defined', async () => {
    const app = fastify();
    await expect(app.register(plugin, TEST_ENV)).rejects.toEqual(
      new Error('graasp-plugin-etherpad: Public plugin was not registered!'),
    );
  });

  it('reads a pad successfully', async () => {
    const { app } = instance;
    const reqParams = setUpApi({
      getReadOnlyID: [
        StatusCodes.OK,
        { code: 0, message: 'ok', data: { readOnlyID: MOCK_PAD_READ_ONLY_ID } },
      ],
    });
    const res = await app.inject(payloadRead);

    const { getReadOnlyID } = await reqParams;
    expect(getReadOnlyID?.get('padID')).toEqual(MOCK_PAD_ID);
    expect(res.statusCode).toEqual(StatusCodes.OK);
    expect(res.json()).toEqual({
      padUrl: `${TEST_ENV.url}/p/${MOCK_PAD_READ_ONLY_ID}`,
    });
  });

  it('returns error if item is not found', async () => {
    const { app, spies } = instance;
    setUpApi({
      getReadOnlyID: [
        StatusCodes.OK,
        { code: 0, message: 'ok', data: { readOnlyID: MOCK_PAD_READ_ONLY_ID } },
      ],
    });
    spies.getPublicItem.mockImplementationOnce((actor, itemId) =>
      mockTask('mock-empty-task', actor, null as unknown as Item),
    );
    const res = await app.inject(payloadRead);

    expect(res.statusCode).toEqual(StatusCodes.NOT_FOUND);
    expect(res.json()).toEqual({
      code: 'GPEPERR002',
      message: 'Item not found',
      origin: 'graasp-plugin-etherpad',
      statusCode: StatusCodes.NOT_FOUND,
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
    spies.getPublicItem.mockImplementationOnce((actor, itemId) =>
      mockTask('mock-empty-task', actor, { ...MOCK_ITEM, extra: {} }),
    );
    const res = await app.inject(payloadRead);

    expect(res.statusCode).toEqual(StatusCodes.INTERNAL_SERVER_ERROR);
    expect(res.json()).toEqual({
      code: 'GPEPERR003',
      message: 'Item missing etherpad extra',
      origin: 'graasp-plugin-etherpad',
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
    });
  });
});
