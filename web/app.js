/**
 * The page. Everything expensive already happened in src/ -- this reads the
 * inputs, runs the comparison on every keystroke, and draws the answer.
 */

import { parseLine, parseQuantity } from '../src/parse.js';
import { compare, verdict, money, dimLabel } from '../src/compare.js';

const STORE_KEY = 'aisle.v1';

const PRESETS = {
  laundry: {
    need: '',
    lines: [
      'Tide Original 100 fl oz $12.99',
      'Tide HE 150 fl oz $17.99',
      'Persil 2 for $18, 100 fl oz',
      'Store brand 128 fl oz $8.49',
    ],
  },
  pasta: {
    need: '500 g',
    lines: [
      'Barilla 500 g $2.19',
      'Bulk sack 5 kg $15.00',
      'Store brand 3 for $5, 500 g',
    ],
  },
  loo: {
    need: '',
    lines: [
      'Charmin 12 rolls x 264 sheets $24.99',
      'Scott 8 rolls x 1000 sheets $19.49',
      'Store brand 24 rolls x 200 sheets $17.99',
    ],
  },
  coffee: {
    need: '',
    lines: [
      'Lavazza 250 g £4.50',
      'Illy 3 for £15, 250 g',
      'Own brand 1 kg £12.99',
      'Instant 200 g £5.20, 20% off',
    ],
  },
};

/* ------------------------------------------------------------------- state */

const state = {
  lines: [],
  need: '',
  system: 'auto',
  seeded: false,
};

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return false;
    const saved = JSON.parse(raw);
    if (!Array.isArray(saved.lines)) return false;
    state.lines = saved.lines.filter((l) => typeof l === 'string');
    state.need = typeof saved.need === 'string' ? saved.need : '';
    state.system = ['auto', 'us', 'imperial'].includes(saved.system) ? saved.system : 'auto';
    return state.lines.length > 0;
  } catch {
    return false; // private window, blocked storage -- the page still works
  }
}

function save() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({
      lines: state.lines, need: state.need, system: state.system,
    }));
  } catch { /* nothing to do, and nothing worth telling the user */ }
}

/* ------------------------------------------------------------------- utils */

const el = (tag, className, text) => {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (text != null) n.textContent = text;
  return n;
};

const trimNum = (n) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100));

const titleCase = (s) => s.replace(/\b[a-z]/g, (c) => c.toUpperCase());

const label = (option) => (option.name ? titleCase(option.name) : option.raw);

/* ----------------------------------------------------------------- compute */

function run() {
  const parseOpts = state.system === 'auto' ? {} : { system: state.system };
  const options = state.lines.map((l) => parseLine(l, parseOpts));
  if (options.length === 0) return { options, result: null, needError: null };

  const first = compare(options);
  if (!first.winner) return { options, result: first, needError: null };

  const system = state.system === 'auto' ? options[0].system : state.system;
  const need = state.need.trim() ? parseQuantity(state.need, system) : null;

  let needError = null;
  if (state.need.trim() && !need) {
    needError = `Could not read "${state.need}". Try 500 g, 2 L or 12 rolls.`;
  } else if (need && !needFits(need, first)) {
    const want = need.unit.dim === 'count' ? `${need.unit.base}s` : need.unit.dim;
    const have = first.mainDim === 'count' ? `${first.countLabel}s` : first.mainDim;
    needError = `You asked for ${want} but these are sold by ${have}. Ranking by price per ${first.basis.label} instead.`;
  }

  const usable = need && !needError ? { need } : {};
  return { options, result: compare(options, usable), needError };
}

/** A need only applies if it measures the same kind of thing as the shelf. */
function needFits(need, result) {
  if (need.unit.dim !== result.mainDim) return false;
  if (need.unit.dim !== 'count') return true;
  return need.unit.base === 'item' || need.unit.base === result.countLabel;
}

/* ------------------------------------------------------------------ render */

