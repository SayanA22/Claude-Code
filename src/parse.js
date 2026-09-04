/**
 * Parser for the way people actually write down a price in a shop.
 *
 * The input is one line of free text. There is no field order to rely on --
 * shelf labels, receipts and typed notes put the price first, last or in the
 * middle, and the offer is usually a separate scrap of text stuck alongside.
 * So we extract by pattern, blanking each match as we consume it, and whatever
 * survives is the product name.
 */

import { allUnitTokens, resolveUnit, normaliseUnitToken } from './units.js';

const CURRENCIES = {
  '$': 'USD', '£': 'GBP', '€': 'EUR', '¥': 'JPY', '₹': 'INR',
  '₩': 'KRW', 'R$': 'BRL', 'C$': 'CAD', 'A$': 'AUD', 'kr': 'SEK',
};

const NUM = String.raw`\d+(?:\.\d+)?`;
const CUR = String.raw`[$£€¥₹₩]`;

/** Longest-first alternation of every unit token, escaped for regex use. */
const UNIT_ALT = allUnitTokens()
  .map((u) => u.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  .join('|');

/** Blank out a matched span so later patterns cannot re-consume it. */
function blank(str, start, end) {
  return str.slice(0, start) + ' '.repeat(end - start) + str.slice(end);
}

function toNumber(raw) {
  // "1,299.99" -> 1299.99 ; a comma is a thousands separator only when it is
  // followed by exactly three digits and more digits do not follow.
  return parseFloat(String(raw).replace(/,(?=\d{3}\b)/g, '').replace(/,/g, '.'));
}

/** Detect the currency, which also decides US vs imperial fluid measure. */
export function detectCurrency(text) {
  for (const sym of ['R$', 'C$', 'A$']) {
    if (text.includes(sym)) return { symbol: sym, code: CURRENCIES[sym] };
  }
  const m = text.match(new RegExp(CUR));
  if (m) return { symbol: m[0], code: CURRENCIES[m[0]] };
  return null;
}

/**
 * Imperial measure follows the currency, because that is the only signal a
 * shelf label gives you. A "pint" priced in £ is 568 ml; the same word priced
 * in $ is 473 ml.
 */
export function systemForCurrency(code) {
  return code === 'GBP' ? 'imperial' : 'us';
}

/* ------------------------------------------------------------------ offers */

/**
 * Offers are returned as a small tagged union. Each one knows how to price an
 * arbitrary number of packs, which is what makes "cost to cover what I need"
 * computable later in compare.js.
 */
function parseOffer(work) {
  let text = work;
  const found = [];

  const take = (re, build) => {
    const m = text.match(re);
    if (!m) return;
    const built = build(m);
    if (!built) return;
    found.push(built);
    text = blank(text, m.index, m.index + m[0].length);
  };

  // "buy 2 get 1 free" / "bogo" / "b1g1" / "buy one get one free"
  take(/\bbuy\s*(\d+)\s*get\s*(\d+)\s*free\b/, (m) => ({
    kind: 'buy_n_get_m_free', buy: +m[1], free: +m[2],
  }));
  take(/\b(?:bogof?|b1g1f?|buy\s*one\s*get\s*one\s*free)\b/, () => ({
    kind: 'buy_n_get_m_free', buy: 1, free: 1,
  }));

  // "buy 2 get 1 half price" / "buy 1 get 1 50% off" / "second half price"
  take(new RegExp(String.raw`\bbuy\s*(\d+)\s*get\s*(\d+)?\s*(?:at\s*)?(?:half[- ]price|50%\s*off)\b`), (m) => ({
    kind: 'buy_n_get_m_pct', buy: +m[1], discounted: m[2] ? +m[2] : 1, pct: 50,
  }));
  take(new RegExp(String.raw`\bbuy\s*(\d+)\s*get\s*(\d+)?\s*(?:at\s*)?(${NUM})%\s*off\b`), (m) => ({
    kind: 'buy_n_get_m_pct', buy: +m[1], discounted: m[2] ? +m[2] : 1, pct: toNumber(m[3]),
  }));
  take(/\b(?:2nd|second)\s*(?:one\s*)?half[- ]price\b/, () => ({
    kind: 'buy_n_get_m_pct', buy: 1, discounted: 1, pct: 50,
  }));

  // "3 for $10" / "3/$10" / "2 for 7" -- the lookbehind keeps "$1.20/750ml"
  // from being read as "20 for 750".
  take(new RegExp(String.raw`(?<![\d.])(\d+)\s*(?:for|@)\s*(${CUR})?\s*(${NUM})\b`), (m) => {
    const n = +m[1];
    if (n < 2 || n > 100) return null;
    return { kind: 'n_for', n, price: toNumber(m[3]) };
  });
  take(new RegExp(String.raw`(?<![\d.])(\d+)\s*\/\s*(${CUR})\s*(${NUM})`), (m) => {
    const n = +m[1];
    if (n < 2 || n > 100) return null;
    return { kind: 'n_for', n, price: toNumber(m[3]) };
  });

  // "20% off" / "save 20%"
  take(new RegExp(String.raw`\b(?:save\s*)?(${NUM})\s*%\s*(?:off\b|\s*$)`), (m) => ({
    kind: 'pct_off', pct: toNumber(m[1]),
  }));

  // "$2 off" / "save $2"
  take(new RegExp(String.raw`(?:\bsave\s+)?${CUR}\s*(${NUM})\s*off\b`), (m) => ({
    kind: 'amount_off', amount: toNumber(m[1]),
  }));
  take(new RegExp(String.raw`\bsave\s*${CUR}\s*(${NUM})`), (m) => ({
    kind: 'amount_off', amount: toNumber(m[1]),
  }));

  return { offers: found, text };
}

/* ------------------------------------------------------------------- price */

function parsePrice(work) {
  let text = work;
  let price = null;
  let perUnitToken = null;

  const take = (re, handle) => {
    if (price !== null) return;
    const m = text.match(re);
    if (!m) return;
    const ok = handle(m);
    if (ok === false) return;
    text = blank(text, m.index, m.index + m[0].length);
  };

  // "$3 per kg" / "£1.20 / 100g" -- the price is already a unit price, so the
  // quantity it refers to becomes the pack size.
  take(new RegExp(String.raw`${CUR}\s*(${NUM})\s*(?:\/|\bper\b|\bea\b)\s*(${NUM})?\s*(${UNIT_ALT})\b`, 'i'), (m) => {
    price = toNumber(m[1]);
    perUnitToken = { qty: m[2] ? toNumber(m[2]) : 1, unit: m[3] };
  });

  // "$12.99" / "£1.20" / "12.99 USD" / "99p"
  take(new RegExp(String.raw`${CUR}\s*(${NUM})`), (m) => { price = toNumber(m[1]); });
  take(new RegExp(String.raw`\b(${NUM})\s*(?:usd|gbp|eur|dollars?|euros?|pounds?)\b`, 'i'), (m) => { price = toNumber(m[1]); });
  take(new RegExp(String.raw`\b(\d+)\s*p\b`), (m) => { price = toNumber(m[1]) / 100; });
  take(new RegExp(String.raw`\b(\d+)\s*(?:c|cents?)\b`), (m) => { price = toNumber(m[1]) / 100; });

  return { price, perUnitToken, text };
}

/* -------------------------------------------------------------------- size */

function parseSize(work, system) {
  let text = work;
  let size = null;

  const take = (re, handle) => {
    if (size !== null) return;
    const m = text.match(re);
    if (!m) return;
    if (handle(m) === false) return;
    text = blank(text, m.index, m.index + m[0].length);
  };

  // Multipacks where both numbers matter: "12 x 330 ml", "24 pack of 500ml",
  // "12 rolls x 264 sheets". Total = outer * inner.
  take(new RegExp(String.raw`\b(${NUM})\s*(?:${UNIT_ALT})?\s*(?:x|×|\*)\s*(${NUM})\s*(${UNIT_ALT})\b`, 'i'), (m) => {
    const u = resolveUnit(m[3], system);
    if (!u) return false;
    size = { value: toNumber(m[1]) * toNumber(m[2]), unit: u, packs: toNumber(m[1]), each: toNumber(m[2]) };
  });
  take(new RegExp(String.raw`\b(${NUM})\s*(?:pack|pk|ct|count)\s*(?:of\s*)?(${NUM})\s*(${UNIT_ALT})\b`, 'i'), (m) => {
    const u = resolveUnit(m[3], system);
    if (!u) return false;
    size = { value: toNumber(m[1]) * toNumber(m[2]), unit: u, packs: toNumber(m[1]), each: toNumber(m[2]) };
  });

  // Plain "500 g", "1.2kg", "100 fl oz", "12 rolls".
  take(new RegExp(String.raw`\b(${NUM})\s*(${UNIT_ALT})(?![a-z])`, 'i'), (m) => {
    const u = resolveUnit(m[2], system);
    if (!u) return false;
    size = { value: toNumber(m[1]), unit: u };
  });

  return { size, text };
}

/* ------------------------------------------------------------------- entry */

/**
 * Parse one line into a comparable option.
 *
 * Returns { name, price, size, offers, system, currency, problems }.
 * `problems` lists what is missing rather than throwing, because a half-parsed
 * line should still show up in the UI with a useful complaint attached.
 */
export function parseLine(line, opts = {}) {
  const raw = String(line).trim();
  const currency = detectCurrency(raw);
  const system = opts.system || systemForCurrency(currency?.code);

  // Lowercase for matching, but keep the original to recover the name casing.
  let work = raw
    .toLowerCase()
    .replace(/(\d),(?=\d{3}(?!\d))/g, '$1')   // 1,299.00 -> 1299.00
    .replace(/(\d),(\d{1,2})(?!\d)/g, '$1.$2') // European 1,50 -> 1.50
    .replace(/[,;]/g, ' ')                     // any comma left just separates
    .replace(/\s+/g, ' ');
  // "fl. oz." and "fl oz" must survive as one token.
  work = work.replace(/fl\.?\s*oz\.?/g, 'floz');

  const offerPass = parseOffer(work);
  const pricePass = parsePrice(offerPass.text);
  const sizePass = parseSize(pricePass.text, system);

  let size = sizePass.size;
  let price = pricePass.price;

  // "$3 per kg" with no separate size: the per-clause is the size.
  if (!size && pricePass.perUnitToken) {
    const u = resolveUnit(pricePass.perUnitToken.unit, system);
    if (u) size = { value: pricePass.perUnitToken.qty, unit: u };
  }

  // A bare trailing number with no currency mark is a price: "1.2 kg 8.49".
  let leftover = sizePass.text;
  if (price === null) {
    const m = leftover.match(new RegExp(String.raw`(?<![\d.])(${NUM})(?![\d.])`));
    if (m) {
      price = toNumber(m[1]);
      leftover = blank(leftover, m.index, m.index + m[0].length);
    }
  }

  // An offer of the form "3 for $10" with no other price *is* the price -- but
  // only in threes. Flag that, because a shelf offering three for ten dollars
  // very often will not sell you one for $3.33, and a comparison that quietly
  // assumes it will is wrong in the shopper's favour.
  const nFor = offerPass.offers.find((o) => o.kind === 'n_for');
  let priceFromOffer = false;
  if (price === null && nFor) {
    price = nFor.price / nFor.n;
    priceFromOffer = true;
  }

  // No unit anywhere means we are comparing whole items: "eggs $4.99" is one
  // pack, and a count comparison is still a valid comparison.
  if (!size) size = { value: 1, unit: resolveUnit('item', system), implied: true };

  const name = leftover
    // Only the words that belong to price grammar. Stripping articles as well
    // would erase "A" and "B", which is what people label options with.
    .replace(/\b(?:for|each|ea|per|of|off|save|buy|get|free|only|now|was)\b/g, ' ')
    .replace(/[^a-z0-9 %&+'-]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const problems = [];
  if (price === null) problems.push('no price found');
  if (size.implied) problems.push('no size found — treating as 1 item');

  return {
    raw,
    name: name || null,
    price,
    size,
    offers: offerPass.offers,
    priceFromOffer,
    system,
    currency: currency || { symbol: '$', code: 'USD' },
    problems,
  };
}

/**
 * Parse a standalone quantity like "500g", "2 L" or "12 rolls" -- what someone
 * answers when asked how much they actually need. A bare number means items.
 */
export function parseQuantity(text, system = 'us') {
  const m = String(text ?? '').trim().match(/^(\d+(?:\.\d+)?)\s*(.*)$/);
  if (!m) return null;
  const value = parseFloat(m[1]);
  if (!(value > 0)) return null;
  const token = m[2] ? m[2].replace(/fl\.?\s*oz\.?/i, 'floz') : 'item';
  const unit = resolveUnit(token, system);
  return unit ? { value, unit } : null;
}

/** Parse a block of text, one option per non-empty line. */
export function parseLines(text, opts = {}) {
  return String(text)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => parseLine(l, opts));
}

export const _internal = { toNumber, blank, normaliseUnitToken };
