import { create } from 'zustand';
import type { DingMessage } from '../types';
import { db } from '../db';

interface MessageState {
  messages: DingMessage[];
  selectedId: string | null;
  loading: boolean;
  load: () => Promise<void>;
  addMessage: (msg: DingMessage) => Promise<void>;
  updateDraft: (id: string, draft: string) => void;
  markSent: (id: string, reply: string) => void;
  markSkipped: (id: string) => void;
  select: (id: string | null) => void;
  getSelected: () => DingMessage | undefined;
  newCount: () => number;
}

export const useMessageStore = create<MessageState>((set, get) => ({
  messages: [],
  selectedId: null,
  loading: true,

  load: async () => {
    const msgs = await db.messages.orderBy('receivedAt').reverse().toArray();
    set({ messages: msgs, loading: false });
  },

  addMessage: async (msg) => {
    const exists = await db.messages.get(msg.id);
    if (!exists) {
      await db.messages.put(msg);
      set((s) => ({ messages: [msg, ...s.messages] }));
    }
  },

  updateDraft: (id, draft) => {
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === id ? { ...m, draftReply: draft, status: 'drafted' as const } : m
      ),
    }));
  },

  markSent: (id, reply) => {
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === id ? { ...m, status: 'sent' as const, sentReply: reply } : m
      ),
    }));
    db.messages.update(id, { status: 'sent', sentReply: reply });
  },

  markSkipped: (id) => {
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === id ? { ...m, status: 'skipped' as const } : m
      ),
    }));
    db.messages.update(id, { status: 'skipped' });
  },

  select: (id) => set({ selectedId: id }),

  getSelected: () => {
    const { messages, selectedId } = get();
    return messages.find((m) => m.id === selectedId);
  },

  newCount: () => {
    return get().messages.filter((m) => m.status === 'new' || m.status === 'drafted').length;
  },
}));