const dom = {
  entry: document.getElementById('entry'),
  add: document.getElementById('add'),
  need: document.getElementById('need'),
  verdict: document.getElementById('verdict'),
  options: document.getElementById('options'),
  notes: document.getElementById('notes'),
  clear: document.getElementById('clear'),
  listTitle: document.getElementById('list-title'),
};

function renderVerdict(result, needError) {
  dom.verdict.replaceChildren();

  if (!result || !result.winner) {
    const box = el('div', 'verdict empty');
    box.append(
      el('div', 'eyebrow', 'Nothing to compare'),
      el('div', 'verdict-name', state.lines.length
        ? 'None of those had a price in them.'
        : 'Add two things from the shelf.'),
    );
    dom.verdict.append(box);
    return;
  }

  const { winner, runnerUp, savingPct, basis, currency, need } = result;
  const box = el('div', 'verdict');

  box.append(el('div', 'eyebrow', runnerUp ? 'Best value' : 'Only option'));
  box.append(el('div', 'verdict-name', label(winner.option)));

  const fig = el('div', 'verdict-figure');
  if (need) {
    fig.append(el('div', 'verdict-price', money(winner.cover.cost, currency)));
    const packs = winner.cover.packs + winner.cover.bonusPacks;
    fig.append(el('div', 'verdict-per', `for ${packs} × ${trimNum(winner.option.size.value)} ${winner.option.size.unit.label}`));
  } else {
    fig.append(el('div', 'verdict-price', money(winner.unitPrice, currency)));
    fig.append(el('div', 'verdict-per', `per ${basis.label}`));
  }
  box.append(fig);

  const note = el('p', 'verdict-note');
  if (runnerUp) {
    const gap = need
      ? runnerUp.cover.cost - winner.cover.cost
      : (runnerUp.unitPrice - winner.unitPrice);
    const amount = el('strong', null, money(gap, currency));
    note.append(
      document.createTextNode(need ? 'Saves ' : 'Saves '),
      amount,
      document.createTextNode(need
        ? ` against ${label(runnerUp.option)} — ${savingPct}% less.`
        : ` per ${basis.label} against ${label(runnerUp.option)} — ${savingPct}% less.`),
    );
  } else {
    note.textContent = `Add another to compare it against.`;
  }
  box.append(note);

  if (need && winner.cover.leftover > 0) {
    const spare = el('p', 'verdict-note');
    spare.textContent = `Leaves ${trimNum(winner.cover.leftover)} ${winner.option.size.unit.base} spare.`;
    box.append(spare);
  }

  dom.verdict.append(box);
}

function renderOptions(parsed, result) {
  dom.options.replaceChildren();

  parsed.forEach((option, index) => {
    const row = result && result.ranked.find((r) => r.option === option);
    const node = el('div', 'opt');
    if (row && row.isBest) node.classList.add('best');
    if (!row) node.classList.add('dud');

    node.append(el('div', 'rank', row ? `${row.rank}` : '—'));

    const name = el('div', 'opt-name');
    name.append(document.createTextNode(label(option)));
    if (row && row.dealOnly) name.append(el('span', 'tag', `buy ${row.packsForBestPrice}`));
    node.append(name);

    const meta = el('div', 'opt-meta');
    if (option.price === null) {
      meta.textContent = 'no price found';
    } else if (!row) {
      meta.textContent = `sold by ${dimLabel(option)} — not compared`;
    } else {
      const size = option.size.implied
        ? 'each'
        : `${trimNum(option.size.value)} ${option.size.unit.label}`;
      meta.textContent = `${size} · ${money(option.price, option.currency)}`;
    }
    node.append(meta);

    const figures = el('div', 'opt-figures');
    if (row) {
      const cur = result.currency;
      if (result.need) {
        figures.append(el('div', 'opt-unit', money(row.cover.cost, cur)));
        const bits = [`${row.cover.packs + row.cover.bonusPacks} pack${row.cover.packs + row.cover.bonusPacks === 1 ? '' : 's'}`];
        if (row.cover.leftover > 0) bits.push(`${trimNum(row.cover.leftover)} spare`);
        figures.append(el('div', 'opt-delta', bits.join(' · ')));
      } else {
        figures.append(el('div', 'opt-unit', `${money(row.unitPrice, cur)}`));
        figures.append(el('div', 'opt-delta', row.isBest
          ? `per ${result.basis.label}`
          : `+${row.pctWorse}%`));
      }
    }
    node.append(figures);

    const remove = el('button', 'remove', '×');
    remove.type = 'button';
    remove.setAttribute('aria-label', `Remove ${label(option)}`);
    remove.addEventListener('click', () => {
      state.lines.splice(index, 1);
      save();
      draw();
    });
    node.append(remove);

    dom.options.append(node);
  });

  dom.listTitle.textContent = parsed.length
    ? `On the shelf · ${parsed.length}`
    : 'On the shelf';
  dom.clear.hidden = parsed.length === 0;
}

