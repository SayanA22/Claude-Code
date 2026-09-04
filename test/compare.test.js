import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseLines, parseLine } from '../src/parse.js';
import {
  compare, costForPacks, costToCover, bestUnitPrice, packQuantity, verdict, money,
  dimLabel, keyOf,
} from '../src/compare.js';

const opts = (...lines) => parseLines(lines.join('\n'));
const g = (value) => ({ value, unit: { factor: 1 } });
const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} !~ ${b}`);

test('plain unit pricing', () => {
  const r = compare(opts('A 500 g $2.00', 'B 1 kg $3.60'));
  assert.equal(r.winner.option.name, 'b');
  near(r.winner.unitPriceRaw, 0.0036);
  assert.equal(r.basis.label, '100 g');
});

test('bigger is not always cheaper', () => {
  const r = compare(opts('A 500 g $2.00', 'B 1 kg $4.50'));
  assert.equal(r.winner.option.name, 'a');
});

test('the shared display basis switches to kg for bulk', () => {
  const r = compare(opts('A 2 kg $6', 'B 5 kg $14'));
  assert.equal(r.basis.label, 'kg');
});

test('buy 2 get 1 free prices three packs as two', () => {
  const o = parseLine('A 500g $3.00 buy 2 get 1 free');
  assert.equal(costForPacks(o, 1), 3);
  assert.equal(costForPacks(o, 2), 6);
  assert.equal(costForPacks(o, 3), 6, 'the third pack is free');
  assert.equal(costForPacks(o, 4), 9);
  const best = bestUnitPrice(o);
  assert.equal(best.packs, 3);
  near(best.perBaseUnit, 6 / 1500);
});

test('percentage off applies to every pack', () => {
  const o = parseLine('A 1 kg $10 20% off');
  assert.equal(costForPacks(o, 1), 8);
  assert.equal(costForPacks(o, 3), 24);
});

test('amount off applies to every pack and cannot go negative', () => {
  assert.equal(costForPacks(parseLine('A 1kg $10 $2 off'), 2), 16);
  assert.equal(costForPacks(parseLine('A 1kg $1 $5 off'), 1), 0);
});

test('second item half price', () => {
  const o = parseLine('A 1kg $10 second half price');
  assert.equal(costForPacks(o, 1), 10);
  assert.equal(costForPacks(o, 2), 15);
  assert.equal(costForPacks(o, 3), 25);
});

test('a multibuy-only price must be bought in whole groups', () => {
  const o = parseLine('A 500g 3 for $5');
  assert.equal(costForPacks(o, 1), 5, 'you cannot buy one at the deal rate');
  assert.equal(costForPacks(o, 3), 5);
  assert.equal(costForPacks(o, 4), 10);
});

test('a stated single price lets the basket split', () => {
  const o = parseLine('A 500g $1.99 each, 3 for $5');
  assert.equal(costForPacks(o, 1), 1.99);
  near(costForPacks(o, 4), 6.99);
});

test('cost to cover rounds up to whole packs', () => {
  const o = parseLine('A 400 g $3');
  const c = costToCover(o, 1000);
  assert.equal(c.packs, 3);
  assert.equal(c.cost, 9);
  assert.equal(c.quantity, 1200);
  assert.equal(c.leftover, 200);
});

test('cost to cover takes the free pack when it is free', () => {
  const o = parseLine('A 500g $3.00 buy 2 get 1 free');
  const c = costToCover(o, 1000);
  assert.equal(c.cost, 6);
  assert.equal(c.bonusPacks, 1, 'two packs and three cost the same');
  assert.equal(c.quantity, 1500);
});

test('needing only a little flips the ranking away from the bulk pack', () => {
  const list = opts('small 500 g $2.19', 'bulk 5 kg $15.00');
  const byUnit = compare(list);
  assert.equal(byUnit.winner.option.name, 'bulk');

  const byNeed = compare(list, { need: g(500) });
  assert.equal(byNeed.winner.option.name, 'small');
  assert.equal(byNeed.winner.cover.cost, 2.19);
  assert.equal(byNeed.ranked[1].cover.leftover, 4500);
});

test('needing a lot brings the bulk pack back', () => {
  const list = opts('small 500 g $2.19', 'bulk 5 kg $15.00');
  const r = compare(list, { need: g(5000) });
  assert.equal(r.winner.option.name, 'bulk');
  assert.equal(r.ranked[1].cover.packs, 10);
});

test('effective unit price counts what you needed, not what you carried home', () => {
  const r = compare(opts('bulk 5 kg $15.00'), { need: g(1000) });
  const row = r.winner;
  near(row.cover.effectivePerBaseUnit, 15 / 1000);
  near(row.unitPriceRaw, 15 / 5000, 1e-9);
});

test('a deal that only wins in bulk is flagged', () => {
  const r = compare(opts('A 500g $1.80', 'B 500g $2.00 buy 2 get 1 free'));
  assert.equal(r.winner.option.name, 'b');
  assert.ok(r.dealCaveat, 'B only wins if you buy three');
  assert.equal(r.dealCaveat.packs, 3);
  assert.equal(r.dealCaveat.betterIfOne.option.name, 'a');
});

test('no caveat when the winner also wins as a single pack', () => {
  const r = compare(opts('A 500g $3.00', 'B 500g $2.00 buy 2 get 1 free'));
  assert.equal(r.winner.option.name, 'b');
  assert.equal(r.dealCaveat, null);
});

test('mass against volume is reported, not fudged', () => {
  const r = compare(opts('A 500 g $2', 'B 500 g $3', 'C 1 L $4'));
  assert.equal(r.mainDim, 'mass');
  assert.equal(r.ranked.length, 2);
  assert.equal(r.mismatch.others.length, 1);
  assert.equal(r.mismatch.others[0].name, 'c');
});

test('priceless lines are skipped rather than ranked', () => {
  const r = compare(opts('A 500 g $2', 'some notes with no price'));
  assert.equal(r.ranked.length, 1);
  assert.equal(r.skipped.length, 1);
});

test('empty input is handled', () => {
  const r = compare([]);
  assert.equal(r.ranked.length, 0);
  assert.equal(r.winner, undefined);
  assert.equal(verdict(r), 'Nothing to compare yet.');
});

test('imperial and US volumes are not conflated', () => {
  const uk = compare(parseLines('A 1 pint £1.00'));
  const us = compare(parseLines('A 1 pint $1.00'));
  assert.ok(uk.winner.unitPriceRaw < us.winner.unitPriceRaw,
    'the same money buys more liquid in an imperial pint');
});

test('savings are expressed against the runner up', () => {
  const r = compare(opts('A 1 kg $8', 'B 1 kg $10'));
  assert.equal(r.savingPct, 20);
});

test('ranks and flags are assigned in order', () => {
  const r = compare(opts('A 1 kg $12', 'B 1 kg $8', 'C 1 kg $10'));
  assert.deepEqual(r.ranked.map((x) => x.option.name), ['b', 'c', 'a']);
  assert.deepEqual(r.ranked.map((x) => x.rank), [1, 2, 3]);
  assert.equal(r.ranked[0].isBest, true);
  assert.equal(r.ranked[2].pctWorse, 50);
});

test('money formats in the currency it was written in', () => {
  assert.equal(money(2.5, { symbol: '£' }), '£2.50');
  assert.equal(money(0.042, { symbol: '$' }), '$0.042', 'small unit prices keep a digit');
});

test('verdict names the winner and the saving', () => {
  const r = compare(opts('Barilla 500 g $2.19', 'Store 1 kg $3.00'));
  const v = verdict(r);
  assert.match(v, /store/i);
  assert.match(v, /100 g/);
  assert.match(v, /cheaper/);
});

test('verdict switches to total spend once a need is set', () => {
  const r = compare(opts('small 500 g $2.19', 'bulk 5 kg $15.00'), { need: g(500) });
  assert.match(verdict(r), /for what you need/);
});

test('a realistic aisle', () => {
  const r = compare(opts(
    'Tide Original 100 fl oz $12.99',
    'Tide HE 150 fl oz $17.99',
    'Persil 2 for $18, 100 fl oz',
    'Store brand 128 fl oz $8.49',
  ));
  assert.equal(r.winner.option.name, 'store brand');
  assert.equal(r.ranked.length, 4);
  assert.ok(r.savingPct > 0);
});

test('packQuantity multiplies through a multipack', () => {
  assert.equal(packQuantity(parseLine('12 x 330 ml $9.60')), 3960);
});

/* ------------------------------------------- countable things by their noun */

test('rolls and sheets are not the same count', () => {
  const r = compare(opts('A 12 rolls $5', 'C 9 rolls $4', 'B 500 sheets $6'));
  assert.equal(r.mainDim, 'count');
  assert.equal(r.basis.label, 'roll');
  assert.deepEqual(r.ranked.map((x) => x.option.name), ['a', 'c']);
  assert.equal(r.mismatch.others.length, 1);
  assert.equal(r.mismatch.others[0].name, 'b');
  assert.equal(r.mismatch.mainLabel, 'rolls');
});

test('a bare count joins the named group rather than splitting it', () => {
  const r = compare(opts('A 12 rolls $5', 'B 10 ct $4'));
  assert.equal(r.ranked.length, 2, '"12 ct" of what is obviously rolls here');
  assert.equal(r.mismatch, null);
  assert.equal(r.basis.label, 'roll');
});

test('large counts are priced per hundred', () => {
  const r = compare(opts('A 8 rolls x 1000 sheets $19.49', 'B 12 rolls x 264 sheets $24.99'));
  assert.equal(r.basis.label, '100 sheets');
  assert.equal(r.winner.option.name, 'a');
  near(r.winner.unitPriceRaw * 100, 0.244, 1e-3);
});

test('small counts are priced per one', () => {
  const r = compare(opts('A 60 tablets $12.99', 'B 40 tabs $9.49'));
  assert.equal(r.basis.label, 'tablet');
  assert.equal(r.winner.option.name, 'a');
});

test('dimLabel names counts by their noun', () => {
  assert.equal(dimLabel(parseLine('12 rolls $5')), 'rolls');
  assert.equal(dimLabel(parseLine('500 g $5')), 'mass');
  assert.equal(dimLabel(parseLine('1 L $5')), 'volume');
});

test('the largest option decides the shared basis', () => {
  const r = compare(opts('A 250 ml $2', 'B 3 L $9'));
  assert.equal(r.basis.label, 'L', 'both rows read in litres, not one each');
  assert.equal(r.ranked.length, 2);
});
