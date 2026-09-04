/**
 * Unit tables and conversions.
 *
 * Everything reduces to a base unit per dimension:
 *   mass   -> gram
 *   volume -> millilitre
 *   count  -> item
 *   length -> metre
 *
 * The volume table is deliberately locale-dependent. A US fluid ounce is
 * 29.5735 ml, an imperial one is 28.4131 ml, and a US pint is 473 ml against
 * an imperial 568 ml. Comparing a US-labelled bottle against a UK-labelled one
 * with a single table silently produces a ~4% (pints: 20%) error, which is
 * larger than most of the price gaps people are trying to resolve.
 */

export const MASS = {
  mcg: 1e-6, ug: 1e-6,
  mg: 0.001,
  g: 1, gram: 1, grams: 1, gm: 1, gms: 1,
  kg: 1000, kilo: 1000, kilos: 1000, kilogram: 1000, kilograms: 1000,
  oz: 28.349523125, ounce: 28.349523125, ounces: 28.349523125,
  lb: 453.59237, lbs: 453.59237, pound: 453.59237, pounds: 453.59237, '#': 453.59237,
  st: 6350.29318, stone: 6350.29318,
};

const VOLUME_SHARED = {
  ml: 1, millilitre: 1, milliliter: 1, millilitres: 1, milliliters: 1, cc: 1,
  cl: 10, centilitre: 10, centiliter: 10,
  dl: 100, decilitre: 100, deciliter: 100,
  l: 1000, lt: 1000, ltr: 1000, litre: 1000, liter: 1000, litres: 1000, liters: 1000,
};

/** US customary liquid measure. */
export const VOLUME_US = {
  ...VOLUME_SHARED,
  tsp: 4.92892159375, teaspoon: 4.92892159375, teaspoons: 4.92892159375,
  tbsp: 14.78676478125, tablespoon: 14.78676478125, tablespoons: 14.78676478125,
  floz: 29.5735295625, 'fl oz': 29.5735295625, 'fluid ounce': 29.5735295625,
  'fluid ounces': 29.5735295625, 'fl. oz': 29.5735295625,
  cup: 236.5882365, cups: 236.5882365,
  pt: 473.176473, pint: 473.176473, pints: 473.176473,
  qt: 946.352946, quart: 946.352946, quarts: 946.352946,
  gal: 3785.411784, gallon: 3785.411784, gallons: 3785.411784,
};

/** Imperial liquid measure (UK, and still used in IE/CA on some labels). */
export const VOLUME_IMPERIAL = {
  ...VOLUME_SHARED,
  tsp: 5.919388, teaspoon: 5.919388, teaspoons: 5.919388,
  tbsp: 17.758164, tablespoon: 17.758164, tablespoons: 17.758164,
  floz: 28.4130625, 'fl oz': 28.4130625, 'fluid ounce': 28.4130625,
  'fluid ounces': 28.4130625, 'fl. oz': 28.4130625,
  cup: 284.130625, cups: 284.130625,
  pt: 568.26125, pint: 568.26125, pints: 568.26125,
  qt: 1136.5225, quart: 1136.5225, quarts: 1136.5225,
  gal: 4546.09, gallon: 4546.09, gallons: 4546.09,
};

export const LENGTH = {
  mm: 0.001, millimetre: 0.001, millimeter: 0.001,
  cm: 0.01, centimetre: 0.01, centimeter: 0.01,
  m: 1, metre: 1, meter: 1, metres: 1, meters: 1,
  km: 1000, kilometre: 1000, kilometer: 1000,
  in: 0.0254, inch: 0.0254, inches: 0.0254, '"': 0.0254,
  ft: 0.3048, foot: 0.3048, feet: 0.3048, "'": 0.3048,
  yd: 0.9144, yard: 0.9144, yards: 0.9144,
  mi: 1609.344, mile: 1609.344, miles: 1609.344,
};

/**
 * Countable units. The multiplier is always 1 -- the value here is the
 * canonical noun, so the answer can read "per roll" or "per load" instead of
 * the useless "per item".
 */