function renderNotes(result, needError) {
  dom.notes.replaceChildren();
  const add = (mark, text, quiet) => {
    const n = el('div', quiet ? 'note quiet' : 'note');
    n.append(el('span', 'note-mark', mark), el('span', null, text));
    dom.notes.append(n);
  };

  if (needError) add('!', needError);
  if (!result) return;

  if (result.dealCaveat) {
    const d = result.dealCaveat;
    add('!', `That price needs ${d.packs} of them (${d.deal}). Buying one, ${label(d.betterIfOne.option)} is cheaper.`);
  }

  if (result.mismatch) {
    const names = result.mismatch.others
      .map((o) => `${label(o)} (${dimLabel(o)})`).join(', ');
    add('≠', `Not sold by ${result.mismatch.mainLabel}, so left out: ${names}`, true);
  }

  for (const s of result.skipped) {
    add('?', `“${s.raw}” — ${s.problems.join('; ') || 'could not read that'}`, true);
  }
}

function draw() {
  const { options, result, needError } = run();
  renderVerdict(result, needError);
  renderOptions(options, result && result.winner ? result : null);
  renderNotes(result && result.winner ? result : null, needError);
}

/* ------------------------------------------------------------------ events */

function addEntry() {
  const text = dom.entry.value.trim();
  if (!text) return;
  // A paste of several shelf labels at once should add all of them.
  const parts = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  state.lines.push(...parts);
  dom.entry.value = '';
  state.seeded = false;
  save();
  draw();
  dom.entry.focus();
}

dom.add.addEventListener('click', addEntry);
dom.entry.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); addEntry(); }
});

dom.need.addEventListener('input', () => {
  state.need = dom.need.value;
  save();
  draw();
});

dom.clear.addEventListener('click', () => {
  state.lines = [];
  state.need = '';
  dom.need.value = '';
  save();
  draw();
  dom.entry.focus();
});

for (const btn of document.querySelectorAll('.seg button')) {
  btn.addEventListener('click', () => {
    state.system = btn.dataset.sys;
    for (const other of document.querySelectorAll('.seg button')) {
      other.setAttribute('aria-pressed', String(other === btn));
    }
    save();
    draw();
  });
}

for (const btn of document.querySelectorAll('[data-preset]')) {
  btn.addEventListener('click', () => {
    const preset = PRESETS[btn.dataset.preset];
    state.lines = [...preset.lines];
    state.need = preset.need;
    dom.need.value = preset.need;
    save();
    draw();
  });
}

/* -------------------------------------------------------------------- boot */

// Open on a worked example rather than an empty box, so the first look shows
// what the page does. Anything the visitor saved wins over it.
if (!load()) {
  state.lines = [...PRESETS.laundry.lines];
  state.need = PRESETS.laundry.need;
  state.seeded = true;
}

dom.need.value = state.need;
for (const btn of document.querySelectorAll('.seg button')) {
  btn.setAttribute('aria-pressed', String(btn.dataset.sys === state.system));
}
draw();
