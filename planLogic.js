/* Pure plan-generation logic shared between the browser app and the
   notification server. No DOM dependencies — usable via <script> (exposes
   window.PlanLogic) or require() in Node (module.exports). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.PlanLogic = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {

  function parseTime(str) {
    const m = /^(\d{1,2}):(\d{2})$/.exec(String(str).trim());
    if (!m) return null;
    const min = parseInt(m[1], 10);
    const sec = parseInt(m[2], 10);
    if (sec > 59) return null;
    return min * 60 + sec;
  }

  function formatTime(totalSec) {
    totalSec = Math.round(totalSec);
    const sign = totalSec < 0 ? '-' : '';
    totalSec = Math.abs(totalSec);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${sign}${m}:${String(s).padStart(2, '0')}`;
  }

  function addDays(dateStr, days) {
    const d = new Date(dateStr + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  }

  function daysBetween(a, b) {
    const da = new Date(a + 'T00:00:00Z');
    const db = new Date(b + 'T00:00:00Z');
    return Math.round((db - da) / 86400000);
  }

  function todayStr() {
    return new Date().toISOString().slice(0, 10);
  }

  const WEEKDAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  function weekdayAbbr(dateStr) {
    const d = new Date(dateStr + 'T00:00:00Z');
    return WEEKDAY_ABBR[d.getUTCDay()];
  }

  function phaseForWeek(weekNum, totalWeeks) {
    const pct = weekNum / totalWeeks;
    if (pct <= 0.25) return 'Base Building';
    if (pct <= 0.55) return 'Aerobic Power';
    if (pct <= 0.80) return 'Threshold & VO2max';
    if (weekNum === totalWeeks) return 'Taper & Time Trial';
    return 'Race-Pace Sharpening';
  }

  function glideMileSec(weekNum, totalWeeks, startSec, goalSec) {
    const t = Math.min(1, weekNum / totalWeeks);
    return startSec + (goalSec - startSec) * t;
  }

  function trainingPaces(mileSec) {
    const per400 = mileSec / 4;
    const per800 = mileSec / 2;
    return {
      mileSec,
      interval200: per400 / 2 - 1,
      interval400: per400 - 1,
      interval800: per800 + 3,
      tempoPerMile: mileSec + 50,
      easyPerMile: mileSec + 105,
      longRunPerMile: mileSec + 115,
    };
  }

  function workoutsForWeek(weekNum, totalWeeks, phase, paces) {
    const w = [];
    const p400 = formatTime(paces.interval400);
    const p200 = formatTime(paces.interval200);
    const p800 = formatTime(paces.interval800);
    const tempo = formatTime(paces.tempoPerMile);
    const easy = formatTime(paces.easyPerMile);
    const long = formatTime(paces.longRunPerMile);

    if (phase === 'Base Building') {
      w.push({ day: 'Tue', desc: `Easy run + 6x20s strides @ ${easy}/mi pace, full recovery` });
      w.push({ day: 'Thu', desc: `Hill sprints: 6-8x10s hard uphill, walk-back recovery` });
      w.push({ day: 'Sat', desc: `Long run, easy/conversational @ ${long}/mi` });
      w.push({ day: 'Other', desc: `Easy runs or rest @ ${easy}/mi` });
    } else if (phase === 'Aerobic Power') {
      const reps = 5 + Math.min(3, Math.floor((weekNum - 1) / 2));
      w.push({ day: 'Tue', desc: `${reps}x400m @ ${p400} w/ 400m jog recovery` });
      w.push({ day: 'Thu', desc: `Tempo run: 15-20 min @ ${tempo}/mi (comfortably hard)` });
      w.push({ day: 'Sat', desc: `Long run @ ${long}/mi, last mile @ ${tempo}/mi` });
      w.push({ day: 'Other', desc: `Easy runs / rest @ ${easy}/mi` });
    } else if (phase === 'Threshold & VO2max') {
      w.push({ day: 'Tue', desc: `4-5x800m @ ${p800} w/ 2-3 min jog recovery` });
      w.push({ day: 'Thu', desc: `8-10x200m @ ${p200} w/ full recovery (speed/form)` });
      w.push({ day: 'Sat', desc: `Long run @ ${long}/mi with 2 mi @ ${tempo}/mi` });
      w.push({ day: 'Other', desc: `Easy runs / rest @ ${easy}/mi` });
    } else if (phase === 'Race-Pace Sharpening') {
      w.push({ day: 'Tue', desc: `3-4x400m @ goal pace (${p400}) w/ full recovery` });
      w.push({ day: 'Thu', desc: `5x300m @ ${p200}-pace effort, walk recovery` });
      w.push({ day: 'Sat', desc: `Medium-long run @ ${long}/mi, controlled` });
      w.push({ day: 'Other', desc: `Easy runs / extra rest day @ ${easy}/mi` });
    } else if (phase === 'Taper & Time Trial') {
      w.push({ day: 'Tue', desc: `4x200m fast @ ${p200}, full recovery (sharpen, not tired)` });
      w.push({ day: 'Thu', desc: `Easy shakeout + 4x100m strides` });
      w.push({ day: 'Sat', desc: `GOAL TIME TRIAL: run the mile, log your result!` });
      w.push({ day: 'Other', desc: `Rest or very easy jog @ ${easy}/mi` });
    }
    return w;
  }

  function buildPlan(settings) {
    const { startDate, goalDate, startTimeSec, goalTimeSec } = settings;
    const totalDays = Math.max(7, daysBetween(startDate, goalDate));
    const totalWeeks = Math.max(4, Math.min(24, Math.round(totalDays / 7)));
    const weeks = [];
    for (let w = 1; w <= totalWeeks; w++) {
      const phase = phaseForWeek(w, totalWeeks);
      const mileSec = glideMileSec(w, totalWeeks, startTimeSec, goalTimeSec);
      const paces = trainingPaces(mileSec);
      const weekStart = addDays(startDate, (w - 1) * 7);
      const weekEnd = addDays(weekStart, 6);
      weeks.push({
        weekNum: w,
        phase,
        weekStart,
        weekEnd,
        targetMileSec: mileSec,
        paces,
        workouts: workoutsForWeek(w, totalWeeks, phase, paces),
      });
    }
    return { totalWeeks, weeks };
  }

  // Find the workout(s) scheduled for a specific calendar date.
  function workoutsForDate(plan, dateStr) {
    const week = plan.weeks.find(w => dateStr >= w.weekStart && dateStr <= w.weekEnd);
    if (!week) return null;
    const abbr = weekdayAbbr(dateStr);
    const specific = week.workouts.filter(w => w.day !== 'Other' && w.day.split('/').includes(abbr));
    const items = specific.length ? specific : week.workouts.filter(w => w.day === 'Other');
    return { week, items };
  }

  return {
    parseTime, formatTime, addDays, daysBetween, todayStr, weekdayAbbr,
    phaseForWeek, glideMileSec, trainingPaces, workoutsForWeek, buildPlan, workoutsForDate,
  };
}));
