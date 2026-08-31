import Dexie, { type EntityTable } from 'dexie';
import type { DingMessage } from './types';

const db = new Dexie('WorkstationDB') as Dexie & {
  messages: EntityTable<DingMessage, 'id'>;
};

db.version(1).stores({
  messages: 'id, senderName, status, receivedAt, conversationId',
});

export { db };
