'use client';

import { useState } from 'react';
import { MessageSquare, ListTodo, Kanban, CalendarDays } from 'lucide-react';
import MessagePanel from '@/components/MessagePanel';
import RequirementBoard from '@/components/RequirementBoard';
import TodoCalendar from '@/components/TodoCalendar';

const tabs = [
  { id: 'messages', label: '消息', icon: MessageSquare },
  { id: 'requirements', label: '需求', icon: Kanban },
  { id: 'todos', label: '待办', icon: ListTodo },
  { id: 'calendar', label: '日历', icon: CalendarDays },
] as const;

type TabId = (typeof tabs)[number]['id'];

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabId>('messages');

  return (
    <div className="flex h-screen flex-col bg-bg">
      {/* 顶部导航 */}
      <header className="flex items-center gap-6 px-6 h-12 border-b border-border shrink-0">
        <h1 className="text-sm font-semibold tracking-tight">工作站</h1>
        <nav className="flex gap-0.5">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1 text-[13px] rounded-md transition-all ${
                  active
                    ? 'text-text bg-accent-soft font-medium'
                    : 'text-text-muted hover:text-text-secondary'
                }`}
              >
                <Icon size={14} strokeWidth={1.8} />
                {tab.label}
              </button>
            );
          })}
        </nav>
        <div className="ml-auto text-[12px] text-text-muted tabular-nums">
          {new Date().toLocaleDateString('zh-CN', {
            month: 'short',
            day: 'numeric',
            weekday: 'short',
          })}
        </div>
      </header>

      {/* 内容 */}
      <main className="flex-1 overflow-hidden">
        {activeTab === 'messages' && <MessagePanel />}
        {activeTab === 'requirements' && <RequirementBoard />}
        {(activeTab === 'todos' || activeTab === 'calendar') && (
          <TodoCalendar view={activeTab === 'calendar' ? 'calendar' : 'list'} />
        )}
      </main>
    </div>
  );
}
