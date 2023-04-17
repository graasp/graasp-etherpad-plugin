import { DateTime } from 'luxon';

import { FastifyLoggerInstance } from 'fastify';

import Etherpad, { AuthorSession } from '@graasp/etherpad-api';
import {
  Actor,
  EtherpadItemExtra,
  EtherpadService,
  Item,
  ItemMembershipTaskManager,
  ItemTaskManager,
  ItemType,
  Member,
  PermissionLevel,
  PermissionLevelCompare,
  TaskRunner,
} from '@graasp/sdk';

import { MAX_SESSIONS_IN_COOKIE, PLUGIN_NAME } from './constants';
import {
  AccessForbiddenError,
  EtherpadServerError,
  ItemMissingExtraError,
  ItemNotFoundError,
} from './errors';

/**
 * Handles interactions between items and the remote Etherpad service
 * Exposes API to manage etherpad items inside Graasp
 */
export class EtherpadItemService implements EtherpadService {
  public readonly api: Etherpad;
  private readonly padNameFactory: () => string;
  private readonly publicUrl: string;
  private readonly cookieDomain: string;
  private readonly itemTaskManager: ItemTaskManager;
  private readonly itemMembershipTaskManager: ItemMembershipTaskManager;
  private readonly taskRunner: TaskRunner<Actor>;
  private readonly log: FastifyLoggerInstance;

  constructor(
    etherpad: Etherpad,
    padNameFactory: () => string,
    publicUrl: string,
    cookieDomain: string,
    itemTaskManager: ItemTaskManager,
    itemMembershipTaskManager: ItemMembershipTaskManager,
    taskRunner: TaskRunner<Actor>,
    log: FastifyLoggerInstance,
  ) {
    this.api = etherpad;
    this.padNameFactory = padNameFactory;
    this.publicUrl = publicUrl;
    this.cookieDomain = cookieDomain;
    this.itemTaskManager = itemTaskManager;
    this.itemMembershipTaskManager = itemMembershipTaskManager;
    this.taskRunner = taskRunner;
    this.log = log;
  }

  /**
   * Creates a new standalone pad in Etherpad service
   */
  private async createPad(
    options: { action: 'create'; initHtml?: string } | { action: 'copy'; sourceID: string },
  ) {
    // new pad name
    const padName = this.padNameFactory();

    // map pad to a group containing only itself
    const { groupID } = await this.api.createGroupIfNotExistsFor({
      groupMapper: `${padName}`,
    });

    switch (options.action) {
      case 'create':
        await this.api.createGroupPad({ groupID, padName });
        if (options.initHtml) {
          const padID = this.buildPadID({ groupID, padName });
          const { initHtml: html } = options;
          await this.api.setHTML({ padID, html });
        }
        break;
      case 'copy':
        const { sourceID } = options;
        await this.api.copyPad({
          sourceID,
          destinationID: this.buildPadID({ groupID, padName }),
        });
        break;
    }

    return { groupID, padName };
  }

  /**
   * Creates a new Etherpad item linked to a pad in the service
   */
  public async createEtherpadItem(name: string, member: Member, parentId?: string) {
    const { groupID, padName } = await this.createPad({ action: 'create' });

    const partialItem = {
      name,
      type: ItemType.ETHERPAD,
      extra: this.buildEtherpadExtra({ groupID, padName }),
    };

    const createItem = this.itemTaskManager.createCreateTaskSequence(member, partialItem, parentId);
    try {
      return (await this.taskRunner.runSingleSequence(createItem)) as Item<EtherpadItemExtra>;
    } catch (error) {
      // create item failed, delete created pad
      const padID = this.buildPadID({ groupID, padName });
      this.api
        .deletePad({ padID })
        .catch((e) =>
          this.log.error(`${PLUGIN_NAME}: failed to delete orphan etherpad ${padID}`, e),
        );
      throw error;
    }
  }