export const COUNT = {
  ct: 'item', count: 'item', pc: 'item', pcs: 'item', piece: 'item',
  pieces: 'item', ea: 'item', each: 'item', item: 'item', items: 'item',
  unit: 'item', units: 'item', pack: 'pack', packs: 'pack', pk: 'pack',
  roll: 'roll', rolls: 'roll',
  sheet: 'sheet', sheets: 'sheet', ply: 'sheet',
  load: 'load', loads: 'load',
  wash: 'wash', washes: 'wash',
  tablet: 'tablet', tablets: 'tablet', tab: 'tablet', tabs: 'tablet',
  capsule: 'capsule', capsules: 'capsule', caps: 'capsule',
  pod: 'pod', pods: 'pod',
  serving: 'serving', servings: 'serving',
  bag: 'bag', bags: 'bag',
  can: 'can', cans: 'can',
  bottle: 'bottle', bottles: 'bottle',
  slice: 'slice', slices: 'slice',
  egg: 'egg', eggs: 'egg',
  diaper: 'diaper', diapers: 'diaper', nappy: 'nappy', nappies: 'nappy',
  wipe: 'wipe', wipes: 'wipe',
  bar: 'bar', bars: 'bar',
  dose: 'dose', doses: 'dose',
  meal: 'meal', meals: 'meal',
  sqft: 'sq ft', 'sq ft': 'sq ft', 'square foot': 'sq ft', 'square feet': 'sq ft',
};

/** Aliases normalised before lookup: "fl.oz.", "OZ", "Litres" all collapse. */
export function normaliseUnitToken(raw) {
  return String(raw)
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Resolve a unit token into { dim, factor, label }.
 * `system` is 'us' or 'imperial' and only affects volume.
 * Returns null when the token is not a unit we know.
 */
export function resolveUnit(raw, system = 'us') {
  const t = normaliseUnitToken(raw);
  if (!t) return null;

  const volume = system === 'imperial' ? VOLUME_IMPERIAL : VOLUME_US;

  // "oz" is ambiguous: mass by default, but "fl oz" is volume. The parser
  // hands us the already-joined token, so an explicit "fl" wins here.
  if (Object.prototype.hasOwnProperty.call(volume, t)) {
    return { dim: 'volume', factor: volume[t], label: t, base: 'ml' };
  }
  if (Object.prototype.hasOwnProperty.call(MASS, t)) {
    return { dim: 'mass', factor: MASS[t], label: t, base: 'g' };
  }
  if (Object.prototype.hasOwnProperty.call(LENGTH, t)) {
    return { dim: 'length', factor: LENGTH[t], label: t, base: 'm' };
  }
  if (Object.prototype.hasOwnProperty.call(COUNT, t)) {
    return { dim: 'count', factor: 1, label: COUNT[t], base: COUNT[t] };
  }
  return null;
}

/** Every token any unit table knows, longest first (so "fl oz" beats "oz"). */
export function allUnitTokens() {
  const seen = new Set([
    ...Object.keys(MASS),
    ...Object.keys(VOLUME_US),
    ...Object.keys(VOLUME_IMPERIAL),
    ...Object.keys(LENGTH),
    ...Object.keys(COUNT),
  ]);
  return [...seen].sort((a, b) => b.length - a.length);
}

/**
 * Pick a human display basis for a dimension, given the typical magnitude.
 * Nobody wants "$0.0042 per gram" -- they want "$0.42 per 100 g".
 */
export function displayBasis(dim, baseQty, countLabel = 'item') {
  if (dim === 'mass') {
    if (baseQty >= 2000) return { per: 1000, label: 'kg' };
    return { per: 100, label: '100 g' };
  }
  if (dim === 'volume') {
    if (baseQty >= 2000) return { per: 1000, label: 'L' };
    return { per: 100, label: '100 ml' };
  }
  if (dim === 'length') return { per: 1, label: 'm' };

  // Counts keep their own noun -- "per sheet" beats "per item" -- and scale to
  // a hundred once the pack sizes are big enough that the per-one price would
  // be a string of leading zeros.
  if (baseQty >= 500) return { per: 100, label: `100 ${plural(countLabel)}` };
  return { per: 1, label: countLabel };
}

/** Enough pluralisation for a unit noun. */
export function plural(word) {
  if (/s$/.test(word)) return word;
  if (/[^aeiou]y$/.test(word)) return word.slice(0, -1) + 'ies';
  if (/(ch|sh|x|z)$/.test(word)) return word + 'es';
  return word + 's';
}
