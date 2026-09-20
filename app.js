/* Mile Trainer — plan generation, logging, progress tracking, pace calculator.
   All state lives in localStorage; plan math lives in planLogic.js (shared
   with the optional notification server). */

const STORAGE_KEY = 'mileTrainerState.v1';

const {
  parseTime, formatTime, addDays, daysBetween, todayStr,
  phaseForWeek, glideMileSec, trainingPaces, workoutsForWeek, buildPlan: buildPlanFor,
} = window.PlanLogic;

// ---------- state ----------
function defaultState() {
  const start = todayStr();
  return {
    settings: {
      startDate: start,
      goalDate: addDays(start, 16 * 7),
      startTimeSec: 300, // 5:00
      goalTimeSec: 280,  // 4:40
    },
    logs: [],       // {id, date, kind: 'timeTrial'|'workout', timeSec?, desc?, rpe?, notes?}
    completed: {},  // { 'w2-1': true }
    reminders: { serverUrl: '', reminderTime: '07:00', enabled: false },
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    return Object.assign(defaultState(), parsed, {
      settings: Object.assign(defaultState().settings, parsed.settings || {}),
      logs: parsed.logs || [],
      completed: parsed.completed || {},
      reminders: Object.assign(defaultState().reminders, parsed.reminders || {}),
    });
  } catch (e) {
    return defaultState();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

let state = loadState();

// ---------- plan generation ----------
function buildPlan() {
  return buildPlanFor(state.settings);
}

// ---------- rendering ----------
const tabs = document.querySelectorAll('.tab-btn');
const panels = document.querySelectorAll('.tab-panel');
tabs.forEach(btn => {
  btn.addEventListener('click', () => {
    tabs.forEach(b => b.classList.remove('active'));
    panels.forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');
    if (btn.dataset.tab === 'progress') renderProgress();
  });
});

function currentWeekInfo(plan) {
  const today = todayStr();
  const idx = plan.weeks.findIndex(w => today >= w.weekStart && today <= w.weekEnd);
  if (idx >= 0) return plan.weeks[idx];
  if (today < plan.weeks[0].weekStart) return plan.weeks[0];
  return plan.weeks[plan.weeks.length - 1];
}

function bestRecentTimeTrial() {
  const trials = state.logs.filter(l => l.kind === 'timeTrial').sort((a, b) => a.date < b.date ? 1 : -1);
  return trials[0] || null;
}

function renderDashboard(plan) {
  const { startDate, goalDate, startTimeSec, goalTimeSec } = state.settings;
  const wk = currentWeekInfo(plan);
  const daysLeft = Math.max(0, daysBetween(todayStr(), goalDate));
  const latest = bestRecentTimeTrial();
  const currentBestSec = latest ? latest.timeSec : startTimeSec;
  const gapSec = currentBestSec - goalTimeSec;

  const cards = document.getElementById('dashboardCards');
  cards.innerHTML = '';
  const stats = [
    { label: 'Goal', value: formatTime(goalTimeSec), cls: '' },
    { label: 'Current Best', value: formatTime(currentBestSec), cls: gapSec <= 0 ? '' : (gapSec > 20 ? 'bad' : 'warn') },
    { label: 'Gap to Goal', value: (gapSec <= 0 ? 'Goal met!' : formatTime(gapSec)), cls: gapSec <= 0 ? '' : (gapSec > 20 ? 'bad' : 'warn') },
    { label: 'Days Remaining', value: daysLeft, cls: '' },
    { label: 'Current Week', value: `${wk.weekNum} / ${plan.totalWeeks}`, cls: '' },
    { label: 'Phase', value: wk.phase, cls: '' },
  ];
  stats.forEach(s => {
    const el = document.createElement('div');
    el.className = `stat-card ${s.cls}`;
    el.innerHTML = `<div class="value">${s.value}</div><div class="label">${s.label}</div>`;
    cards.appendChild(el);
  });

  document.getElementById('headerSubtitle').textContent =
    `Get from ${formatTime(startTimeSec)} to ${formatTime(goalTimeSec)} by ${goalDate}`;

  const box = document.getElementById('thisWeekBox');
  box.innerHTML = `<p class="muted">${wk.weekStart} → ${wk.weekEnd} · <strong>${wk.phase}</strong></p>`;
  const list = document.createElement('div');
  wk.workouts.forEach((w, i) => {
    const key = `w${wk.weekNum}-${i}`;
    const done = !!state.completed[key];
    const item = document.createElement('div');
    item.className = 'workout-item';
    item.innerHTML = `<input type="checkbox" data-key="${key}" ${done ? 'checked' : ''}>
      <span class="day-label">${w.day}</span>
      <span class="desc ${done ? 'done' : ''}">${w.desc}</span>`;
    list.appendChild(item);
  });
  box.appendChild(list);
  box.querySelectorAll('input[type=checkbox]').forEach(cb => {
    cb.addEventListener('change', () => {
      state.completed[cb.dataset.key] = cb.checked;
      saveState();
      renderAll();
    });
  });
}

function renderPlan(plan) {
  document.getElementById('planIntro').textContent =
    `${plan.totalWeeks}-week plan from ${state.settings.startDate} to ${state.settings.goalDate}. ` +
    `Paces progress weekly along a glide path from your current mile time to your goal.`;
  const container = document.getElementById('planWeeks');
  container.innerHTML = '';
  plan.weeks.forEach(wk => {
    const block = document.createElement('div');
    block.className = 'week-block';
    const header = document.createElement('div');
    header.className = 'week-header';
    header.innerHTML = `<div><strong>Week ${wk.weekNum}</strong> · ${wk.weekStart} → ${wk.weekEnd}
        <div class="pace-line">Target mile pace this week: ${formatTime(wk.targetMileSec)}</div></div>
        <span class="phase-tag">${wk.phase}</span>`;
    header.addEventListener('click', () => block.classList.toggle('open'));

    const body = document.createElement('div');
    body.className = 'week-body';
    const paceLine = document.createElement('div');
    paceLine.className = 'pace-line';
    paceLine.textContent = `Easy: ${formatTime(wk.paces.easyPerMile)}/mi · Tempo: ${formatTime(wk.paces.tempoPerMile)}/mi ` +
      `· 400m: ${formatTime(wk.paces.interval400)} · 800m: ${formatTime(wk.paces.interval800)} · 200m: ${formatTime(wk.paces.interval200)}`;
    body.appendChild(paceLine);

    wk.workouts.forEach((w, i) => {
      const key = `w${wk.weekNum}-${i}`;
      const done = !!state.completed[key];
      const item = document.createElement('div');
      item.className = 'workout-item';
      item.innerHTML = `<input type="checkbox" data-key="${key}" ${done ? 'checked' : ''}>
        <span class="day-label">${w.day}</span>
        <span class="desc ${done ? 'done' : ''}">${w.desc}</span>`;
      body.appendChild(item);
    });

    block.appendChild(header);
    block.appendChild(body);
    container.appendChild(block);
  });
  container.querySelectorAll('input[type=checkbox]').forEach(cb => {
    cb.addEventListener('change', () => {
      state.completed[cb.dataset.key] = cb.checked;
      saveState();
      renderAll();
    });
  });
}

function renderHistory() {
  const list = document.getElementById('historyList');
  list.innerHTML = '';
  const sorted = [...state.logs].sort((a, b) => a.date < b.date ? 1 : -1);
  if (sorted.length === 0) {
    list.innerHTML = '<p class="muted">No entries yet.</p>';
    return;
  }
  sorted.forEach(log => {
    const row = document.createElement('div');
    row.className = 'history-item';
    let text;
    if (log.kind === 'timeTrial') {
      text = `<strong>${log.date}</strong> — Time Trial: ${formatTime(log.timeSec)} ${log.notes ? '· ' + log.notes : ''}`;
    } else {
      text = `<strong>${log.date}</strong> — ${log.desc} (${log.rpe})`;
    }
    row.innerHTML = `<span>${text}</span>`;
    const del = document.createElement('button');
    del.textContent = 'Delete';
    del.addEventListener('click', () => {
      state.logs = state.logs.filter(l => l.id !== log.id);
      saveState();
      renderAll();
    });
    row.appendChild(del);
    list.appendChild(row);
  });
}

function renderProgress() {
  const plan = buildPlan();
  const { startDate, goalDate, startTimeSec, goalTimeSec } = state.settings;
  const trials = state.logs.filter(l => l.kind === 'timeTrial').sort((a, b) => a.date < b.date ? -1 : 1);

  const statsBox = document.getElementById('progressStats');
  statsBox.innerHTML = '';
  const wk = currentWeekInfo(plan);
  const expectedNow = wk.targetMileSec;
  const latest = trials[trials.length - 1];
  let onTrackLabel = 'No data yet';
  let cls = '';
  if (latest) {
    const diff = latest.timeSec - expectedNow;
    if (diff <= 0) { onTrackLabel = `Ahead by ${formatTime(-diff)}`; cls = ''; }
    else if (diff <= 5) { onTrackLabel = `On track`; cls = ''; }
    else if (diff <= 15) { onTrackLabel = `Slightly behind (${formatTime(diff)})`; cls = 'warn'; }
    else { onTrackLabel = `Behind by ${formatTime(diff)}`; cls = 'bad'; }
  }
  [
    { label: 'Expected pace this week', value: formatTime(expectedNow) },
    { label: 'Latest time trial', value: latest ? formatTime(latest.timeSec) : '—' },
    { label: 'Status', value: onTrackLabel, cls },
  ].forEach(s => {
    const el = document.createElement('div');
    el.className = `stat-card ${s.cls || ''}`;
    el.innerHTML = `<div class="value">${s.value}</div><div class="label">${s.label}</div>`;
    statsBox.appendChild(el);
  });

  // SVG chart: x = days from start, y = mile time (inverted, faster = higher)
  const totalDays = daysBetween(startDate, goalDate);
  const width = Math.max(600, totalDays * 4);
  const height = 260;
  const padL = 50, padR = 20, padT = 20, padB = 30;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const yMax = Math.max(startTimeSec, ...trials.map(t => t.timeSec)) + 5;
  const yMin = Math.min(goalTimeSec, ...trials.map(t => t.timeSec)) - 5;
  const xOf = (dateStr) => padL + (daysBetween(startDate, dateStr) / totalDays) * plotW;
  const yOf = (sec) => padT + (1 - (sec - yMin) / (yMax - yMin)) * plotH;

  const glideX1 = xOf(startDate), glideY1 = yOf(startTimeSec);
  const glideX2 = xOf(goalDate), glideY2 = yOf(goalTimeSec);

  let points = trials.map(t => `<circle cx="${xOf(t.date).toFixed(1)}" cy="${yOf(t.timeSec).toFixed(1)}" r="4" fill="#5fd3a3" />`).join('');
  let pathD = trials.map((t, i) => `${i === 0 ? 'M' : 'L'} ${xOf(t.date).toFixed(1)} ${yOf(t.timeSec).toFixed(1)}`).join(' ');

  const svg = `
  <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${height - padB}" stroke="#2a3450" />
    <line x1="${padL}" y1="${height - padB}" x2="${width - padR}" y2="${height - padB}" stroke="#2a3450" />
    <line x1="${glideX1}" y1="${glideY1}" x2="${glideX2}" y2="${glideY2}" stroke="#f2a154" stroke-dasharray="5,4" stroke-width="2" />
    <text x="${glideX2 - 60}" y="${glideY2 - 8}" fill="#f2a154">Goal glide-path</text>
    ${pathD ? `<path d="${pathD}" fill="none" stroke="#5fd3a3" stroke-width="2" />` : ''}
    ${points}
    <text x="${padL}" y="${padT - 6}">${formatTime(yMax)}</text>
    <text x="${padL}" y="${height - padB + 4}" dy="10">${formatTime(yMin)}</text>
    <text x="${padL - 5}" y="${height - padB + 20}" text-anchor="start">${startDate}</text>
    <text x="${width - padR - 60}" y="${height - padB + 20}">${goalDate}</text>
  </svg>`;
  document.getElementById('chartContainer').innerHTML = svg;
}

// ---------- pace calculator (Riegel formula: T2 = T1 * (D2/D1)^1.06) ----------
function riegelPredict(t1, d1, d2) {
  return t1 * Math.pow(d2 / d1, 1.06);
}

document.getElementById('paceCalcForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const dist = parseFloat(document.getElementById('pcDistance').value);
  const timeSec = parseTime(document.getElementById('pcTime').value);
  const resultBox = document.getElementById('paceCalcResult');
  if (timeSec === null) { resultBox.innerHTML = '<p class="muted">Enter time as mm:ss</p>'; return; }
  const equivMileSec = riegelPredict(timeSec, dist, 1609.34);
  const paces = trainingPaces(equivMileSec);
  const goalPaces = trainingPaces(state.settings.goalTimeSec);
  resultBox.innerHTML = `
    <p><strong>Estimated current mile equivalent:</strong> ${formatTime(equivMileSec)}</p>
    <p class="pace-line">At current fitness — Easy: ${formatTime(paces.easyPerMile)}/mi · Tempo: ${formatTime(paces.tempoPerMile)}/mi
      · 400m: ${formatTime(paces.interval400)} · 800m: ${formatTime(paces.interval800)} · 200m: ${formatTime(paces.interval200)}</p>
    <p class="pace-line">At goal fitness (${formatTime(state.settings.goalTimeSec)} mile) — Easy: ${formatTime(goalPaces.easyPerMile)}/mi · Tempo: ${formatTime(goalPaces.tempoPerMile)}/mi
      · 400m: ${formatTime(goalPaces.interval400)} · 800m: ${formatTime(goalPaces.interval800)} · 200m: ${formatTime(goalPaces.interval200)}</p>
  `;
});

// ---------- forms ----------
document.getElementById('timeTrialForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const date = document.getElementById('ttDate').value;
  const timeSec = parseTime(document.getElementById('ttTime').value);
  const notes = document.getElementById('ttNotes').value.trim();
  if (!date || timeSec === null) return;
  state.logs.push({ id: crypto.randomUUID(), kind: 'timeTrial', date, timeSec, notes });
  saveState();
  e.target.reset();
  renderAll();
});

