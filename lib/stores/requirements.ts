import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Requirement, RequirementStatus, Priority } from '../types';

interface RequirementState {
  requirements: Requirement[];
  add: (r: Omit<Requirement, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateStatus: (id: string, status: RequirementStatus) => void;
  update: (id: string, data: Partial<Requirement>) => void;
  remove: (id: string) => void;
  getByStatus: (status: RequirementStatus) => Requirement[];
  getCurrentWeek: () => Requirement[];
}

function getWeekId(d: Date = new Date()): string {
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((+d - +jan1) / 86400000 + jan1.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

export const useRequirementStore = create<RequirementState>()(
  persist(
    (set, get) => ({
      requirements: [],

      add: (r) => {
        const now = new Date().toISOString();
        const req: Requirement = {
          ...r,
          id: crypto.randomUUID(),
          createdAt: now,
          updatedAt: now,
        };
        set((s) => ({ requirements: [req, ...s.requirements] }));
      },

      updateStatus: (id, status) => {
        set((s) => ({
          requirements: s.requirements.map((r) =>
            r.id === id ? { ...r, status, updatedAt: new Date().toISOString() } : r
          ),
        }));
      },

      update: (id, data) => {
        set((s) => ({
          requirements: s.requirements.map((r) =>
            r.id === id ? { ...r, ...data, updatedAt: new Date().toISOString() } : r
          ),
        }));
      },

      remove: (id) => {
        set((s) => ({ requirements: s.requirements.filter((r) => r.id !== id) }));
      },

      getByStatus: (status) => {
        return get().requirements.filter((r) => r.status === status);
      },

      getCurrentWeek: () => {
        const weekId = getWeekId();
        return get().requirements.filter((r) => r.weekId === weekId);
      },
    }),
    { name: 'workstation-requirements' }
  )
);
