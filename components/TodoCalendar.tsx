'use client';

import { useState, useMemo } from 'react';
import { Plus, Check, Trash2, ChevronLeft, ChevronRight, Link2 } from 'lucide-react';
import { useTodoStore } from '@/lib/stores/todos';

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'];

export default function TodoCalendar({ view }: { view: 'list' | 'calendar' }) {
  const { todos, add, toggle, remove, getByDate } = useTodoStore();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [newText, setNewText] = useState('');
  const [calMonth, setCalMonth] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  const selectedTodos = getByDate(selectedDate);
  const today = new Date().toISOString().split('T')[0];

  const handleAdd = () => {
    if (!newText.trim()) return;
    add({ content: newText, date: selectedDate, priority: 'medium', completed: false });
    setNewText('');
  };

  const calDays = useMemo(() => {
    const { year, month } = calMonth;
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    let startDow = firstDay.getDay() - 1;
    if (startDow < 0) startDow = 6;

    const days: { date: string; day: number; inMonth: boolean }[] = [];
    for (let i = startDow - 1; i >= 0; i--) {
      const d = new Date(year, month, -i);
      days.push({ date: d.toISOString().split('T')[0], day: d.getDate(), inMonth: false });
    }
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({ date, day: d, inMonth: true });
    }
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      days.push({ date: d.toISOString().split('T')[0], day: d.getDate(), inMonth: false });
    }
    return days;
  }, [calMonth]);

  const prevMonth = () => setCalMonth((p) => p.month === 0 ? { year: p.year - 1, month: 11 } : { ...p, month: p.month - 1 });
  const nextMonth = () => setCalMonth((p) => p.month === 11 ? { year: p.year + 1, month: 0 } : { ...p, month: p.month + 1 });

  const priorityDot: Record<string, string> = {
    high: 'bg-p0',
    medium: 'bg-p2',
    low: 'bg-p3',
  };

  return (
    <div className="flex h-full">
      {view === 'calendar' && (
        <div className="w-[320px] border-r border-border flex flex-col bg-bg-sidebar">
          {/* 月份导航 */}
          <div className="flex items-center justify-between px-4 h-11 border-b border-border">
            <button onClick={prevMonth} className="p-1 hover:bg-bg-hover rounded transition-colors">
              <ChevronLeft size={14} className="text-text-muted" />
            </button>
            <span className="text-[13px] font-medium">
              {calMonth.year}.{String(calMonth.month + 1).padStart(2, '0')}
            </span>
            <button onClick={nextMonth} className="p-1 hover:bg-bg-hover rounded transition-colors">
              <ChevronRight size={14} className="text-text-muted" />
            </button>
          </div>

          {/* 星期 */}
          <div className="grid grid-cols-7 text-center py-2 border-b border-border-light">
            {WEEKDAYS.map((d) => (
              <span key={d} className="text-[10px] text-text-muted uppercase">{d}</span>
            ))}
          </div>

          {/* 日期 */}
          <div className="grid grid-cols-7 flex-1 overflow-y-auto">
            {calDays.map((d, i) => {
              const dayTodos = getByDate(d.date);
              const done = dayTodos.filter((t) => t.completed).length;
              const total = dayTodos.length;
              const isToday = d.date === today;
              const isSelected = d.date === selectedDate;

              return (
                <button
                  key={i}
                  onClick={() => setSelectedDate(d.date)}
                  className={`relative p-1 text-center transition-colors ${
                    isSelected ? 'bg-accent-soft' : 'hover:bg-bg-hover/50'
                  } ${!d.inMonth ? 'opacity-25' : ''}`}
                >
                  <span className={`text-[12px] inline-flex items-center justify-center w-6 h-6 rounded-full ${
                    isToday ? 'bg-accent text-white font-medium' : ''
                  }`}>
                    {d.day}
                  </span>
                  {total > 0 && (
                    <div className="text-[9px] text-text-muted mt-0.5">
                      {done}/{total}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 待办列表 */}
      <div className="flex-1 flex flex-col">
        <div className="flex items-center justify-between px-6 h-11 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-medium">
              {selectedDate === today
                ? '今日待办'
                : new Date(selectedDate + 'T00:00:00').toLocaleDateString('zh-CN', {
                    month: 'short', day: 'numeric', weekday: 'short',
                  })}
            </span>
            {selectedTodos.length > 0 && (
              <span className="text-[11px] text-text-muted">
                {selectedTodos.filter((t) => t.completed).length}/{selectedTodos.length}
              </span>
            )}
          </div>
        </div>

        {/* 添加 */}
        <div className="flex gap-2 px-6 py-2 border-b border-border-light">
          <input
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            placeholder="添加待办..."
            className="flex-1 text-[13px] border-0 focus:ring-0"
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          />
          <button
            onClick={handleAdd}
            className="text-text-muted hover:text-text transition-colors"
          >
            <Plus size={16} />
          </button>
        </div>

        {/* 列表 */}
        <div className="flex-1 overflow-y-auto">
          {selectedTodos.length === 0 ? (
            <div className="p-12 text-center text-text-muted text-[13px]">暂无待办</div>
          ) : (
            selectedTodos.map((todo) => (
              <div
                key={todo.id}
                className="flex items-center gap-3 px-6 py-2.5 group hover:bg-bg-hover/30 transition-colors"
              >
                <button
                  onClick={() => toggle(todo.id)}
                  className={`w-[18px] h-[18px] rounded-full border flex items-center justify-center transition-all shrink-0 ${
                    todo.completed
                      ? 'bg-accent border-accent'
                      : 'border-border hover:border-text-muted'
                  }`}
                >
                  {todo.completed && <Check size={10} className="text-white" strokeWidth={3} />}
                </button>
                <div className="flex-1 min-w-0">
                  <p className={`text-[13px] ${todo.completed ? 'line-through text-text-muted' : ''}`}>
                    {todo.content}
                  </p>
                  {todo.linkedMessageId && (
                    <span className="flex items-center gap-1 text-[11px] text-text-muted mt-0.5">
                      <Link2 size={9} /> 来自消息
                    </span>
                  )}
                </div>
                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${priorityDot[todo.priority]}`} />
                <button
                  onClick={() => remove(todo.id)}
                  className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-p0 transition-all"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