document.getElementById('workoutLogForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const date = document.getElementById('wlDate').value;
  const desc = document.getElementById('wlDesc').value.trim();
  const rpe = document.getElementById('wlRpe').value;
  if (!date || !desc) return;
  state.logs.push({ id: crypto.randomUUID(), kind: 'workout', date, desc, rpe });
  saveState();
  e.target.reset();
  renderAll();
});

document.getElementById('setupForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const startDate = document.getElementById('setStartDate').value;
  const goalDate = document.getElementById('setGoalDate').value;
  const startTimeSec = parseTime(document.getElementById('setStartTime').value);
  const goalTimeSec = parseTime(document.getElementById('setGoalTime').value);
  if (!startDate || !goalDate || startTimeSec === null || goalTimeSec === null) return;
  if (goalDate <= startDate) { alert('Goal date must be after start date.'); return; }
  state.settings = { startDate, goalDate, startTimeSec, goalTimeSec };
  saveState();
  renderAll();
  if (state.reminders.enabled && state.reminders.serverUrl) {
    enableReminders(state.reminders.serverUrl, state.reminders.reminderTime).catch(() => {});
  }
  document.querySelector('.tab-btn[data-tab="dashboard"]').click();
});

document.getElementById('resetBtn').addEventListener('click', () => {
  if (!confirm('This will erase all logs and settings. Continue?')) return;
  localStorage.removeItem(STORAGE_KEY);
  state = defaultState();
  populateSetupForm();
  renderAll();
});

