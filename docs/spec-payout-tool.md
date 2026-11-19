# Spec — Miniatures payout tool

Status: signed off 2026-11-19 · Tracker: NERDC-152

A Workbench tool that works out, once a month, what each printer and painter is owed for
resin miniatures sold in the web store. It replaces a hand-kept spreadsheet.

> **Privacy.** This repo is public. People, rates and amounts are **user settings stored on
> the PC at runtime**. No real names, rates, amounts or order data go into the code, the
> tests, the fixtures or this document. Every number below is made up.

## 1. Who uses it

One person runs it once a month. It must need almost no input: the tool pulls the orders,
the user checks two menus per line, fixes any line the tool flags, and closes the month.

## 2. Input — straight from Shopify

- Orders are read with the app-wide Shopify connection (`src/lib/shopify/`, from Voucher
  S3.2). The connection needs the scopes `read_orders` and `read_all_orders` on top of the
  Voucher scopes. No CSV import.
- One row per **order line**, read from the order itself, not from an analytics report.
  (Analytics reports split a line once per discount, which double-counts it.)
- An order belongs to the month it was **created** in (store time zone).
- Orders that are voided, expired (the payment was never taken) or fully refunded before the month closes are left out.
- Unpaid cash-on-delivery orders are included and tagged "not paid yet".

### Which lines count

Settings hold the rule. Default:

- product tag is any of: `mini`, `figurine`, `statue`, `resin`
- and none of: `filament`, `dice`
- plus a list of extra products picked by title (for example the custom resin print size
  line, whose price sits on a separate product)

## 3. The maths — per line

All money in RON. Inputs per line:

| Name             | Source                                                                                                                                                                                                                                                     |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `paid`           | what the customer paid for the line after **all** discounts (line and order-level, shared out by Shopify), **without tax**, minus any partial refund on the line                                                                                           |
| `qty`            | line quantity, minus refunded units                                                                                                                                                                                                                        |
| `variant`        | paint option of the line: _Primed & Drybrushed_, _Partial Paint Job_, _Complete Paint Job_, or none (the option name varies per product, so match on the value)                                                                                            |
| `cost`           | Shopify _Cost per item_ of the variant, per unit × `qty`. For a painted variant: the cost of the same product's _Primed & Drybrushed_ variant at the same size. If Shopify has none: the cost table in Settings. If that has none: the line is **blocked** |
| `fee%`           | Settings, one flat payment-processing rate for every order                                                                                                                                                                                                 |
| `split%`         | Settings, the printer's share of the profit                                                                                                                                                                                                                |
| `dry%`, `dryMin` | Settings, drybrush pay as a percent of the price, with a minimum per piece                                                                                                                                                                                 |

### 3.1 Print part

For a painted line the print part is only the primed piece:
`printPrice = primedPrice × qty`, where `primedPrice` is the current Shopify price of the
same product's _Primed & Drybrushed_ variant at the same size, scaled by the line's
discount ratio (`paid / listPrice`). For any other line `printPrice = paid`.

```
fee        = printPrice × fee%
drybrush   = variant is Primed & Drybrushed ? max(printPrice × dry%, dryMin × qty) : 0
profit     = printPrice − fee − cost − drybrush
printer    = profit × split%        (if "Printed by" is a person who gets paid)
company    = profit − printer
```

### 3.2 Paint part (painted lines only)

```
paintPrice = paid − printPrice
painter    = paintPrice − paintPrice × fee%      (100% to the painter)
```

### 3.3 Who gets the money

- **Printed by** and **Painted by** are menus per line. Defaults come from Settings and
  the last choice per product is remembered.
- A person with _Gets paid_ off (for example an owner) does not get paid: their share
  stays with the company.
- A print-farm printer gets no profit share: the whole print profit stays with the company.
- The drybrush pay goes to whoever is in _Painted by_ for a primed line.

### 3.4 Rounding

Keep full precision per line. Round each **person's month total** to 2 decimals
(half away from zero). The company total is what is left, so everything adds up to the
money paid.

### 3.5 Worked example (made-up numbers)

Settings: fee 3%, split 60%, drybrush 12% min 20.

- Painted figurine, `paid` 620.00, primed price 230.00, cost 53.00.
  Print: fee 6.90 → profit 170.10 → printer 102.06, company 68.04.
  Paint: 390.00 − 11.70 → painter 378.30.
- Primed bust, `paid` 70.00, cost 22.00. Drybrush max(8.40, 20) = 20.00.
  Fee 2.10 → profit 25.90 → printer 15.54, company 10.36.

These cases become unit tests.

## 4. Months and corrections

- A month is **Open** until it is closed. _Load from Shopify_ refreshes it as often as
  needed. Menu choices survive a reload.
- **Close month** is blocked while any line is blocked (no cost).
- A closed month is **locked**: saved on the PC with every input and result, never
  recalculated.
- A refund or cancellation that lands after its month is closed becomes a **correction**
  in the current open month: minus the amounts paid for that line, per person and company.
- Each person total can be marked **Paid** with a date.
- The first month in the tool is set in Settings. Earlier months are not loaded.

## 5. Screens

Mockup: Design artifact "Payout tool mockup" (private link in the tracker).

1. **Month screen** — months list on the left; the line table grouped by order (product ·
   variant, qty, paid, fee, cost, Printed by, Painted by, and the result per person and
   company); a "How we got this" fold-out per line; tags for the special cases (min
   drybrush, cost from table, stays in company, not paid yet, no cost); totals per person
   with PDF and Mark as paid; company total; a corrections box. Load and Close buttons on top.
2. **PDF statement** — one A4 page per person per month: total to pay, the parts (print,
   paint, drybrush, corrections), a short line list, one paragraph that explains the rules,
   a "Paid on" line and a statement id. Plus a CSV of the same lines.
3. **Settings › Payout** — people (name, prints, paints, gets paid, default for), split %,
   fee %, drybrush % and minimum, the product rule, the fallback cost table, first month.

Look: the Workbench retro kit (`src/ui/`, `src/styles/tokens.css`). Title colour: the
free green token.

## 6. Storage

On the PC, in the app data folder, never in the repo: settings, people, the remembered
menu choices, and one file per month (open or closed). Nothing goes back to Shopify:
the tool only reads.

## 7. Out of scope (for now)

- FDM (filament) pieces.
- A labour cost line.
- Paying the print farm (it bills outside the tool).
- Romanian UI.
- Months before the first month.

## 8. Build order

1. Pure maths module with unit tests (no UI, no Shopify).
2. Settings and storage.
3. Month screen on fake data.
4. Shopify loader (needs Voucher S3.2 plus the order scopes).
5. Close, lock, corrections, PDF and CSV.
