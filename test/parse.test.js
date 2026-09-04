import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseLine, parseLines, detectCurrency, systemForCurrency, parseQuantity,
} from '../src/parse.js';

const q = (line) => {
  const o = parseLine(line);
  return { price: o.price, base: o.size.value * o.size.unit.factor, dim: o.size.unit.dim, o };
};

test('price before size', () => {
  const r = q('$12.99 Tide 100 fl oz');
  assert.equal(r.price, 12.99);
  assert.ok(Math.abs(r.base - 2957.35) < 0.1);
});

test('price after size', () => {
  const r = q('Tide Original 100 fl oz $12.99');
  assert.equal(r.price, 12.99);
  assert.equal(r.o.name, 'tide original');
});

test('bare number is read as the price', () => {
  const r = q('rice 1.2 kg 8.49');
  assert.equal(r.price, 8.49);
  assert.equal(r.base, 1200);
});

test('pence and cents', () => {
  assert.equal(parseLine('beans 400g 89p').price, 0.89);
  assert.equal(parseLine('gum 12 pieces 75c').price, 0.75);
});

test('multipack multiplies out', () => {
  const r = q('12 x 330 ml $9.60 cola');
  assert.equal(r.base, 3960);
  assert.equal(r.o.size.packs, 12);
  assert.equal(r.o.size.each, 330);
});

test('pack-of form', () => {
  assert.equal(q('24 pack of 500ml water $11').base, 12000);
});

test('nested count units keep the noun', () => {
  const r = parseLine('Charmin 12 rolls x 264 sheets $24.99');
  assert.equal(r.size.value, 3168);
  assert.equal(r.size.unit.label, 'sheet');
});

test('unit price given directly', () => {
  const r = q('$3 per kg potatoes');
  assert.equal(r.price, 3);
  assert.equal(r.base, 1000);
});

test('slash form is a unit price, not a multibuy', () => {
  const r = parseLine('£1.20/750ml olive oil');
  assert.equal(r.price, 1.2);
  assert.equal(r.size.value, 750);
  assert.equal(r.offers.length, 0, 'must not read "20 for 750" out of "1.20/750"');
});

test('fl oz survives punctuation and case', () => {
  for (const s of ['64 FL. OZ. $5', '64 fl oz $5', '64floz $5']) {
    assert.equal(parseLine(s).size.unit.dim, 'volume', s);
  }
});

test('plain oz is mass, fl oz is volume', () => {
  assert.equal(parseLine('16 oz $3').size.unit.dim, 'mass');
  assert.equal(parseLine('16 fl oz $3').size.unit.dim, 'volume');
});

test('currency picks the measurement system', () => {
  assert.equal(detectCurrency('£5.00').code, 'GBP');
  assert.equal(systemForCurrency('GBP'), 'imperial');
  assert.equal(systemForCurrency('USD'), 'us');
  const uk = parseLine('cider 1 pint £2.40');
  const us = parseLine('cider 1 pint $2.40');
  assert.ok(uk.size.unit.factor > us.size.unit.factor, 'imperial pint is the larger one');
  assert.ok(Math.abs(uk.size.unit.factor - 568.26125) < 0.001);
  assert.ok(Math.abs(us.size.unit.factor - 473.176473) < 0.001);
});

test('explicit system overrides the currency guess', () => {
  const r = parseLine('1 pint $2.40', { system: 'imperial' });
  assert.ok(Math.abs(r.size.unit.factor - 568.26125) < 0.001);
});

test('offers: n for', () => {
  assert.deepEqual(parseLine('2 for $7, 500 g pasta').offers, [{ kind: 'n_for', n: 2, price: 7 }]);
  assert.deepEqual(parseLine('3/$10, 16 oz salsa').offers, [{ kind: 'n_for', n: 3, price: 10 }]);
});

test('offers: buy n get m free, and bogof', () => {
  assert.deepEqual(parseLine('buy 2 get 1 free $4.50 400g').offers,
    [{ kind: 'buy_n_get_m_free', buy: 2, free: 1 }]);
  assert.deepEqual(parseLine('BOGOF £3.00 250g').offers,
    [{ kind: 'buy_n_get_m_free', buy: 1, free: 1 }]);
  assert.deepEqual(parseLine('buy one get one free $3.00 250g').offers,
    [{ kind: 'buy_n_get_m_free', buy: 1, free: 1 }]);
});

test('offers: percentage and amount off', () => {
  assert.deepEqual(parseLine('20% off $9.99 1 L').offers, [{ kind: 'pct_off', pct: 20 }]);
  assert.deepEqual(parseLine('save $2 $9.99 1 L').offers, [{ kind: 'amount_off', amount: 2 }]);
  assert.deepEqual(parseLine('$2 off $9.99 1 L').offers, [{ kind: 'amount_off', amount: 2 }]);
});

test('offers: second item half price', () => {
  assert.deepEqual(parseLine('second half price $4 500g').offers,
    [{ kind: 'buy_n_get_m_pct', buy: 1, discounted: 1, pct: 50 }]);
  assert.deepEqual(parseLine('buy 2 get 1 at 50% off $4 500g').offers,
    [{ kind: 'buy_n_get_m_pct', buy: 2, discounted: 1, pct: 50 }]);
});

test('a multibuy-only price is flagged as such', () => {
  assert.equal(parseLine('3 for $5, 500g').priceFromOffer, true);
  assert.equal(parseLine('3 for $5, $1.99 each, 500g').priceFromOffer, false);
});

test('missing pieces are reported, not thrown', () => {
  const noPrice = parseLine('just some words');
  assert.equal(noPrice.price, null);
  assert.ok(noPrice.problems.includes('no price found'));
  const noSize = parseLine('eggs $4.99');
  assert.equal(noSize.size.unit.dim, 'count');
  assert.ok(noSize.problems.some((p) => p.startsWith('no size')));
});

test('thousands separators', () => {
  assert.equal(parseLine('bulk rice 25 kg $1,299.00').price, 1299);
});

test('parseLines skips blanks', () => {
  assert.equal(parseLines('a 1kg $2\n\n  \nb 2kg $3').length, 2);
});

test('parseQuantity reads what you actually need', () => {
  assert.deepEqual(
    { v: parseQuantity('500g').value, u: parseQuantity('500g').unit.base },
    { v: 500, u: 'g' },
  );
  assert.equal(parseQuantity('2 L').unit.factor, 1000);
  assert.equal(parseQuantity('12 rolls').unit.base, 'roll');
  assert.equal(parseQuantity('3').unit.base, 'item', 'a bare number means items');
  assert.equal(parseQuantity('16 fl oz', 'imperial').unit.factor, 28.4130625);
  assert.equal(parseQuantity('a lot'), null);
  assert.equal(parseQuantity('0 g'), null);
  assert.equal(parseQuantity(''), null);
});
