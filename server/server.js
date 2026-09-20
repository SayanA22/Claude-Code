/* Minimal push-notification backend for the Mile Trainer PWA.
   Stores push subscriptions + each user's plan settings in a local JSON
   file, and sends a daily Web Push reminder naming that day's workout. */

const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const webpush = require('web-push');
const PlanLogic = require('../planLogic');

loadDotEnvIfPresent();

const PORT = process.env.PORT || 3001;
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@example.com';
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';

if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
  console.error('Missing VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY.');
  console.error('Run: npm run generate-vapid-keys');
  process.exit(1);
}

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'subscriptions.json');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '[]');

function loadSubscriptions() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (e) {
    return [];
  }
}

function saveSubscriptions(subs) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(subs, null, 2));
}

const app = express();
app.use(cors({ origin: ALLOWED_ORIGIN }));
app.use(express.json());

app.get('/api/vapid-public-key', (req, res) => {
  res.json({ publicKey: VAPID_PUBLIC_KEY });
});

app.post('/api/subscribe', (req, res) => {
  const { subscription, settings, reminderTime, timezone } = req.body || {};
  if (!subscription || !subscription.endpoint || !settings || !reminderTime || !timezone) {
    return res.status(400).json({ error: 'Missing subscription, settings, reminderTime, or timezone.' });
  }
  const subs = loadSubscriptions();
  const existingIdx = subs.findIndex((s) => s.subscription.endpoint === subscription.endpoint);
  const record = {
    subscription,
    settings,
    reminderTime,
    timezone,
    lastSentDate: null,
    updatedAt: new Date().toISOString(),
  };
  if (existingIdx >= 0) {
    subs[existingIdx] = { ...subs[existingIdx], ...record };
  } else {
    subs.push(record);
  }
  saveSubscriptions(subs);
  res.json({ ok: true });
});

app.post('/api/unsubscribe', (req, res) => {
  const { endpoint } = req.body || {};
  if (!endpoint) return res.status(400).json({ error: 'Missing endpoint.' });
  const subs = loadSubscriptions().filter((s) => s.subscription.endpoint !== endpoint);
  saveSubscriptions(subs);
  res.json({ ok: true });
});

app.get('/healthz', (req, res) => res.json({ ok: true }));

// ---------- daily reminder scheduler ----------
function todayInTZ(timezone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const map = {};
  parts.forEach((p) => { map[p.type] = p.value; });
  return `${map.year}-${map.month}-${map.day}`;
}

function nowHHMMInTZ(timezone) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone, hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date());
  const map = {};
  parts.forEach((p) => { map[p.type] = p.value; });
  return `${map.hour}:${map.minute}`;
}

function buildReminderPayload(record, today) {
  const plan = PlanLogic.buildPlan(record.settings);
  const result = PlanLogic.workoutsForDate(plan, today);
  if (!result) {
    return { title: 'Mile Trainer', body: 'Check your training plan for today.' };
  }
  const body = result.items.map((w) => w.desc).join(' | ');
  return { title: `Mile Trainer — Week ${result.week.weekNum} (${result.week.phase})`, body };
}

async function checkAndSendReminders() {
  const subs = loadSubscriptions();
  if (subs.length === 0) return;
  let changed = false;
  const toRemove = new Set();

  for (const record of subs) {
    let hhmm, today;
    try {
      hhmm = nowHHMMInTZ(record.timezone);
      today = todayInTZ(record.timezone);
    } catch (e) {
      continue; // invalid timezone string
    }
    if (hhmm !== record.reminderTime) continue;
    if (record.lastSentDate === today) continue;

    const payload = buildReminderPayload(record, today);
    try {
      await webpush.sendNotification(record.subscription, JSON.stringify(payload));
      record.lastSentDate = today;
      changed = true;
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) {
        toRemove.add(record.subscription.endpoint);
        changed = true;
      } else {
        console.error('Push send failed:', err.message);
      }
    }
  }

  if (changed) {
    saveSubscriptions(subs.filter((r) => !toRemove.has(r.subscription.endpoint)));
  }
}

// Align to the top of the next minute, then check once a minute.
const msToNextMinute = 60000 - (Date.now() % 60000);
setTimeout(() => {
  checkAndSendReminders();
  setInterval(checkAndSendReminders, 60000);
}, msToNextMinute);

function loadDotEnvIfPresent() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

app.listen(PORT, () => {
  console.log(`Mile Trainer notification server listening on port ${PORT}`);
});