function populateSetupForm() {
  document.getElementById('setStartDate').value = state.settings.startDate;
  document.getElementById('setGoalDate').value = state.settings.goalDate;
  document.getElementById('setStartTime').value = formatTime(state.settings.startTimeSec);
  document.getElementById('setGoalTime').value = formatTime(state.settings.goalTimeSec);
  document.getElementById('ttDate').value = todayStr();
  document.getElementById('wlDate').value = todayStr();
  document.getElementById('remServerUrl').value = state.reminders.serverUrl;
  document.getElementById('remTime').value = state.reminders.reminderTime;
  renderReminderStatus();
}

function renderAll() {
  const plan = buildPlan();
  renderDashboard(plan);
  renderPlan(plan);
  renderHistory();
  if (document.getElementById('progress').classList.contains('active')) renderProgress();
}

// ---------- PWA install prompt ----------
let deferredInstallPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  document.getElementById('installBtn').style.display = 'inline-block';
});
document.getElementById('installBtn').addEventListener('click', async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  document.getElementById('installBtn').style.display = 'none';
});

// ---------- service worker registration ----------
let swRegistration = null;
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js')
    .then((reg) => { swRegistration = reg; })
    .catch((err) => console.warn('Service worker registration failed:', err));
}

// ---------- push notifications ----------
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

