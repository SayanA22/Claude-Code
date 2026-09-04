# Aisle

Work out which one is actually cheaper.

You are standing in front of $12.99 for 100 fl oz, $7.49 for 1.2 L, and "3 for
$10" on a 500 g pack. The shelf-edge unit prices are missing, in different
units, or quietly ignore the offer. Aisle does the arithmetic.

```
$ aisle 'Tide Original 100 fl oz $12.99' 'Persil 2 for $18, 100 fl oz' \
        'Store brand 128 fl oz $8.49'

  store brand — $2.24 per L, 26.3% cheaper than the next best.

        item           size      price   per L
  * 1.  store brand    128 floz  $8.49   $2.24/L
    2.  persil         100 floz  $9.00   $3.04/L  needs 2
    3.  tide original  100 floz  $12.99  $4.39/L
```

## Three things it gets right that dividing price by size does not

**An offer makes the unit price a curve, not a number.** "3 for $10" is only
the cheapest at multiples of three, and if that is the only price on the label
you cannot buy one for $3.33 — so a basket of four costs two lots of ten. Aisle
prices each option as a function of how many packs you take, and tells you how
many you have to take.

**You pay for packs, not for grams.** Tell it how much you actually need and
the ranking changes from cheapest-per-unit to cheapest-way-to-get-it:

```
$ aisle --need 500g 'Barilla 500 g $2.19' 'Bulk sack 5 kg $15.00' 'Store 3 for $5, 500g'

  barilla — $2.19 for what you need, $2.81 less than the next best (56.2%).

        item        size   price   per kg    you pay      left over
  * 1.  barilla     500 g  $2.19   $4.38/kg  $2.19 (1)    -
    2.  store       500 g  $1.67   $3.33/kg  $5.00 (1+2)  1000 spare  needs 3
    3.  bulk pasta  5 kg   $15.00  $3.00/kg  $15.00 (1)   4500 spare
```

The bulk sack is the cheapest per kilo and the worst thing to buy. It also
counts a free pack as free: with "buy 2 get 1 free", two packs and three cost
the same, so it tells you to take three.

**A US fluid ounce is 29.5735 ml and an imperial one is 28.4131 ml.** The pints
differ by 20%. Comparing a US-labelled bottle against a UK-labelled one on a
single table produces an error larger than most of the price gaps you are
trying to resolve. Aisle picks the table from the currency, or you can set it.

It also keeps countable things honest: twelve *rolls* and five hundred *sheets*
are both counts, and it will not rank them against each other.

## What you can type

Free text, in whatever order the label has it:

| | |
|---|---|
| `Tide Original 100 fl oz $12.99` | price anywhere in the line |
| `1.2 kg 8.49` | bare number is the price |
| `12 x 330 ml $9.60` | multipacks multiply out |
| `Charmin 12 rolls x 264 sheets $24.99` | so do nested counts |
| `£1.20/750ml` | a unit price, not a multibuy |
| `$3 per kg` | already per-unit |
| `3 for $10, 16 oz` | multibuy |
| `buy 2 get 1 free $4.50 400g` | and the rest |
| `20% off $9.99, 1 L` | percentage off |
| `save $2, $9.99, 1 L` | amount off |
| `second half price $4 500g` | half-price second |
| `beans 400g 89p` | pence and cents |

Mass, volume, length and about forty count nouns (rolls, sheets, loads, pods,
tablets, nappies, washes) are understood, in metric, US customary and imperial.

## Use it

**On your phone, in the shop.** `dist/artifact.html` is the whole app in one
file — no network, no accounts, nothing to install. Publish it, or open it
locally:

```sh
node build.js && open web/index.html
```

**In the terminal.**

```sh
node bin/aisle.js 'A 500 g $2.19' 'B 1 kg $3.99'
node bin/aisle.js --need 2L 'A 500ml $1.50' 'B 2 L $5.00'
node bin/aisle.js --json 'A 400 g $3' 'B 1 kg $6'
cat shelf.txt | node bin/aisle.js
```

`--units us|imperial` overrides the guess from the currency.

**As a library.**

```js
import { parseLines } from './src/parse.js';
import { compare, verdict } from './src/compare.js';

const result = compare(parseLines('A 500 g $2.19\nB 1 kg $3.99'));
console.log(verdict(result));
```

## Layout

```
src/units.js     unit tables and conversion; US vs imperial lives here
src/parse.js     free text -> { name, price, size, offers }
src/compare.js   offer pricing, cost to cover, ranking
bin/aisle.js     command line
web/             the page: template.html + app.js
build.js         bundles src/ + web/app.js into a single file
test/            node --test
```

No dependencies, at runtime or to build. `node --test` runs 63 tests.
