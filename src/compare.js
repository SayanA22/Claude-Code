/**
 * Turning parsed options into an answer.
 *
 * Three things separate this from dividing price by size:
 *
 *  1. Offers change the price as a function of how many packs you buy, so the
 *     unit price is a curve, not a number. "3 for $10" is only the best price
 *     at multiples of three.
 *  2. What you pay is the cost to cover the amount you need, in whole packs.
 *     A 2 kg bag at a lower price per kilo still costs more than a 500 g bag
 *     when 500 g is all you want.
 *  3. Quantity you will not use before it spoils is not a saving. The cheapest
 *     price per gram and the cheapest shop are routinely different answers.
 */

import { displayBasis, plural } from './units.js';

const round = (n, dp = 4) => Math.round(n * 10 ** dp) / 10 ** dp;

/** Total base-unit quantity in one pack (grams, ml, items, metres). */
/**
 * The bucket an option can be compared inside. Counts are keyed by their noun,
 * so rolls, sheets and loads stay in separate comparisons.
 */
export function keyOf(option) {
  const u = option.size.unit;
  return u.dim === 'count' ? `count:${u.base}` : u.dim;
}

/** How to name this option's dimension to a human: "mass", "volume", "rolls". */
export function dimLabel(option) {
  const u = option.size.unit;
  return u.dim === 'count' ? plural(u.base) : u.dim;
}

export function packQuantity(option) {
  return option.size.value * option.size.unit.factor;
}

/**
 * Split offers into the per-pack discounts (which just lower the sticker
 * price) and the one group offer (which prices packs in batches).
 */
function offerModel(option) {
  let unit = option.price;
  let group = null;

  for (const o of option.offers) {
    if (o.kind === 'pct_off') unit = unit * (1 - o.pct / 100);
    else if (o.kind === 'amount_off') unit = Math.max(0, unit - o.amount);
  }

  for (const o of option.offers) {
    if (o.kind === 'n_for') {
      group = { size: o.n, cost: o.price, label: `${o.n} for ${o.price}` };
    } else if (o.kind === 'buy_n_get_m_free') {
      group = {
        size: o.buy + o.free,
        cost: o.buy * unit,
        label: `buy ${o.buy} get ${o.free} free`,
      };
    } else if (o.kind === 'buy_n_get_m_pct') {
      group = {
        size: o.buy + o.discounted,
        cost: o.buy * unit + o.discounted * unit * (1 - o.pct / 100),
        label: `buy ${o.buy} get ${o.discounted} at ${o.pct}% off`,
      };
    }
  }

  // When the only price we were given is the multibuy price, packs cannot be
  // bought individually at that rate -- baskets round up to whole groups.
  if (group && option.priceFromOffer) group.strict = true;

  return { unit, group };
}

/** What k packs actually cost at the till. */
export function costForPacks(option, k) {
  if (k <= 0) return 0;
  const { unit, group } = offerModel(option);
  if (!group || group.size <= 1) return k * unit;
  if (group.strict) return Math.ceil(k / group.size) * group.cost;
  const groups = Math.floor(k / group.size);
  const rest = k - groups * group.size;
  return groups * group.cost + rest * unit;
}

/**
 * Cheapest per-unit price reachable, and the number of packs you have to buy
 * to reach it. Buying more never gets cheaper than one full group, so a single
 * group is the whole search space.
 */
export function bestUnitPrice(option) {
  const { group } = offerModel(option);
  const qty = packQuantity(option);
  const limit = group ? group.size : 1;
  const from = group && group.strict ? group.size : 1;
  let best = Infinity;
  let bestK = from;
  for (let k = from; k <= limit; k++) {
    const p = costForPacks(option, k) / (k * qty);
    if (p < best - 1e-12) { best = p; bestK = k; }
  }
  return { perBaseUnit: best, packs: bestK };
}

/**
 * Cheapest way to end up with at least `need` base units.
 *
 * Scanning one group past the minimum matters: with "buy 2 get 1 free",
 * three packs cost the same as two, so the honest answer is three.
 */
export function costToCover(option, need) {
  const qty = packQuantity(option);
  const { group } = offerModel(option);
  const span = group ? group.size : 1;
  const kMin = Math.max(1, Math.ceil(need / qty - 1e-9));

  let best = { packs: kMin, cost: costForPacks(option, kMin) };
  for (let k = kMin + 1; k <= kMin + span; k++) {
    const c = costForPacks(option, k);
    if (c < best.cost - 1e-9) best = { packs: k, cost: c };
  }

  // Free extras: more packs for the same money as the chosen basket.
  let bonus = 0;
  for (let k = best.packs + 1; k <= best.packs + span; k++) {
    if (costForPacks(option, k) <= best.cost + 1e-9) bonus = k - best.packs;
  }

  const bought = (best.packs + bonus) * qty;
  return {
    packs: best.packs,
    bonusPacks: bonus,
    cost: best.cost,
    quantity: bought,
    leftover: Math.max(0, bought - need),
    // What you pay per unit you actually use -- the number that decides it.
    effectivePerBaseUnit: best.cost / need,
  };
}

/**
 * Compare a list of parsed options.
 *
 * `need` is optional and given as { value, unit } in the same dimension as the
 * options; when present the ranking switches from cheapest-per-unit to
 * cheapest-way-to-get-what-you-need, which is a different order surprisingly
 * often.
 */
