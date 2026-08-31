const http = require('http');
const { execFileSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const PORT = 3847;
const DATA_FILE = path.join(__dirname, '../public/data/messages.json');

// Private chat contacts to monitor
const CONTACTS = [
  { name: '刘佳琦', userId: '03216624180020856619' },
  { name: '邵珠鹏', userId: '' },
  { name: '陶子', userId: '' },
  { name: '杜婧怡', userId: '474655553026170102' },
  { name: '吴凡', userId: '' },
];

let allMessages = [];
let knownMessageIds = new Set();
let eventProcesses = [];
const userIdCache = new Map();

// ===== Data =====
function loadMessages() {
  try {
    allMessages = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    allMessages.forEach(m => knownMessageIds.add(m.id));
    console.log(`[init] ${allMessages.length} messages loaded`);
  } catch { allMessages = []; }
}

function saveMessages() {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(allMessages, null, 2));
}

// ===== Draft generation (based on digital twin skill) =====
function generateDraft(content) {
  const c = content.toLowerCase();
  if (/哈喽|你好|hi|hello/.test(c) && content.length < 20) return '哈喽~';
  if (/权限|开通|账号/.test(c)) return '好的，这边看下';
  if (/bug|问题|报错|异常|不行|不能|失败/.test(c)) return '稍等我看下';
  if (/需求|功能|排期|上线/.test(c)) return 'ok 我确认下';
  if (/怎么|如何|为什么|啥/.test(c) && /[？?]/.test(c)) return '这个我确认下回复你';
  if (/谢谢|感谢|辛苦/.test(c)) return 'ok';
  if (/^(ok|好的|对的|可以|行|嗯|是)/.test(c) && c.length < 15) return '嗯嗯';
  if (/改|修改|更改|调整/.test(c)) return '好的 我看看';
  if (/什么时候|多久|几天/.test(c)) return '我确认下回复你';
  return '稍等我确认下';
}

// ===== Resolve userId =====
function lookupUserId(name) {
  if (userIdCache.has(name)) return userIdCache.get(name);
  try {
    const out = execFileSync('dws', ['contact', 'user', 'search', '--query', name, '--format', 'json'],
      { encoding: 'utf-8', timeout: 10000 });
    const userId = JSON.parse(out).result?.[0]?.userId || '';
    userIdCache.set(name, userId);
    return userId;
  } catch { return ''; }
}

// ===== Send via dws =====
function sendViaDws(userId, text) {
  execFileSync('dws', ['chat', 'message', 'send', '--user', userId, '--text', text, '--ai-tag'],
    { encoding: 'utf-8', timeout: 15000 });
}

// ===== Start event listener for one contact =====
function startContactListener(contact) {
  const args = ['event', 'consume', 'user_im_message_receive_o2o',
    '--user', contact.userId, '--flatten', '--format', 'ndjson'];

  console.log(`[event] subscribing: ${contact.name} (${contact.userId})`);

  const proc = spawn('dws', args, { stdio: ['ignore', 'pipe', 'pipe'] });

  proc.stdout.on('data', (chunk) => {
    for (const line of chunk.toString().split('\n').filter(Boolean)) {
      try {
        const ev = JSON.parse(line);
        handleIncoming(ev, contact);
      } catch {}
    }
  });

  proc.stderr.on('data', (chunk) => {
    const msg = chunk.toString().trim();
    // "ready" line means subscription is active
    if (msg.includes('ready')) {
      console.log(`[event] ✓ ${contact.name} listening`);
    } else if (msg.startsWith('{')) {
      // JSON error - likely missing userId, skip silently
    }
  });

  proc.on('close', (code) => {
    console.log(`[event] ${contact.name} exited (${code}), restart in 5s`);
    setTimeout(() => startContactListener(contact), 5000);
  });

  proc.on('error', () => {
    setTimeout(() => startContactListener(contact), 5000);
  });

  eventProcesses.push(proc);
}

// ===== Handle incoming message =====
function handleIncoming(ev, contact) {
  const msgId = ev.openMessageId || ev.messageId || ev.id || '';
  const sender = ev.senderName || ev.senderNick || contact.name;
  const content = ev.text || ev.content || '';

  // Skip: own messages, empty, duplicates
  if (sender === '任翔宇' || !content || !msgId) return;
  if (knownMessageIds.has(msgId)) return;

  knownMessageIds.add(msgId);

  let userId = userIdCache.get(sender) || contact.userId;
  if (!userId) userId = lookupUserId(sender);

  const msg = {
    id: msgId,
    senderId: ev.senderOpenDingtalkId || ev.senderId || '',
    senderName: sender,
    senderUserId: userId,
    content,
    receivedAt: ev.createTime || new Date().toISOString(),
    conversationId: ev.openConversationId || '',
    status: 'new',
    draftReply: generateDraft(content),
  };

  allMessages.unshift(msg);
  // Keep max 200 messages
  if (allMessages.length > 200) allMessages = allMessages.slice(0, 200);
  saveMessages();

  console.log(`[msg] ✉ ${sender}: ${content.slice(0, 60)}`);
}

// ===== HTTP Server =====
const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  if (req.method === 'GET' && req.url === '/api/messages') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(allMessages));
    return;
  }

  if (req.method === 'GET' && req.url === '/api/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      running: true,
      listeners: eventProcesses.length,
      messages: allMessages.length,
      newCount: allMessages.filter(m => m.status === 'new').length,
    }));
    return;
  }

  if (req.method === 'POST' && req.url === '/api/send') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const { userId, text, messageId } = JSON.parse(body);
        if (!userId || !text) throw new Error('missing userId or text');
        sendViaDws(userId, text);
        console.log(`[send] → ${userId}: ${text.slice(0, 50)}`);
        const msg = allMessages.find(m => m.id === messageId || m.senderUserId === userId);
        if (msg) { msg.status = 'sent'; msg.sentReply = text; saveMessages(); }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (err) {
        res.writeHead(500); res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  if (req.method === 'POST' && req.url === '/api/skip') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const { id } = JSON.parse(body);
        const msg = allMessages.find(m => m.id === id);
        if (msg) { msg.status = 'skipped'; saveMessages(); }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (err) { res.writeHead(500); res.end(JSON.stringify({ error: err.message })); }
    });
    return;
  }

  res.writeHead(404); res.end('Not found');
});

// ===== Init: resolve missing userIds =====
function resolveContacts() {
  for (const c of CONTACTS) {
    if (!c.userId) {
      c.userId = lookupUserId(c.name);
      if (c.userId) console.log(`[init] resolved ${c.name} → ${c.userId}`);
      else console.log(`[init] ⚠ could not resolve ${c.name}`);
    }
  }
}

// ===== Start =====
loadMessages();
resolveContacts();

// Start listeners for contacts with valid userId
const validContacts = CONTACTS.filter(c => c.userId);
for (const contact of validContacts) {
  startContactListener(contact);
}

server.listen(PORT, () => {
  console.log(`\n  工作站服务 http://localhost:${PORT}`);
  console.log(`  实时监听: ${validContacts.length} 个私聊`);
  console.log(`  数据: ${DATA_FILE}\n`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n[shutdown] stopping listeners...');
  eventProcesses.forEach(p => p.kill('SIGTERM'));
  server.close();
  process.exit(0);
});
