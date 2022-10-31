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

const wrapErrors = (error: Error) => {
  throw new EtherpadServerError(error);
};

/**
 * A wrapper for Etherpad which converts errors into graasp error
 */
export class GraaspEtherpad extends Etherpad {
  createGroup(qs?: void | undefined, throwOnEtherpadError?: boolean | undefined): Promise<Group> {
    return super.createGroup(qs, throwOnEtherpadError).catch(wrapErrors);
  }
  createGroupIfNotExistsFor(
    qs: GroupMapper,
    throwOnEtherpadError?: boolean | undefined,
  ): Promise<Group> {
    return super.createGroupIfNotExistsFor(qs, throwOnEtherpadError).catch(wrapErrors);
  }
  deleteGroup(qs: Group, throwOnEtherpadError?: boolean | undefined): Promise<null> {
    return super.deleteGroup(qs, throwOnEtherpadError).catch(wrapErrors);
  }
  listPads(qs: Group, throwOnEtherpadError?: boolean | undefined): Promise<Pads> {
    return super.listPads(qs, throwOnEtherpadError).catch(wrapErrors);
  }
  createGroupPad(qs: GroupPad, throwOnEtherpadError?: boolean | undefined): Promise<null> {
    return super.createGroupPad(qs, throwOnEtherpadError).catch(wrapErrors);
  }
  listAllGroups(
    qs?: void | undefined,
    throwOnEtherpadError?: boolean | undefined,
  ): Promise<Groups> {
    return super.listAllGroups(qs, throwOnEtherpadError).catch(wrapErrors);
  }
  createAuthor(qs: AuthorName, throwOnEtherpadError?: boolean | undefined): Promise<Author> {
    return super.createAuthor(qs, throwOnEtherpadError).catch(wrapErrors);
  }
  createAuthorIfNotExistsFor(
    qs: AuthorMapper,
    throwOnEtherpadError?: boolean | undefined,
  ): Promise<Author> {
    return super.createAuthorIfNotExistsFor(qs, throwOnEtherpadError).catch(wrapErrors);
  }
  listPadsOfAuthor(qs: Author, throwOnEtherpadError?: boolean | undefined): Promise<Pads> {
    return super.listPadsOfAuthor(qs, throwOnEtherpadError).catch(wrapErrors);
  }
  getAuthorName(
    qs: Author,
    throwOnEtherpadError?: boolean | undefined,
  ): Promise<Required<AuthorName>> {
    return super.getAuthorName(qs, throwOnEtherpadError).catch(wrapErrors);
  }
  createSession(qs: AuthorSession, throwOnEtherpadError?: boolean | undefined): Promise<Session> {
    return super.createSession(qs, throwOnEtherpadError).catch(wrapErrors);
  }
  deleteSession(qs: Session, throwOnEtherpadError?: boolean | undefined): Promise<null> {
    return super.deleteSession(qs, throwOnEtherpadError).catch(wrapErrors);
  }
  getSessionInfo(qs: Session, throwOnEtherpadError?: boolean | undefined): Promise<AuthorSession> {
    return super.getSessionInfo(qs, throwOnEtherpadError).catch(wrapErrors);
  }
  listSessionsOfGroup(
    qs: Group,
    throwOnEtherpadError?: boolean | undefined,
  ): Promise<{ [sessionID: string]: AuthorSession }> {
    return super.listSessionsOfGroup(qs, throwOnEtherpadError).catch(wrapErrors);
  }
  listSessionsOfAuthor(
    qs: Author,
    throwOnEtherpadError?: boolean | undefined,
  ): Promise<{ [sessionID: string]: AuthorSession }> {
    return super.listSessionsOfAuthor(qs, throwOnEtherpadError).catch(wrapErrors);
  }
  getText(
    qs: PadOptionalRev,
    throwOnEtherpadError?: boolean | undefined,
  ): Promise<Pick<PadText, 'text'>> {
    return super.getText(qs, throwOnEtherpadError).catch(wrapErrors);
  }
  setText(qs: PadText, throwOnEtherpadError?: boolean | undefined): Promise<null> {
    return super.setText(qs, throwOnEtherpadError).catch(wrapErrors);
  }
  appendText(qs: PadText, throwOnEtherpadError?: boolean | undefined): Promise<null> {
    return super.appendText(qs, throwOnEtherpadError).catch(wrapErrors);
  }
  getHTML(
    qs: PadOptionalRev,
    throwOnEtherpadError?: boolean | undefined,
  ): Promise<Pick<PadHtml, 'html'>> {
    return super.getHTML(qs, throwOnEtherpadError).catch(wrapErrors);
  }
  setHTML(qs: PadHtml, throwOnEtherpadError?: boolean | undefined): Promise<null> {
    return super.setHTML(qs, throwOnEtherpadError).catch(wrapErrors);
  }
  getAttributePool(qs: Pad, throwOnEtherpadError?: boolean | undefined): Promise<AttributePool> {
    return super.getAttributePool(qs, throwOnEtherpadError).catch(wrapErrors);
  }
  getRevisionChangeset(
    qs: PadOptionalRev,
    throwOnEtherpadError?: boolean | undefined,
  ): Promise<string> {
    return super.getRevisionChangeset(qs, throwOnEtherpadError).catch(wrapErrors);
  }
  createDiffHTML(
    qs: PadHtmlDiff,
    throwOnEtherpadError?: boolean | undefined,
  ): Promise<PadHtmlDiffResult> {
    return super.createDiffHTML(qs, throwOnEtherpadError).catch(wrapErrors);
  }
  restoreRevision(qs: PadRev, throwOnEtherpadError?: boolean | undefined): Promise<null> {
    return super.restoreRevision(qs, throwOnEtherpadError).catch(wrapErrors);
  }
  getChatHistory(
    qs: PadChatHistory,
    throwOnEtherpadError?: boolean | undefined,
  ): Promise<PadChatHistoryResult> {
    return super.getChatHistory(qs, throwOnEtherpadError).catch(wrapErrors);
  }
  getChatHead(qs: Pad, throwOnEtherpadError?: boolean | undefined): Promise<ChatHead> {
    return super.getChatHead(qs, throwOnEtherpadError).catch(wrapErrors);
  }
  appendChatMessage(qs: PadChatMessage, throwOnEtherpadError?: boolean | undefined): Promise<null> {
    return super.appendChatMessage(qs, throwOnEtherpadError).catch(wrapErrors);
  }
  createPad(qs: PadOptionalText, throwOnEtherpadError?: boolean | undefined): Promise<null> {
    return super.createPad(qs, throwOnEtherpadError).catch(wrapErrors);
  }
  getRevisionsCount(qs: Pad, throwOnEtherpadError?: boolean | undefined): Promise<RevisionsCount> {
    return super.getRevisionsCount(qs, throwOnEtherpadError).catch(wrapErrors);
  }
  getSavedRevisionsCount(
    qs: Pad,
    throwOnEtherpadError?: boolean | undefined,
  ): Promise<SavedRevisionsCount> {
    return super.getSavedRevisionsCount(qs, throwOnEtherpadError).catch(wrapErrors);
  }
  listSavedRevisions(qs: Pad, throwOnEtherpadError?: boolean | undefined): Promise<SavedRevisions> {
    return super.listSavedRevisions(qs, throwOnEtherpadError).catch(wrapErrors);
  }
  saveRevision(qs: PadOptionalRev, throwOnEtherpadError?: boolean | undefined): Promise<null> {
    return super.saveRevision(qs, throwOnEtherpadError).catch(wrapErrors);
  }
  padUsersCount(qs: Pad, throwOnEtherpadError?: boolean | undefined): Promise<PadUsersCount> {
    return super.padUsersCount(qs, throwOnEtherpadError).catch(wrapErrors);
  }
  padUsers(qs: Pad, throwOnEtherpadError?: boolean | undefined): Promise<PadUsers> {
    return super.padUsers(qs, throwOnEtherpadError).catch(wrapErrors);
  }
  deletePad(qs: Pad, throwOnEtherpadError?: boolean | undefined): Promise<null> {
    return super.deletePad(qs, throwOnEtherpadError).catch(wrapErrors);
  }
  copyPad(qs: PadDestination, throwOnEtherpadError?: boolean | undefined): Promise<null> {
    return super.copyPad(qs, throwOnEtherpadError).catch(wrapErrors);
  }
  copyPadWithoutHistory(
    qs: PadDestination,
    throwOnEtherpadError?: boolean | undefined,
  ): Promise<null> {
    return super.copyPadWithoutHistory(qs, throwOnEtherpadError).catch(wrapErrors);
  }
  movePad(qs: PadDestination, throwOnEtherpadError?: boolean | undefined): Promise<null> {
    return super.movePad(qs, throwOnEtherpadError).catch(wrapErrors);
  }
  getReadOnlyID(qs: Pad, throwOnEtherpadError?: boolean | undefined): Promise<PadReadOnly> {
    return super.getReadOnlyID(qs, throwOnEtherpadError).catch(wrapErrors);
  }
  getPadID(qs: PadReadOnly, throwOnEtherpadError?: boolean | undefined): Promise<Pad> {
    return super.getPadID(qs, throwOnEtherpadError).catch(wrapErrors);
  }
  setPublicStatus(qs: PadPublicStatus, throwOnEtherpadError?: boolean | undefined): Promise<null> {
    return super.setPublicStatus(qs, throwOnEtherpadError).catch(wrapErrors);
  }
  getPublicStatus(
    qs: Pad,
    throwOnEtherpadError?: boolean | undefined,
  ): Promise<Pick<PadPublicStatus, 'publicStatus'>> {
    return super.getPublicStatus(qs, throwOnEtherpadError).catch(wrapErrors);
  }
  setPassword(qs: PadPassword, throwOnEtherpadError?: boolean | undefined): Promise<{}> {
    return super.setPassword(qs, throwOnEtherpadError).catch(wrapErrors);
  }
  isPasswordProtected(qs: Pad, throwOnEtherpadError?: boolean | undefined): Promise<{}> {
    return super.isPasswordProtected(qs, throwOnEtherpadError).catch(wrapErrors);
  }
  listAuthorsOfPad(qs: Pad, throwOnEtherpadError?: boolean | undefined): Promise<Authors> {
    return super.listAuthorsOfPad(qs, throwOnEtherpadError).catch(wrapErrors);
  }
  getLastEdited(qs: Pad, throwOnEtherpadError?: boolean | undefined): Promise<LastEdited> {
    return super.getLastEdited(qs, throwOnEtherpadError).catch(wrapErrors);
  }
  sendClientsMessage(qs: PadMessage, throwOnEtherpadError?: boolean | undefined): Promise<{}> {
    return super.sendClientsMessage(qs, throwOnEtherpadError).catch(wrapErrors);
  }
  checkToken(qs?: void | undefined, throwOnEtherpadError?: boolean | undefined): Promise<null> {
    return super.checkToken(qs, throwOnEtherpadError).catch(wrapErrors);
  }
  listAllPads(qs?: void | undefined, throwOnEtherpadError?: boolean | undefined): Promise<Pads> {
    return super.listAllPads(qs, throwOnEtherpadError).catch(wrapErrors);
  }
  getStats(qs?: void | undefined, throwOnEtherpadError?: boolean | undefined): Promise<Stats> {
    return super.getStats(qs, throwOnEtherpadError).catch(wrapErrors);
  }
}
