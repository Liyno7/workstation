'use client';

import { useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import { useRequirementStore } from '@/lib/stores/requirements';
import type { RequirementStatus, Priority } from '@/lib/types';

const columns: { id: RequirementStatus; label: string }[] = [
  { id: 'pending', label: '待确认' },
  { id: 'in_progress', label: '进行中' },
  { id: 'done', label: '已完成' },
  { id: 'released', label: '已上线' },
];

const priorityCls: Record<Priority, string> = {
  P0: 'bg-p0 text-white',
  P1: 'bg-p1 text-white',
  P2: 'bg-p2 text-white',
  P3: 'bg-bg-hover text-text-muted',
};

export default function RequirementBoard() {
  const { requirements, add, updateStatus, remove } = useRequirementStore();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    title: '', requester: '', project: '', priority: 'P2' as Priority, notes: '',
  });

  function getWeekId(d: Date = new Date()): string {
    const jan1 = new Date(d.getFullYear(), 0, 1);
    const week = Math.ceil(((+d - +jan1) / 86400000 + jan1.getDay() + 1) / 7);
    return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
  }

  const handleAdd = () => {
    if (!form.title.trim()) return;
    add({ ...form, status: 'pending', estimatedDate: '', weekId: getWeekId() });
    setForm({ title: '', requester: '', project: '', priority: 'P2', notes: '' });
    setShowForm(false);
  };

  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('text/plain', id);
  };

  const handleDrop = (e: React.DragEvent, status: RequirementStatus) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain');
    if (id) updateStatus(id, status);
  };

  const weekReqs = requirements.filter((r) => r.weekId === getWeekId());

  return (
    <div className="flex h-full flex-col">
      {/* 头部 */}
      <div className="flex items-center justify-between px-6 h-11 border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-[13px] font-medium">本周需求</span>
          <span className="text-[11px] text-text-muted">{weekReqs.length}</span>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1 text-[12px] text-text-secondary hover:text-text transition-colors"
        >
          {showForm ? <X size={12} /> : <Plus size={12} />}
          {showForm ? '取消' : '新增'}
        </button>
      </div>

      {/* 新增表单 */}
      {showForm && (
        <div className="px-6 py-3 border-b border-border bg-bg-sidebar space-y-2">
          <input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="需求标题"
            className="w-full text-[13px]"
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          />
          <div className="flex gap-2">
            <input
              value={form.requester}
              onChange={(e) => setForm({ ...form, requester: e.target.value })}
              placeholder="需求方"
              className="flex-1 text-[13px]"
            />
            <input
              value={form.project}
              onChange={(e) => setForm({ ...form, project: e.target.value })}
              placeholder="项目"
              className="flex-1 text-[13px]"
            />
            <select
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value as Priority })}
              className="text-[13px]"
            >
              <option value="P0">P0</option>
              <option value="P1">P1</option>
              <option value="P2">P2</option>
              <option value="P3">P3</option>
            </select>
            <button
              onClick={handleAdd}
              className="bg-accent text-white text-[13px] px-4 rounded-lg hover:opacity-90 transition-opacity"
            >
              添加
            </button>
          </div>
        </div>
      )}

      {/* 看板 */}
      <div className="flex-1 flex gap-4 overflow-x-auto p-6">
        {columns.map((col) => {
          const items = weekReqs.filter((r) => r.status === col.id);
          return (
            <div
              key={col.id}
              className="flex-1 min-w-[200px] flex flex-col"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleDrop(e, col.id)}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-[12px] font-medium text-text-secondary uppercase tracking-wider">
                  {col.label}
                </span>
                <span className="text-[11px] text-text-muted">{items.length}</span>
              </div>
              <div className="flex-1 overflow-y-auto space-y-2">
                {items.map((req) => (
                  <div
                    key={req.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, req.id)}
                    className="bg-bg-card border border-border-light rounded-xl p-3 cursor-grab active:cursor-grabbing hover:border-border transition-colors group"
                  >
                    <div className="flex items-start justify-between">
                      <p className="text-[13px] leading-snug flex-1">{req.title}</p>
                      <button
                        onClick={() => remove(req.id)}
                        className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-p0 transition-all ml-2"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                    <div className="flex items-center gap-1.5 mt-2">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${priorityCls[req.priority]}`}>
                        {req.priority}
                      </span>
                      {req.requester && (
                        <span className="text-[11px] text-text-muted">{req.requester}</span>
                      )}
                    </div>
                  </div>
                ))}
                {items.length === 0 && (
                  <div className="border border-dashed border-border rounded-xl py-8 text-center text-[12px] text-text-muted">
                    拖拽到此处
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
