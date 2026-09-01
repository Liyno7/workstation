const http = require('http');
const { execFileSync, spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const PORT = 3847;
const DWS = path.join(process.env.HOME, '.local/bin/dws');
const DATA_FILE = path.join(__dirname, '../public/data/messages.json');
const REPO_DIR = path.join(__dirname, '..');
const PUSH_INTERVAL = 60_000;
const MY_USER_ID = '17851918508';
const MY_DEPT_ID = '935820020'; // AI部

// All contacts to monitor (department + extra)
let CONTACTS = [
  // AI部全员（除任翔宇）
  { name: '赵汉桐', userId: '263161083635686748' },
  { name: '杜婧怡', userId: '474655553026170102' },
  { name: '顾腾轩', userId: '661402041238579881' },
  { name: '田永乐', userId: '01640436515229708872' },
  { name: '朱浩然', userId: '15151846618' },
  { name: '曹悦昕', userId: '01553721541726126056' },
  { name: '杨曼玉', userId: '01602827406926286453' },
  { name: '李龙', userId: '16577015227494403' },
  { name: '程锦', userId: '0224172431351006715' },
  { name: '余猛', userId: '2424556455659170' },
  { name: '叶智勇', userId: '01172838596521490179' },
  { name: '廖毅明', userId: '03236335466324212543' },
  { name: '常译琪', userId: '682545150324318641' },
  { name: '吴凡', userId: '2600674819689197' },
  { name: '刘佳琦', userId: '03216624180020856619' },
  // 额外指定
  { name: '邵珠鹏', userId: '17854118106' },
  { name: '陶子', userId: '0239693708061217434' },
  { name: '刘月乐', userId: '020741623621034080' },
  { name: '袁航', userId: '28001565471116617' },
  { name: '张科峰', userId: '0313144924392799' },
];

let allMessages = [];
let knownMessageIds = new Set();
let eventProcesses = new Map(); // name -> process
const userIdCache = new Map();
let pushTimer = null;
let hasChanges = false;

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
  hasChanges = true;
  schedulePush();
}

// ===== Git push to GitHub =====
function schedulePush() {
  if (pushTimer) return;
  pushTimer = setTimeout(() => {
    pushTimer = null;
    if (!hasChanges) return;
    pushToGitHub();
    hasChanges = false;
  }, PUSH_INTERVAL);
}

function pushToGitHub() {
  try {
    execSync('git add public/data/messages.json', { cwd: REPO_DIR, timeout: 5000 });
    const status = execSync('git status --porcelain public/data/messages.json', { cwd: REPO_DIR, encoding: 'utf-8' });
    if (!status.trim()) return;
    execSync(`git commit -m "data: update messages ${new Date().toLocaleTimeString('zh-CN')}"`, { cwd: REPO_DIR, timeout: 5000 });
    execSync('git push', { cwd: REPO_DIR, timeout: 30000 });
    console.log(`[sync] ✓ pushed messages to GitHub`);
  } catch (err) {
    console.log(`[sync] push failed: ${err.message?.slice(0, 100)}`);
  }
}

// ===== Draft generation =====
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
    const out = execFileSync(DWS, ['contact', 'user', 'search', '--query', name, '--format', 'json'],
      { encoding: 'utf-8', timeout: 10000 });
    const userId = JSON.parse(out).result?.[0]?.userId || '';
    userIdCache.set(name, userId);
    return userId;
  } catch { return ''; }
}

// ===== Send via dws =====
function sendViaDws(userId, text) {
  execFileSync(DWS, ['chat', 'message', 'send', '--user', userId, '--text', text, '--ai-tag'],
    { encoding: 'utf-8', timeout: 15000 });
}

// ===== Start event listener for one contact =====
function startContactListener(contact) {
  if (eventProcesses.has(contact.name)) return; // Already listening
  if (!contact.userId) return;

  const args = ['event', 'consume', 'user_im_message_receive_o2o',
    '--user', contact.userId, '--flatten', '--format', 'ndjson'];

  const proc = spawn(DWS, args, { stdio: ['ignore', 'pipe', 'pipe'] });

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
    if (msg.includes('ready')) {
      console.log(`[event] ✓ ${contact.name}`);
    }
  });

  proc.on('close', (code) => {
    eventProcesses.delete(contact.name);
    console.log(`[event] ${contact.name} exited (${code}), restart in 5s`);
    setTimeout(() => startContactListener(contact), 5000);
  });

  proc.on('error', () => {
    eventProcesses.delete(contact.name);
    setTimeout(() => startContactListener(contact), 5000);
  });

  eventProcesses.set(contact.name, proc);
}

// ===== Handle incoming message =====
function handleIncoming(ev, contact) {
  const msgId = ev.openMessageId || ev.messageId || ev.id || '';
  const sender = ev.senderName || ev.senderNick || contact.name;
  const content = ev.text || ev.content || '';

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
      listeners: eventProcesses.size,
      contacts: CONTACTS.map(c => ({ name: c.name, userId: c.userId, listening: eventProcesses.has(c.name) })),
      messages: allMessages.length,
      newCount: allMessages.filter(m => m.status === 'new').length,
    }));
    return;
  }

  // Add a new contact dynamically
  if (req.method === 'POST' && req.url === '/api/add-contact') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const { name, userId } = JSON.parse(body);
        if (!name) throw new Error('missing name');
        const resolvedUserId = userId || lookupUserId(name);
        if (!resolvedUserId) throw new Error(`could not resolve ${name}`);
        if (CONTACTS.find(c => c.name === name)) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, existing: true }));
          return;
        }
        const contact = { name, userId: resolvedUserId };
        CONTACTS.push(contact);
        startContactListener(contact);
        console.log(`[contact] + ${name} (${resolvedUserId})`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (err) {
        res.writeHead(500); res.end(JSON.stringify({ error: err.message }));
      }
    });
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

// ===== Start =====
loadMessages();

const validContacts = CONTACTS.filter(c => c.userId);
console.log(`[init] starting ${validContacts.length} listeners...\n`);
for (const contact of validContacts) {
  startContactListener(contact);
}

server.listen(PORT, () => {
  console.log(`\n  工作站服务 http://localhost:${PORT}`);
  console.log(`  实时监听: ${validContacts.length} 个私聊`);
  console.log(`  数据: ${DATA_FILE}`);
  console.log(`  同步: 每 ${PUSH_INTERVAL / 1000}s 推送到 GitHub\n`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n[shutdown] stopping listeners...');
  eventProcesses.forEach(p => p.kill('SIGTERM'));
  if (hasChanges) pushToGitHub();
  server.close();
  process.exit(0);
});
