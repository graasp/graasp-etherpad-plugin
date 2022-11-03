import Etherpad, {
  AttributePool,
  Author,
  AuthorMapper,
  AuthorName,
  AuthorSession,
  Authors,
  ChatHead,
  Group,
  GroupMapper,
  GroupPad,
  Groups,
  LastEdited,
  Pad,
  PadChatHistory,
  PadChatHistoryResult,
  PadChatMessage,
  PadDestination,
  PadHtml,
  PadHtmlDiff,
  PadHtmlDiffResult,
  PadMessage,
  PadOptionalRev,
  PadOptionalText,
  PadPassword,
  PadPublicStatus,
  PadReadOnly,
  PadRev,
  PadText,
  PadUsers,
  PadUsersCount,
  Pads,
  RevisionsCount,
  SavedRevisions,
  SavedRevisionsCount,
  Session,
  Stats,
} from '@graasp/etherpad-api';

import { EtherpadServerError } from './errors';

/**
 * We guarantee that the result is non-nullable
 * since by construction Etherpad will throw if the result fails
 */
function wrapErrors<T>(promise: Promise<T>): Promise<NonNullable<T>> {
  return promise.catch((error) => {
    throw new EtherpadServerError(error);
  }) as Promise<NonNullable<T>>;
}

/**
 * A wrapper for Etherpad which converts errors into graasp error
 */
