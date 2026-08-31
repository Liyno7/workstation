import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Todo } from '../types';

interface TodoState {
  todos: Todo[];
  add: (t: Omit<Todo, 'id' | 'createdAt'>) => void;
  toggle: (id: string) => void;
  update: (id: string, data: Partial<Todo>) => void;
  remove: (id: string) => void;
  getByDate: (date: string) => Todo[];
  getToday: () => Todo[];
  fromMessage: (messageId: string, content: string, senderName: string) => void;
}

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

export const useTodoStore = create<TodoState>()(
  persist(
    (set, get) => ({
      todos: [],

      add: (t) => {
        const todo: Todo = {
          ...t,
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
        };
        set((s) => ({ todos: [todo, ...s.todos] }));
      },

      toggle: (id) => {
        set((s) => ({
          todos: s.todos.map((t) =>
            t.id === id ? { ...t, completed: !t.completed } : t
          ),
        }));
      },

      update: (id, data) => {
        set((s) => ({
          todos: s.todos.map((t) => (t.id === id ? { ...t, ...data } : t)),
        }));
      },

      remove: (id) => {
        set((s) => ({ todos: s.todos.filter((t) => t.id !== id) }));
      },

      getByDate: (date) => {
        return get().todos.filter((t) => t.date === date);
      },

      getToday: () => {
        const today = todayStr();
        return get().todos.filter((t) => t.date === today);
      },

      fromMessage: (messageId, content, senderName) => {
        const todo: Todo = {
          id: crypto.randomUUID(),
          content: `[${senderName}] ${content}`,
          date: todayStr(),
          priority: 'medium',
          completed: false,
          linkedMessageId: messageId,
          createdAt: new Date().toISOString(),
        };
        set((s) => ({ todos: [todo, ...s.todos] }));
      },
    }),
    { name: 'workstation-todos' }
  )
);