  /**
   * Retrieves the Etherpad service URL of the requested pad for a given item and a cookie
   * containing all valid sessions for pads for a given member (including the requested pad)
   */
  public async getEtherpadFromItem(itemId: string, member: Member, mode: 'read' | 'write') {
    const getItem = this.itemTaskManager.createGetTask(member, itemId);
    const item = (await this.taskRunner.runSingle(getItem)) as Item<Partial<EtherpadItemExtra>>;

    if (!item) {
      throw new ItemNotFoundError(itemId);
    }

    if (!item.extra?.etherpad) {
      throw new ItemMissingExtraError(item);
    }

    // 1. first check at least read access
    const getMembership = this.itemMembershipTaskManager.createGetMemberItemMembershipTask(member, {
      item,
      validatePermission: PermissionLevel.Read,
    });

    let membership;
    try {
      membership = await this.taskRunner.runSingle(getMembership);
      if (!membership) {
        throw new Error(); // will be caught by handler below to throw same exception
      }
    } catch (error) {
      throw new AccessForbiddenError(error);
    }

    // 2. if mode was write, check that permission is at least write
    // otherwise automatically fallback to read
    const checkedMode =
      mode === 'write' && PermissionLevelCompare.gte(membership.permission, PermissionLevel.Write)
        ? 'write'
        : 'read';

    const { padID, groupID } = item.extra.etherpad;

    let padUrl;
    switch (checkedMode) {
      case 'read': {
        const readOnlyResult = await this.api.getReadOnlyID({ padID });
        if (!readOnlyResult) {
          throw new EtherpadServerError(`No readOnlyID returned for padID ${padID}`);
        }
        const { readOnlyID } = readOnlyResult;
        padUrl = this.buildPadPath({ padID: readOnlyID }, this.publicUrl);
        break;
      }
      case 'write': {
        padUrl = this.buildPadPath({ padID }, this.publicUrl);
        break;
      }
    }

    // map user to etherpad author
    const { authorID } = await this.api.createAuthorIfNotExistsFor({
      authorMapper: member.id,
      name: member.name,
    });

    // start session for user on the group
    const expiration = DateTime.now().plus({ days: 1 });
    const sessionResult = await this.api.createSession({
      authorID,
      groupID,
      validUntil: expiration.toUnixInteger(),
    });
    if (!sessionResult) {
      throw new EtherpadServerError(
        `No session created for authorID ${authorID} on group ${groupID}`,
      );
    }
    const { sessionID } = sessionResult;

    // get available sessions for user
    const sessions = (await this.api.listSessionsOfAuthor({ authorID })) ?? {};

    // split valid from expired sessions
    const now = DateTime.now();
    const { valid, expired } = Object.entries(sessions).reduce(
      ({ valid, expired }, [id, session]) => {
        const validUntil = session?.validUntil;
        if (!validUntil) {
          // edge case: some old sessions may be null, or not have an expiration set
          // delete malformed session anyway
          expired.add(id);
        } else {
          // normal case: check if session is expired
          const isExpired = DateTime.fromSeconds(validUntil) <= now;
          isExpired ? expired.add(id) : valid.add(id);
        }
        return { valid, expired };
      },
      {
        valid: new Set<string>(),
        expired: new Set<string>(),
      },
    );
    // sanity check, add the new sessionID (should already be part of the set)
    valid.add(sessionID);

    // in practice, there is (probably) a limit of 1024B per cookie value
    // https://chromestatus.com/feature/4946713618939904
    // so we can only store up to limit / (size of sessionID string + ",")
    // assuming that no other cookies are set on the etherpad domain
    // to err on the cautious side, we invalidate the oldest cookies in this case
    if (valid.size > MAX_SESSIONS_IN_COOKIE) {
      const sortedRecent = Array.from(valid).sort((a, b) => {
        // we are guaranteed that a, b index valid sessions from above
        const timeA = DateTime.fromSeconds((sessions[a] as AuthorSession).validUntil);
        const timeB = DateTime.fromSeconds((sessions[b] as AuthorSession).validUntil);
        // return inversed for most recent
        if (timeA < timeB) {
          return 1;
        }
        if (timeA > timeB) {
          return -1;
        }
        return 0;
      });

      const toInvalidate = sortedRecent.slice(MAX_SESSIONS_IN_COOKIE);

      // mutate valid and expired sets in place
      toInvalidate.forEach((id) => {
        valid.delete(id);
        expired.add(id);
      });
    }

    // delete expired cookies asynchronously in the background, accept failures by catching
    expired.forEach((sessionID) => {
      this.api
        .deleteSession({ sessionID })
        .catch((e) =>
          this.log.error(
            `${PLUGIN_NAME}: failed to delete etherpad session ${sessionID}`,
            sessions[sessionID],
            e,
          ),
        );
    });

    // set cookie with all valid cookies (users should be able to access multiple etherpads simultaneously)
    const cookie = {
      name: 'sessionID',
      value: Array.from(valid).join(','),
      options: {
        domain: this.cookieDomain,
        path: '/',
        expires: expiration.toJSDate(),
        signed: false,
        httpOnly: false, // cookie must be available to Etherpad's JS code for it to work!
      },
    };

    return { padUrl, cookie };
  }

  /**
   * Deletes an Etherpad associated to an item
   */
  public async deleteEtherpadForItem(item: Partial<Item<EtherpadItemExtra>>, actor: Actor) {
    if (item.type !== ItemType.ETHERPAD) {
      return;
    }

    const padID = item?.extra?.etherpad?.padID;
    if (!padID) {
      throw new Error(
        `Illegal state: property padID is missing in etherpad extra for item ${item.id}`,
      );
    }

    await this.api.deletePad({ padID });
  }

  /**
   * Copies an Etherpad for an associated copied mutable item
   */
  public async copyEtherpadInMutableItem(
    mutableItem: Partial<Item<EtherpadItemExtra>>,
    actor: Actor,
  ) {
    const item = mutableItem;
    if (item.type !== ItemType.ETHERPAD) {
      return;
    }

    const padID = item?.extra?.etherpad?.padID;
    if (!padID) {
      throw new Error(
        `Illegal state: property padID is missing in etherpad extra for item ${item.id}`,
      );
    }

    const { groupID, padName } = await this.createPad({ action: 'copy', sourceID: padID });
    // assign pad copy to new item's extra
    item.extra = this.buildEtherpadExtra({ groupID, padName });
  }

  /**
   * Builds a group pad ID
   * https://etherpad.org/doc/v1.8.18/#index_pad
   */
  static buildPadID({ groupID, padName }: { groupID: string; padName: string }) {
    return `${groupID}$${padName}`;
  }
  buildPadID = EtherpadItemService.buildPadID;

  /**
   * Builds an Etherpad path to the given pad
   * https://etherpad.org/doc/v1.8.18/#index_embed-parameters
   * @param baseUrl if specified, will return the absolute url to the pad, otherwise the relative path will be given
   */
  static buildPadPath({ padID }: { padID: string }, baseUrl?: string) {
    const path = `/p/${padID}`;
    return baseUrl ? new URL(path, baseUrl).toString() : path;
  }
  buildPadPath = EtherpadItemService.buildPadPath;

  /**
   * Builds an Etherpad extra for Item
   */
  static buildEtherpadExtra({
    groupID,
    padName,
  }: {
    groupID: string;
    padName: string;
  }): EtherpadItemExtra {
    return {
      etherpad: {
        padID: this.buildPadID({ groupID, padName }),
        groupID,
      },
    };
  }
  buildEtherpadExtra = EtherpadItemService.buildEtherpadExtra;
}
