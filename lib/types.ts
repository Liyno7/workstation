// ========== 消息 ==========
export interface DingMessage {
  id: string;              // openMessageId
  senderId: string;        // senderOpenDingTalkId
  senderName: string;
  senderUserId?: string;
  content: string;
  receivedAt: string;      // ISO string
  conversationId: string;  // openConversationId
  status: 'new' | 'drafted' | 'sent' | 'skipped';
  draftReply: string;
  sentReply?: string;
}

// ========== 需求 ==========
export type RequirementStatus = 'pending' | 'in_progress' | 'done' | 'released';
export type Priority = 'P0' | 'P1' | 'P2' | 'P3';

export interface Requirement {
  id: string;
  title: string;
  status: RequirementStatus;
  priority: Priority;
  requester: string;
  project: string;
  estimatedDate: string;
  createdAt: string;
  updatedAt: string;
  notes: string;
  weekId: string; // "2026-W35"
}

// ========== 待办 ==========
export interface Todo {
  id: string;
  content: string;
  date: string;         // "2026-08-31"
  priority: 'high' | 'medium' | 'low';
  completed: boolean;
  linkedRequirementId?: string;
  linkedMessageId?: string; // 从消息转来的
  createdAt: string;
}

// ========== 导航 ==========
export type TabId = 'messages' | 'requirements' | 'todos' | 'calendar';

export interface Tab {
  id: TabId;
  label: string;
  icon: string;
}