export function compare(options, opts = {}) {
  const usable = options.filter((o) => o.price !== null && o.price > 0);
  const skipped = options.filter((o) => o.price === null || !(o.price > 0));

  if (usable.length === 0) {
    return { ranked: [], skipped, mismatch: null, need: null, verdict: null };
  }

  // Mass against volume is not a comparison anyone can make without a density,
  // so say so rather than inventing one. Countable things need the same care
  // one level down: twelve rolls and five hundred sheets are both counts, and
  // ranking them against each other is meaningless.
  const groups = new Map();
  for (const o of usable) {
    const k = keyOf(o);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(o);
  }

  let mainKey = [...groups.entries()].sort((a, b) => b[1].length - a[1].length)[0][0];
  // A bare "12 ct" carries no noun, so let it join a named count group rather
  // than splitting the comparison in two.
  if (mainKey === 'count:item' && groups.size > 1) {
    const named = [...groups.entries()]
      .filter(([k]) => k.startsWith('count:') && k !== 'count:item')
      .sort((a, b) => b[1].length - a[1].length)[0];
    if (named) mainKey = named[0];
  }

  const inMain = (o) => keyOf(o) === mainKey
    || (mainKey.startsWith('count:') && keyOf(o) === 'count:item');

  const mainDim = mainKey.startsWith('count:') ? 'count' : mainKey;
  const countLabel = mainKey.startsWith('count:') ? mainKey.slice(6) : 'item';
  const comparable = usable.filter(inMain);
  const others = usable.filter((o) => !inMain(o));
  const mainLabel = mainDim === 'count' ? plural(countLabel) : mainDim;
  const mismatch = others.length
    ? { mainDim, mainKey, countLabel, mainLabel, others }
    : null;

  const need = opts.need && opts.need.value > 0
    ? opts.need.value * (opts.need.unit?.factor ?? 1)
    : null;

  // One shared display basis, or the columns do not line up.
  const largest = Math.max(...comparable.map(packQuantity));
  const basis = displayBasis(mainDim, largest, countLabel);

  const rows = comparable.map((o) => {
    const qty = packQuantity(o);
    const best = bestUnitPrice(o);
    // For a strict multibuy this is the cost of a whole group, which is
    // exactly what one pack would set you back.
    const single = costForPacks(o, 1) / qty;
    const cover = need ? costToCover(o, need) : null;
    const { group } = offerModel(o);
    return {
      option: o,
      packQuantity: qty,
      unitPrice: round(best.perBaseUnit * basis.per, 4),
      unitPriceRaw: best.perBaseUnit,
      packsForBestPrice: best.packs,
      singlePrice: round(single * basis.per, 4),
      singlePriceRaw: single,
      dealOnly: best.packs > 1,
      dealLabel: group ? group.label : null,
      cover: cover && {
        ...cover,
        effective: round(cover.effectivePerBaseUnit * basis.per, 4),
      },
    };
  });

  const key = need
    ? (r) => [r.cover.cost, r.unitPriceRaw]
    : (r) => [r.unitPriceRaw, r.option.price];
  rows.sort((a, b) => {
    const ka = key(a); const kb = key(b);
    return ka[0] - kb[0] || ka[1] - kb[1];
  });

  const winner = rows[0];
  const runnerUp = rows[1] || null;
  rows.forEach((r, i) => {
    r.rank = i + 1;
    r.isBest = i === 0;
    if (need) {
      r.extraCost = round(r.cover.cost - winner.cover.cost, 2);
      r.pctWorse = winner.cover.cost > 0
        ? round(((r.cover.cost - winner.cover.cost) / winner.cover.cost) * 100, 1) : 0;
    } else {
      r.extraCost = null;
      r.pctWorse = winner.unitPriceRaw > 0
        ? round(((r.unitPriceRaw - winner.unitPriceRaw) / winner.unitPriceRaw) * 100, 1) : 0;
    }
  });

  // The saving is worth stating as a percentage of the loser, which is how
  // people hear it: "you save 18%", not "it is 22% more expensive".
  let savingPct = 0;
  if (runnerUp) {
    savingPct = need
      ? round((1 - winner.cover.cost / runnerUp.cover.cost) * 100, 1)
      : round((1 - winner.unitPriceRaw / runnerUp.unitPriceRaw) * 100, 1);
  }

  // Does the ranking only hold because of a multibuy? Worth flagging, because
  // it is a real condition on the answer, not a footnote.
  let dealCaveat = null;
  if (winner.dealOnly) {
    const singleSorted = [...rows].sort((a, b) => a.singlePriceRaw - b.singlePriceRaw);
    if (singleSorted[0] !== winner) {
      dealCaveat = {
        packs: winner.packsForBestPrice,
        deal: winner.dealLabel,
        betterIfOne: singleSorted[0],
      };
    }
  }

  return {
    ranked: rows, skipped, mismatch, basis, mainDim, countLabel,
    need: need ? { base: need, unit: opts.need.unit } : null,
    winner, runnerUp, savingPct, dealCaveat,
    currency: winner.option.currency,
  };
}

/** Money, in the currency the input was written in. */
export function money(amount, currency) {
  const sym = currency?.symbol || '$';
  const abs = Math.abs(amount);
  const dp = abs > 0 && abs < 0.1 ? 3 : 2;
  return `${amount < 0 ? '-' : ''}${sym}${abs.toFixed(dp)}`;
}

/** A single sentence that answers the question the shopper actually asked. */
export function verdict(result) {
  if (!result.winner) return 'Nothing to compare yet.';
  const { winner, runnerUp, savingPct, basis, currency, need } = result;
  const name = winner.option.name || winner.option.raw;
  const price = money(winner.unitPrice, currency);

  if (!runnerUp) return `${name} — ${price} per ${basis.label}.`;

  if (need) {
    const cost = money(winner.cover.cost, currency);
    const saved = money(runnerUp.cover.cost - winner.cover.cost, currency);
    return `${name} — ${cost} for what you need, ${saved} less than the next best (${savingPct}%).`;
  }
  return `${name} — ${price} per ${basis.label}, ${savingPct}% cheaper than the next best.`;
}
