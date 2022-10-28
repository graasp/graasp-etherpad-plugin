import { FastifyLoggerInstance } from 'fastify';

import {
  Actor,
  DatabaseTransactionHandler,
  Item,
  ItemMembership,
  ItemType,
  Member,
  MemberType,
  PermissionLevel,
  Task,
  TaskStatus,
  UnknownExtra,
} from '@graasp/sdk';

export const MOCK_MEMBER: Member = {
  name: 'mock-name',
  email: 'mock-email',
  type: 'individual' as MemberType,
  extra: {},
  createdAt: 'mock-created-at',
  updatedAt: 'mock-updated-at',
  id: 'mock-id',
};

export const MOCK_MEMBERSHIP: ItemMembership = {
  id: 'mock-id',
  memberId: 'mock-member-id',
  itemPath: 'mock-item-path',
  permission: 'read' as PermissionLevel,
  creator: 'mock-creator',
  createdAt: 'mock-created-at',
  updatedAt: 'mock-updated-at',
};

export const MOCK_ITEM: Item<UnknownExtra> = {
  id: 'mock-id',
  name: 'mock-name',
  description: 'mock-description',
  type: ItemType.ETHERPAD,
  path: 'mock-path',
  extra: {},
  creator: 'mock-creator',
  createdAt: 'mock-created-at',
  updatedAt: 'mock-updated-at',
  settings: {},
};

/**
 * Mock item result task factory
 */
export const mockTask = <T>(
  name: string,
  actor: Actor,
  result: T,
  status: TaskStatus = TaskStatus.NEW,
  run: (
    handler: DatabaseTransactionHandler,
    log: FastifyLoggerInstance,
  ) => Promise<void | Task<Actor, T>[]> = async (handler, log) => {
    status = TaskStatus.OK;
  },
): Task<Actor, T> => ({
  name,
  actor,
  status,
  result,
  run,
});
