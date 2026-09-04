#!/usr/bin/env node
/**
 * aisle -- which one is actually cheaper.
 *
 *   aisle "500 g $2.19" "1 kg $3.99"
 *   aisle --need 500g "500 g $2.19" "5 kg $15"
 *   cat options.txt | aisle
 */

import { parseLines, parseQuantity } from '../src/parse.js';
import { compare, verdict, money, dimLabel } from '../src/compare.js';

const USAGE = `aisle - work out which one is actually cheaper.

  aisle "<option>" ["<option>" ...]     compare options given as arguments
  cat list.txt | aisle                  compare one option per line

Options:
  -n, --need <qty>   how much you actually need, e.g. 500g, 2L, 12 rolls.
                     Ranks by what you will spend instead of price per unit.
  -u, --units <sys>  us (default) or imperial. Guessed from the currency.
      --json         machine-readable output
  -h, --help         this

An option is free text. All of these work:
  "Tide 100 fl oz $12.99"     "1.2 kg 8.49"      "3/$10, 16 oz"
  "12 x 330 ml $9.60"         "1.20/750ml"       "buy 2 get 1 free $4.50 400g"
`;

function parseArgs(argv) {
  const out = { lines: [], need: null, system: null, json: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-h' || a === '--help') out.help = true;
    else if (a === '-n' || a === '--need') out.need = argv[++i];
    else if (a === '-u' || a === '--units') out.system = argv[++i];
    else if (a === '--json') out.json = true;
    else if (a.startsWith('--need=')) out.need = a.slice(7);
    else if (a.startsWith('--units=')) out.system = a.slice(8);
    else out.lines.push(a);
  }
  return out;
}

/**
 * Only drain stdin when nothing was passed as an argument. Checking isTTY is
 * not enough -- under a CI runner or an editor task stdin is a pipe nobody
 * ever writes to or closes, and the process hangs there forever.
 */
async function readStdin(hasArgs) {
  if (hasArgs || process.stdin.isTTY) return '';
  let data = '';
  for await (const chunk of process.stdin) data += chunk;
  return data;
}

const ESC = '\u001b';
const BOLD = `${ESC}[1m`;
const DIM = `${ESC}[2m`;
const GREEN = `${ESC}[32m`;
const YELLOW = `${ESC}[33m`;
const RESET = `${ESC}[0m`;
const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const c = (code, s) => (useColor ? code + s + RESET : s);

const trimNum = (n) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100));

function render(result) {
  const cur = result.currency;
  const out = ['', c(BOLD + GREEN, '  ' + verdict(result)), ''];

  const rows = result.ranked.map((r) => {
    const notes = [];
    if (r.dealOnly) notes.push(`needs ${r.packsForBestPrice}`);
    else if (r.option.offers.length) notes.push(r.dealLabel || 'offer');
    const cells = [
      `${r.isBest ? '*' : ' '} ${r.rank}.`,
      (r.option.name || r.option.raw).slice(0, 28),
      `${trimNum(r.option.size.value)} ${r.option.size.unit.label}`,
      money(r.option.price, cur),
      `${money(r.unitPrice, cur)}/${result.basis.label}`,
    ];
    if (result.need) {
      const bonus = r.cover.bonusPacks ? `+${r.cover.bonusPacks}` : '';
      cells.push(`${money(r.cover.cost, cur)} (${r.cover.packs}${bonus})`);
      cells.push(r.cover.leftover > 0 ? `${trimNum(r.cover.leftover)} spare` : '-');
    }
    cells.push(notes.join(', '));
    return { cells, best: r.isBest };
  });

  const head = ['', 'item', 'size', 'price', `per ${result.basis.label}`];
  if (result.need) head.push('you pay', 'left over');
  head.push('');

  const widths = head.map((h, i) => Math.max(
    h.length, ...rows.map((r) => String(r.cells[i] ?? '').length),
  ));
  const line = (cells, style) => {
    const s = cells.map((x, i) => String(x ?? '').padEnd(widths[i])).join('  ').trimEnd();
    return '  ' + (style ? c(style, s) : s);
  };

  out.push(line(head, DIM));
  for (const r of rows) out.push(line(r.cells, r.best ? BOLD : null));
  out.push('');

  const foot = [];
  if (result.dealCaveat) {
    const d = result.dealCaveat;
    const alt = d.betterIfOne.option.name || 'the other one';
    foot.push(c(YELLOW, `  Only at "${d.deal}" - you must buy ${d.packs}. Buying one? ${alt} is cheaper.`));
  }
  if (result.need && result.winner.cover.leftover > 0) {
    foot.push(c(DIM, `  Leaves ${trimNum(result.winner.cover.leftover)} ${result.winner.option.size.unit.base} spare.`));
  }
  if (result.mismatch) {
    const names = result.mismatch.others
      .map((o) => `${o.name || o.raw} (${dimLabel(o)})`).join(', ');
    foot.push(c(YELLOW, `  Not measured in ${result.mismatch.mainLabel}, so not compared: ${names}`));
  }
  for (const s of result.skipped) {
    foot.push(c(YELLOW, `  Skipped "${s.raw}": ${s.problems.join('; ') || 'unparsed'}`));
  }
  if (foot.length) out.push(...foot, '');

  return out.join('\n');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { process.stdout.write(USAGE); return; }

  const stdin = await readStdin(args.lines.length > 0);
  const text = [...args.lines, ...stdin.split(/\r?\n/)].filter((l) => l && l.trim()).join('\n');
  if (!text) { process.stdout.write(USAGE); process.exitCode = 1; return; }

  const options = parseLines(text, args.system ? { system: args.system } : {});
  if (options.length === 0) { console.error('Nothing to compare.'); process.exitCode = 1; return; }

  const system = args.system || options[0].system;
  const need = args.need ? parseQuantity(args.need, system) : null;
  if (args.need && !need) {
    console.error(`Could not read --need "${args.need}". Try 500g, 2L or 12 rolls.`);
    process.exitCode = 1; return;
  }

  const result = compare(options, need ? { need } : {});
  if (!result.winner) { console.error('No option had a readable price.'); process.exitCode = 1; return; }

  if (args.json) {
    process.stdout.write(JSON.stringify({
      verdict: verdict(result),
      basis: result.basis,
      savingPct: result.savingPct,
      ranked: result.ranked.map((r) => ({
        rank: r.rank,
        name: r.option.name,
        raw: r.option.raw,
        price: r.option.price,
        size: r.option.size.value,
        unit: r.option.size.unit.label,
        unitPrice: r.unitPrice,
        packsForBestPrice: r.packsForBestPrice,
        cover: r.cover && {
          packs: r.cover.packs,
          bonusPacks: r.cover.bonusPacks,
          cost: Math.round(r.cover.cost * 100) / 100,
          leftover: r.cover.leftover,
        },
      })),
      skipped: result.skipped.map((s) => ({ raw: s.raw, problems: s.problems })),
    }, null, 2) + '\n');
    return;
  }

  process.stdout.write(render(result) + '\n');
}

main().catch((err) => { console.error(err.message); process.exitCode = 1; });