function renderReminderStatus() {
  const statusEl = document.getElementById('remStatus');
  const disableBtn = document.getElementById('remDisableBtn');
  if (state.reminders.enabled) {
    statusEl.textContent = `Reminders enabled — daily at ${state.reminders.reminderTime} (${Intl.DateTimeFormat().resolvedOptions().timeZone}).`;
    disableBtn.style.display = 'inline-block';
  } else {
    statusEl.textContent = 'Reminders are not enabled.';
    disableBtn.style.display = 'none';
  }
}

async function enableReminders(serverUrl, reminderTime) {
  if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    throw new Error('Push notifications are not supported in this browser.');
  }
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Notification permission was not granted.');

  if (!swRegistration) swRegistration = await navigator.serviceWorker.ready;

  const keyRes = await fetch(`${serverUrl.replace(/\/$/, '')}/api/vapid-public-key`);
  if (!keyRes.ok) throw new Error('Could not reach the notification server.');
  const { publicKey } = await keyRes.json();

  let subscription = await swRegistration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await swRegistration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
  }

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const res = await fetch(`${serverUrl.replace(/\/$/, '')}/api/subscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscription, settings: state.settings, reminderTime, timezone }),
  });
  if (!res.ok) throw new Error('Server rejected the subscription.');

  state.reminders = { serverUrl, reminderTime, enabled: true };
  saveState();
}

async function disableReminders() {
  if (swRegistration) {
    const subscription = await swRegistration.pushManager.getSubscription();
    if (subscription) {
      try {
        await fetch(`${state.reminders.serverUrl.replace(/\/$/, '')}/api/unsubscribe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
      } catch (e) { /* server may be unreachable; still unsubscribe locally */ }
      await subscription.unsubscribe();
    }
  }
  state.reminders = { ...state.reminders, enabled: false };
  saveState();
}

document.getElementById('reminderForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const serverUrl = document.getElementById('remServerUrl').value.trim();
  const reminderTime = document.getElementById('remTime').value;
  const statusEl = document.getElementById('remStatus');
  if (!serverUrl) { statusEl.textContent = 'Enter your notification server URL first.'; return; }
  statusEl.textContent = 'Enabling…';
  try {
    await enableReminders(serverUrl, reminderTime);
    renderReminderStatus();
  } catch (err) {
    statusEl.textContent = `Error: ${err.message}`;
  }
});

document.getElementById('remDisableBtn').addEventListener('click', async () => {
  await disableReminders();
  renderReminderStatus();
});

populateSetupForm();
renderAll();
