'use client';

import { useEffect, useState, useCallback } from 'react';
import { Send, SkipForward, ListTodo, MessageSquare, Bot, Check, ArrowUpRight } from 'lucide-react';
import { useMessageStore } from '@/lib/stores/messages';
import { useTodoStore } from '@/lib/stores/todos';
import type { DingMessage } from '@/lib/types';

const POLL_INTERVAL = 15_000; // 15s for real-time feel
const LOCAL_API = 'http://localhost:3847';

export default function MessagePanel() {
  const { messages, selectedId, loading, load, addMessage, updateDraft, markSent, markSkipped, select } =
    useMessageStore();
  const { fromMessage } = useTodoStore();
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; msg: DingMessage } | null>(null);
  const [sending, setSending] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'new' | 'done'>('all');
  const [isLocal, setIsLocal] = useState(false);

  useEffect(() => { load(); }, [load]);

  // Check if local server is available
  useEffect(() => {
    fetch(`${LOCAL_API}/api/status`)
      .then(r => r.ok ? setIsLocal(true) : setIsLocal(false))
      .catch(() => setIsLocal(false));
  }, []);

  useEffect(() => {
    async function fetchData() {
      try {
        // Priority 1: local server (real-time)
        if (isLocal) {
          try {
            const res = await fetch(`${LOCAL_API}/api/messages?t=${Date.now()}`);
            if (res.ok) {
              const data: DingMessage[] = await res.json();
              for (const msg of data) await addMessage(msg);
              return;
            }
          } catch {}
        }
        // Priority 2: static JSON (GitHub Pages / fallback)
        const res = await fetch('/data/messages.json?t=' + Date.now());
        if (!res.ok) return;
        const data: DingMessage[] = await res.json();
        for (const msg of data) await addMessage(msg);
      } catch {}
    }
    fetchData();
    const timer = setInterval(fetchData, POLL_INTERVAL);
    return () => clearInterval(timer);
  }, [addMessage, isLocal]);

  useEffect(() => {
    const close = () => setCtxMenu(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, []);

  const selected = messages.find((m) => m.id === selectedId);

  const filtered = messages.filter((m) => {
    if (filter === 'new') return m.status === 'new' || m.status === 'drafted';
    if (filter === 'done') return m.status === 'sent' || m.status === 'skipped';
    return true;
  });

  const handleSend = useCallback(async (msg: DingMessage) => {
    if (!msg.draftReply.trim()) return;
    setSending(msg.id);
    const cmd = `dws chat message send --user ${msg.senderUserId || msg.senderId} --text "${msg.draftReply.replace(/"/g, '\\"')}" --ai-tag`;
    try {
      const res = await fetch(`${LOCAL_API}/api/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: msg.senderUserId || msg.senderId, text: msg.draftReply, messageId: msg.id }),
      });
      if (res.ok) {
        markSent(msg.id, msg.draftReply);
      } else {
        await navigator.clipboard.writeText(cmd);
        markSent(msg.id, msg.draftReply);
      }
    } catch {
      await navigator.clipboard.writeText(cmd);
      markSent(msg.id, msg.draftReply);
    }
    setSending(null);
  }, [markSent]);

  const handleContextMenu = (e: React.MouseEvent, msg: DingMessage) => {
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY, msg });
  };

  const convertToTodo = (msg: DingMessage) => {
    fromMessage(msg.id, msg.content.slice(0, 100), msg.senderName);
    setCtxMenu(null);
  };

  const newCount = messages.filter((m) => m.status === 'new' || m.status === 'drafted').length;

  if (loading) {
    return <div className="flex h-full items-center justify-center text-text-muted text-sm">加载中...</div>;
  }

  return (
    <div className="flex h-full">
      {/* 左侧列表 */}
      <div className="w-[320px] border-r border-border flex flex-col bg-bg-sidebar">
        <div className="flex items-center justify-between px-4 h-11 border-b border-border">
          <div className="flex items-center gap-2">
            <MessageSquare size={13} className="text-text-muted" />
            <span className="text-[13px] font-medium">消息</span>
            {newCount > 0 && (
              <span className="text-[11px] bg-tag-new text-white rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
                {newCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isLocal && <span className="w-1.5 h-1.5 rounded-full bg-tag-sent" title="本地服务已连接" />}
            <div className="flex">
              {(['all', 'new', 'done'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`text-[12px] px-2 py-0.5 rounded transition-colors ${
                    filter === f ? 'text-text font-medium' : 'text-text-muted hover:text-text-secondary'
                  }`}
                >
                  {f === 'all' ? '全部' : f === 'new' ? '待处理' : '已处理'}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="p-12 text-center text-text-muted text-[13px]">暂无消息</div>
          ) : (
            filtered.map((msg) => (
              <div
                key={msg.id}
                onClick={() => select(msg.id)}
                onContextMenu={(e) => handleContextMenu(e, msg)}
                className={`cursor-pointer px-4 py-3 transition-colors border-b border-border-light ${
                  selectedId === msg.id ? 'bg-bg' : 'hover:bg-bg-hover'
                }`}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[13px] font-medium">{msg.senderName}</span>
                  <span className="text-[11px] text-text-muted tabular-nums">
                    {new Date(msg.receivedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-[13px] text-text-secondary truncate leading-relaxed">{msg.content}</p>
                <div className="flex items-center gap-1.5 mt-1.5">
                  <StatusDot status={msg.status} />
                  {msg.draftReply && msg.status !== 'sent' && (
                    <span className="text-[11px] text-text-muted truncate">
                      → {msg.draftReply.slice(0, 25)}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 右侧详情 */}
      <div className="flex-1 flex flex-col">
        {selected ? (
          <>
            {/* 头 */}
            <div className="px-6 h-11 flex items-center justify-between border-b border-border shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-medium">{selected.senderName}</span>
                <span className="text-[12px] text-text-muted">
                  {new Date(selected.receivedAt).toLocaleString('zh-CN', {
                    month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit',
                  })}
                </span>
              </div>
              <StatusBadge status={selected.status} />
            </div>

            {/* 内容 */}
            <div className="flex-1 overflow-y-auto px-6 py-6">
              {/* 收到的消息 */}
              <div className="max-w-md">
                <div className="bg-bg-sidebar rounded-2xl rounded-tl-md px-4 py-3 border border-border-light">
                  <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{selected.content}</p>
                </div>
              </div>

              {/* 回复区 */}
              {selected.status !== 'sent' && (
                <div className="mt-6 max-w-md">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Bot size={12} className="text-text-muted" />
                    <span className="text-[11px] text-text-muted uppercase tracking-wide">草稿</span>
                  </div>
                  <textarea
                    value={selected.draftReply}
                    onChange={(e) => updateDraft(selected.id, e.target.value)}
                    placeholder="输入回复..."
                    rows={2}
                    className="w-full resize-none text-[13px] leading-relaxed rounded-xl"
                  />
                  <div className="flex items-center gap-2 mt-3">
                    <button
                      onClick={() => handleSend(selected)}
                      disabled={!selected.draftReply.trim() || sending === selected.id}
                      className="flex items-center gap-1.5 bg-accent text-white text-[13px] px-4 py-1.5 rounded-lg hover:opacity-90 disabled:opacity-30 transition-opacity"
                    >
                      {sending === selected.id ? (
                        <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <Send size={12} />
                      )}
                      发送
                    </button>
                    <button
                      onClick={() => markSkipped(selected.id)}
                      className="flex items-center gap-1 text-text-muted hover:text-text-secondary text-[13px] px-3 py-1.5 rounded-lg hover:bg-bg-hover transition-colors"
                    >
                      <SkipForward size={12} />
                      跳过
                    </button>
                    <button
                      onClick={() => convertToTodo(selected)}
                      className="flex items-center gap-1 text-text-muted hover:text-text-secondary text-[13px] px-3 py-1.5 rounded-lg hover:bg-bg-hover transition-colors"
                    >
                      <ListTodo size={12} />
                      转待办
                    </button>
                  </div>
                </div>
              )}

              {/* 已发送 */}
              {selected.status === 'sent' && selected.sentReply && (
                <div className="mt-6 max-w-md">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Check size={12} className="text-tag-sent" />
                    <span className="text-[11px] text-tag-sent uppercase tracking-wide">已发送</span>
                  </div>
                  <div className="bg-bg-sidebar rounded-2xl rounded-tr-md px-4 py-3 border border-border-light">
                    <p className="text-[13px] leading-relaxed">{selected.sentReply}</p>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex h-full items-center justify-center text-text-muted text-[13px]">
            选择消息查看详情
          </div>
        )}
      </div>

      {/* 右键菜单 */}
      {ctxMenu && (
        <div
          className="fixed z-50 bg-white border border-border rounded-lg shadow-lg py-1 min-w-[120px]"
          style={{ left: ctxMenu.x, top: ctxMenu.y }}
        >
          <button
            onClick={() => convertToTodo(ctxMenu.msg)}
            className="w-full flex items-center gap-2 px-3 py-2 text-[13px] hover:bg-bg-hover transition-colors"
          >
            <ListTodo size={13} />
            转为待办
          </button>
          <button
            onClick={() => { markSkipped(ctxMenu.msg.id); setCtxMenu(null); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-[13px] hover:bg-bg-hover transition-colors"
          >
            <SkipForward size={13} />
            跳过
          </button>
        </div>
      )}
    </div>
  );
}

function StatusDot({ status }: { status: DingMessage['status'] }) {
  const colors = {
    new: 'bg-tag-new',
    drafted: 'bg-tag-draft',
    sent: 'bg-tag-sent',
    skipped: 'bg-tag-skip',
  };
  return <span className={`w-1.5 h-1.5 rounded-full ${colors[status]}`} />;
}

function StatusBadge({ status }: { status: DingMessage['status'] }) {
  const map = {
    new: { label: '新消息', cls: 'text-tag-new' },
    drafted: { label: '草稿', cls: 'text-tag-draft' },
    sent: { label: '已发送', cls: 'text-tag-sent' },
    skipped: { label: '已跳过', cls: 'text-text-muted' },
  };
  const { label, cls } = map[status];
  return <span className={`text-[11px] ${cls}`}>{label}</span>;
}