export class GraaspEtherpad extends Etherpad {
  createGroup(qs?: void, throwOnEtherpadError?: boolean): Promise<Group> {
    return wrapErrors(super.createGroup(qs, throwOnEtherpadError));
  }
  createGroupIfNotExistsFor(qs: GroupMapper, throwOnEtherpadError?: boolean): Promise<Group> {
    return wrapErrors(super.createGroupIfNotExistsFor(qs, throwOnEtherpadError));
  }
  deleteGroup(qs: Group, throwOnEtherpadError?: boolean): Promise<null> {
    return wrapErrors(super.deleteGroup(qs, throwOnEtherpadError));
  }
  listPads(qs: Group, throwOnEtherpadError?: boolean): Promise<Pads> {
    return wrapErrors(super.listPads(qs, throwOnEtherpadError));
  }
  createGroupPad(qs: GroupPad, throwOnEtherpadError?: boolean): Promise<null> {
    return wrapErrors(super.createGroupPad(qs, throwOnEtherpadError));
  }
  listAllGroups(qs?: void, throwOnEtherpadError?: boolean): Promise<Groups> {
    return wrapErrors(super.listAllGroups(qs, throwOnEtherpadError));
  }
  createAuthor(qs: AuthorName, throwOnEtherpadError?: boolean): Promise<Author> {
    return wrapErrors(super.createAuthor(qs, throwOnEtherpadError));
  }
  createAuthorIfNotExistsFor(qs: AuthorMapper, throwOnEtherpadError?: boolean): Promise<Author> {
    return wrapErrors(super.createAuthorIfNotExistsFor(qs, throwOnEtherpadError));
  }
  listPadsOfAuthor(qs: Author, throwOnEtherpadError?: boolean): Promise<Pads> {
    return wrapErrors(super.listPadsOfAuthor(qs, throwOnEtherpadError));
  }
  getAuthorName(qs: Author, throwOnEtherpadError?: boolean): Promise<Required<AuthorName>> {
    return wrapErrors(super.getAuthorName(qs, throwOnEtherpadError));
  }
  createSession(qs: AuthorSession, throwOnEtherpadError?: boolean): Promise<Session> {
    return wrapErrors(super.createSession(qs, throwOnEtherpadError));
  }
  deleteSession(qs: Session, throwOnEtherpadError?: boolean): Promise<null> {
    return wrapErrors(super.deleteSession(qs, throwOnEtherpadError));
  }
  getSessionInfo(qs: Session, throwOnEtherpadError?: boolean): Promise<AuthorSession> {
    return wrapErrors(super.getSessionInfo(qs, throwOnEtherpadError));
  }
  listSessionsOfGroup(
    qs: Group,
    throwOnEtherpadError?: boolean,
  ): Promise<{ [sessionID: string]: AuthorSession }> {
    return wrapErrors(super.listSessionsOfGroup(qs, throwOnEtherpadError));
  }
  listSessionsOfAuthor(
    qs: Author,
    throwOnEtherpadError?: boolean,
  ): Promise<{ [sessionID: string]: AuthorSession }> {
    return wrapErrors(super.listSessionsOfAuthor(qs, throwOnEtherpadError));
  }
  getText(qs: PadOptionalRev, throwOnEtherpadError?: boolean): Promise<Pick<PadText, 'text'>> {
    return wrapErrors(super.getText(qs, throwOnEtherpadError));
  }
  setText(qs: PadText, throwOnEtherpadError?: boolean): Promise<null> {
    return wrapErrors(super.setText(qs, throwOnEtherpadError));
  }
  appendText(qs: PadText, throwOnEtherpadError?: boolean): Promise<null> {
    return wrapErrors(super.appendText(qs, throwOnEtherpadError));
  }
  getHTML(qs: PadOptionalRev, throwOnEtherpadError?: boolean): Promise<Pick<PadHtml, 'html'>> {
    return wrapErrors(super.getHTML(qs, throwOnEtherpadError));
  }
  setHTML(qs: PadHtml, throwOnEtherpadError?: boolean): Promise<null> {
    return wrapErrors(super.setHTML(qs, throwOnEtherpadError));
  }
  getAttributePool(qs: Pad, throwOnEtherpadError?: boolean): Promise<AttributePool> {
    return wrapErrors(super.getAttributePool(qs, throwOnEtherpadError));
  }
  getRevisionChangeset(qs: PadOptionalRev, throwOnEtherpadError?: boolean): Promise<string> {
    return wrapErrors(super.getRevisionChangeset(qs, throwOnEtherpadError));
  }
  createDiffHTML(qs: PadHtmlDiff, throwOnEtherpadError?: boolean): Promise<PadHtmlDiffResult> {
    return wrapErrors(super.createDiffHTML(qs, throwOnEtherpadError));
  }
  restoreRevision(qs: PadRev, throwOnEtherpadError?: boolean): Promise<null> {
    return wrapErrors(super.restoreRevision(qs, throwOnEtherpadError));
  }
  getChatHistory(
    qs: PadChatHistory,
    throwOnEtherpadError?: boolean,
  ): Promise<PadChatHistoryResult> {
    return wrapErrors(super.getChatHistory(qs, throwOnEtherpadError));
  }
  getChatHead(qs: Pad, throwOnEtherpadError?: boolean): Promise<ChatHead> {
    return wrapErrors(super.getChatHead(qs, throwOnEtherpadError));
  }
  appendChatMessage(qs: PadChatMessage, throwOnEtherpadError?: boolean): Promise<null> {
    return wrapErrors(super.appendChatMessage(qs, throwOnEtherpadError));
  }
  createPad(qs: PadOptionalText, throwOnEtherpadError?: boolean): Promise<null> {
    return wrapErrors(super.createPad(qs, throwOnEtherpadError));
  }
  getRevisionsCount(qs: Pad, throwOnEtherpadError?: boolean): Promise<RevisionsCount> {
    return wrapErrors(super.getRevisionsCount(qs, throwOnEtherpadError));
  }
  getSavedRevisionsCount(qs: Pad, throwOnEtherpadError?: boolean): Promise<SavedRevisionsCount> {
    return wrapErrors(super.getSavedRevisionsCount(qs, throwOnEtherpadError));
  }
  listSavedRevisions(qs: Pad, throwOnEtherpadError?: boolean): Promise<SavedRevisions> {
    return wrapErrors(super.listSavedRevisions(qs, throwOnEtherpadError));
  }
  saveRevision(qs: PadOptionalRev, throwOnEtherpadError?: boolean): Promise<null> {
    return wrapErrors(super.saveRevision(qs, throwOnEtherpadError));
  }
  padUsersCount(qs: Pad, throwOnEtherpadError?: boolean): Promise<PadUsersCount> {
    return wrapErrors(super.padUsersCount(qs, throwOnEtherpadError));
  }
  padUsers(qs: Pad, throwOnEtherpadError?: boolean): Promise<PadUsers> {
    return wrapErrors(super.padUsers(qs, throwOnEtherpadError));
  }
  deletePad(qs: Pad, throwOnEtherpadError?: boolean): Promise<null> {
    return wrapErrors(super.deletePad(qs, throwOnEtherpadError));
  }
  copyPad(qs: PadDestination, throwOnEtherpadError?: boolean): Promise<null> {
    return wrapErrors(super.copyPad(qs, throwOnEtherpadError));
  }
  copyPadWithoutHistory(qs: PadDestination, throwOnEtherpadError?: boolean): Promise<null> {
    return wrapErrors(super.copyPadWithoutHistory(qs, throwOnEtherpadError));
  }
  movePad(qs: PadDestination, throwOnEtherpadError?: boolean): Promise<null> {
    return wrapErrors(super.movePad(qs, throwOnEtherpadError));
  }
  getReadOnlyID(qs: Pad, throwOnEtherpadError?: boolean): Promise<PadReadOnly> {
    return wrapErrors(super.getReadOnlyID(qs, throwOnEtherpadError));
  }
  getPadID(qs: PadReadOnly, throwOnEtherpadError?: boolean): Promise<Pad> {
    return wrapErrors(super.getPadID(qs, throwOnEtherpadError));
  }
  setPublicStatus(qs: PadPublicStatus, throwOnEtherpadError?: boolean): Promise<null> {
    return wrapErrors(super.setPublicStatus(qs, throwOnEtherpadError));
  }
  getPublicStatus(
    qs: Pad,
    throwOnEtherpadError?: boolean,
  ): Promise<Pick<PadPublicStatus, 'publicStatus'>> {
    return wrapErrors(super.getPublicStatus(qs, throwOnEtherpadError));
  }
  setPassword(qs: PadPassword, throwOnEtherpadError?: boolean): Promise<{}> {
    return wrapErrors(super.setPassword(qs, throwOnEtherpadError));
  }
  isPasswordProtected(qs: Pad, throwOnEtherpadError?: boolean): Promise<{}> {
    return wrapErrors(super.isPasswordProtected(qs, throwOnEtherpadError));
  }
  listAuthorsOfPad(qs: Pad, throwOnEtherpadError?: boolean): Promise<Authors> {
    return wrapErrors(super.listAuthorsOfPad(qs, throwOnEtherpadError));
  }
  getLastEdited(qs: Pad, throwOnEtherpadError?: boolean): Promise<LastEdited> {
    return wrapErrors(super.getLastEdited(qs, throwOnEtherpadError));
  }
  sendClientsMessage(qs: PadMessage, throwOnEtherpadError?: boolean): Promise<{}> {
    return wrapErrors(super.sendClientsMessage(qs, throwOnEtherpadError));
  }
  checkToken(qs?: void, throwOnEtherpadError?: boolean): Promise<null> {
    return wrapErrors(super.checkToken(qs, throwOnEtherpadError));
  }
  listAllPads(qs?: void, throwOnEtherpadError?: boolean): Promise<Pads> {
    return wrapErrors(super.listAllPads(qs, throwOnEtherpadError));
  }
  getStats(qs?: void, throwOnEtherpadError?: boolean): Promise<Stats> {
    return wrapErrors(super.getStats(qs, throwOnEtherpadError));
  }
}
