import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveUnit, displayBasis, plural, allUnitTokens, normaliseUnitToken,
} from '../src/units.js';

test('a US fluid ounce is not an imperial one', () => {
  assert.equal(resolveUnit('fl oz', 'us').factor, 29.5735295625);
  assert.equal(resolveUnit('fl oz', 'imperial').factor, 28.4130625);
  assert.equal(resolveUnit('pint', 'us').factor, 473.176473);
  assert.equal(resolveUnit('pint', 'imperial').factor, 568.26125);
  assert.equal(resolveUnit('gal', 'imperial').factor, 4546.09);
});

test('metric is the same in both systems', () => {
  for (const u of ['ml', 'l', 'g', 'kg']) {
    assert.equal(resolveUnit(u, 'us').factor, resolveUnit(u, 'imperial').factor, u);
  }
});

test('case and punctuation do not matter', () => {
  assert.equal(resolveUnit('KG').factor, 1000);
  assert.equal(resolveUnit('Fl. Oz.').dim, 'volume');
  assert.equal(normaliseUnitToken('  FL. OZ.  '), 'fl oz');
});

test('count units keep a canonical noun', () => {
  assert.equal(resolveUnit('rolls').base, 'roll');
  assert.equal(resolveUnit('tabs').base, 'tablet');
  assert.equal(resolveUnit('pcs').base, 'item');
  assert.equal(resolveUnit('loads').factor, 1);
});

test('unknown tokens resolve to nothing', () => {
  assert.equal(resolveUnit('banana'), null);
  assert.equal(resolveUnit(''), null);
});

test('longer unit tokens are offered first so "fl oz" beats "oz"', () => {
  const toks = allUnitTokens();
  assert.ok(toks.indexOf('fl oz') < toks.indexOf('oz'));
  for (let i = 1; i < toks.length; i++) {
    assert.ok(toks[i - 1].length >= toks[i].length, 'sorted longest first');
  }
});

test('display basis scales with magnitude', () => {
  assert.equal(displayBasis('mass', 500).label, '100 g');
  assert.equal(displayBasis('mass', 5000).label, 'kg');
  assert.equal(displayBasis('volume', 750).label, '100 ml');
  assert.equal(displayBasis('volume', 3000).label, 'L');
  assert.equal(displayBasis('count', 40, 'tablet').label, 'tablet');
  assert.equal(displayBasis('count', 8000, 'sheet').label, '100 sheets');
});

test('plural handles the awkward endings', () => {
  assert.equal(plural('sheet'), 'sheets');
  assert.equal(plural('nappy'), 'nappies');
  assert.equal(plural('wash'), 'washes');
  assert.equal(plural('items'), 'items');
});
