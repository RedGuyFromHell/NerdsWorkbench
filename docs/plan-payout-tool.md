# Plan: the miniatures payout tool

Tracker: NERDC-152. Spec: `docs/spec-payout-tool.md` (the source of truth for the maths and the behaviour).
Written 2026-11-19 by the planner. The main session (overseer) builds from it with one fresh coder per slice.

> **Privacy.** This repo is public. Nothing in this plan, the code, the tests or the fixtures names a real
> person, rate, amount or order. People in tests are "Printer A", "Painter B", "Farm". Every number is made up.
> "The owner" below is the person who signs off; the kit's wording for it is "needs sign-off".

## 0. Open questions (each has a recommended answer; the plan is built on the recommendations)

**Status 2026-11-19:** Q1 to Q14 are taken as recommended (the owner delegated the build overnight; any answer can still change, as each sits behind one named function). Q15 is an owner action before P9.

Only Q1 to Q4 change the maths module. The rest change one function or one screen each. None blocks P1's start:
the recommended answers are coded behind named functions, so a different answer is a small edit and a changed test.

| #   | Question (where the spec is silent or can be read two ways)                                                                                                                                           | Recommended answer                                                                                                                                                                                           | Touches |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------- |
| Q1  | Discount ratio `paid / listPrice` (spec 3.1): which `listPrice`? The price on the order line at order time, or today's Shopify price of the painted variant?                                          | The order line's own price at order time (unit price before discounts, times the remaining quantity). `paid` is from the order, so the ratio must be too. Only `primedPrice` is "current", as the spec says. | P1, P2  |
| Q2  | What exactly is the "company total"? The spec says it is "what is left" so that all adds up to the money paid, but the money paid also holds the fees and the costs.                                  | Company total = sum of `paid` minus the costs, minus the fees (their month sum rounded to 2 decimals), minus every person's rounded total. Fees and costs are shown as their own two totals beside it.       | P1      |
| Q3  | A line whose profit is negative (cost above the discounted price): does the printer share the loss, as the formula gives?                                                                             | Follow the formula as written (the share is negative) and tag the line "loss" so it is seen before closing.                                                                                                  | P1      |
| Q4  | A painted line whose product has no _Primed & Drybrushed_ variant at the same size (never made, or deleted): no `primedPrice`, so no split.                                                           | The line is **blocked** ("no primed price"), like a line with no cost. It blocks Close.                                                                                                                      | P1, P2  |
| Q5  | Print farm: is it a person with _Gets paid_ off, or does it need its own flag? The maths is the same in both (the share stays with the company).                                                      | A person with _Prints_ on and _Gets paid_ off. No extra flag. The tag on the line is "stays in company" in both cases.                                                                                       | P1, P4  |
| Q6  | Drybrush when _Painted by_ is a person with _Gets paid_ off: is the drybrush still taken out of the profit before the printer's split?                                                                | Yes: the formula subtracts it always. The drybrush amount then stays with the company.                                                                                                                       | P1      |
| Q7  | _Default for_ on a person: which values? Printing and painting only, or also drybrush (the _Painted by_ of a primed line)?                                                                            | Three: printing, painting, drybrush. A primed line takes the drybrush default, a painted line the painting default.                                                                                          | P4, P6  |
| Q8  | A line with an empty _Printed by_ or _Painted by_ (no default set, nothing remembered): may the month close?                                                                                          | No. The line is tagged "needs a choice" and blocks Close, like a blocked line.                                                                                                                               | P6, P7  |
| Q9  | The fallback cost table: what is a row keyed on?                                                                                                                                                      | Product (picked by title, like the extra-products list) plus an optional size value. A row with a size wins over a row without.                                                                              | P2, P4  |
| Q10 | "Without tax": the source. And which orders are "not paid yet": only pending cash on delivery, or every order that is not fully paid?                                                                 | `paid` = the line price after all discount allocations, minus the line's tax lines when the order has taxes included. "Not paid yet" = financial status pending, authorized or partially paid.               | P2, P9  |
| Q11 | A refund that is not tied to a line (an amount-only refund, for example a goodwill refund): how is it shared?                                                                                         | Not shared. The order is tagged "refund without lines: check by hand" and the lines keep their amounts.                                                                                                      | P2, P9  |
| Q12 | A **partial** refund that lands after the month closed. The spec's correction is "minus the amounts paid for that line", which fits a full refund.                                                    | Correction = the line recalculated with the closed month's own settings and choices, minus what was locked. For a full refund or a cancellation this is exactly "minus the amounts paid".                    | P7      |
| Q13 | Several open months at once (last month not closed, this month started): which one takes the corrections? May a month close before an older one?                                                      | Months close in order, oldest first. Corrections go to the oldest open month, the next one to close.                                                                                                         | P7      |
| Q14 | PDF, CSV and _Mark as paid_: for an open month too, or only a closed one?                                                                                                                             | Only a closed month. A statement of a total that can still change misleads.                                                                                                                                  | P7, P8  |
| Q15 | `read_all_orders` needs Shopify to grant the app access to orders older than 60 days (an access request on the app, then a new app version and a reconnect). Is that request approved, or to be made? | The owner makes the request before P9 starts. Without it the first month and old corrections cannot load; P9 then shows Shopify's own refusal.                                                               | P9      |

## 1. What we build

A third Workbench tool, **Payout**, green title bar. Once a month it reads the store's order lines for resin
miniatures, works out what each printer and painter is owed, and locks the month. It only reads Shopify.

Layers, from the inside out (I/O stays at the edges, core rule 1):

```
src/tools/payout/
  core/        pure, no React, no Tauri, no Shopify: the maths, the line facts, months, corrections, statements
  storage/     zod schemas + a store interface (app data folder in the desktop app, memory in a plain browser)
  shopify/     the order loader (last chunk)
  demo/        made-up orders, loaded only in a dev build
  *.tsx, payout.css   the screens
```

## 2. Decisions this plan takes (two lines each)

- **Exact arithmetic on BigInt fractions, money in bani, rates in basis points.** The spec wants full precision per
  line and one rounding per person per month. A painted line divides by a price (the discount ratio), so a fixed
  number of decimals is not exact; a fraction is. Floats are never used for money.
- **Our own small `exactAmount.ts` (about 80 lines), not a library.** It needs six operations (add, subtract,
  multiply, divide, compare, round half away from zero to bani). A dependency in a self-updating public app's money
  path costs more than it saves. If the coder finds it growing past that, `fraction.js` is the fallback.
- **Two pure steps, not one.** `core/lineFacts` turns a raw order line into the maths inputs (which lines count,
  paint option, primed sibling, cost fallback, refunds). `core/payoutMath` turns inputs into amounts. The loader
  only fills the raw shape, so everything before it is tested on fake data.
- **Storage through three small Rust commands rooted in the app data folder**, not `tauri-plugin-fs`. Same choice
  as the 1.0 plan (no path scopes), and the write is atomic (temp file, then rename), which a locked month needs.
- **A closed month file is written once and never again.** _Paid_ marks live in their own file, so marking a
  person paid does not rewrite a locked month.
- **An open month stores inputs and choices only; results are computed on screen.** At Close the settings in force
  and every result are frozen into the file. A closed month never looks at the live settings again.
- **PDF with `pdfmake`.** The statement is then a plain document object built by a pure function (testable), and
  its bundled font has the Romanian letters a person's name may hold. It is loaded on demand. Risk and fallback in P8.
- **Settings › Payout is one more line in `SETTINGS_SECTIONS`.** The window already takes a section id to scroll to.
- **Demo data is dev only** (`import.meta.env.DEV`, dynamic import), so a release build never shows made-up
  numbers as if they were real, and the screens can be checked in a plain browser before the loader exists.

## 3. Where the repo stands (checked 2026-11-19)

- `feat/payout` sits on the old `main` (`369cd48`). `origin/main` is at `225c10b`: Disc Studio and the shell
  navigation are **already merged** (PR 1, 2 and 3). `origin/main` has `src/lib/files.ts` (save dialog and
  `writeFileBytes`), `ToolContext.openSettings`, `SettingsWindow.focusSectionId`, `src/ui/TextArea.tsx`.
- Voucher S3.2 is **done on `feat/voucher`** (`73f50b1`), not on `main`: `src/lib/shopify/client.ts`
  (`shopifyGraphql(query, variables, zodSchema)`, `getShopifyStatus`), `useShopifyStatus.ts`, Rust `shopify/`,
  `settings.rs`, `secrets.rs`. Its scopes already hold `read_orders`. They do **not** hold `read_all_orders`.
- There is no app data storage for tool data anywhere yet. S3.2's `settings.json` is the Shopify connection only.
- Tests: vitest picks `src/**/*.test.ts`, Node environment, no DOM. So React components are not unit-tested;
  every decision goes into a pure `.ts` file.

**Before P1 (main session, not a slice):** fetch and rebase `feat/payout` onto `origin/main`; commit the spec.
Then `corepack pnpm install`.

**Every slice, not only the Rust ones:** the gate runs `cargo clippy` and `cargo test`, so every gate run builds
Rust. Drive D is full. Set the target folder first, in the same shell:

```powershell
$env:CARGO_TARGET_DIR = "$env:LOCALAPPDATA\Temp\nwb-payout-target"
node tools/check.mjs
```

(`%LOCALAPPDATA%\Temp\nwb-payout-target` is the folder the task names, written without the user name.)

## 4. Shared files: every touch, and where

| File                                       | Slice   | Change                                                                                  |
| ------------------------------------------ | ------- | --------------------------------------------------------------------------------------- |
| `src-tauri/src/lib.rs`                     | P3      | `mod app_data;` and three lines at the **end** of the `generate_handler!` list          |
| `src/app/settings/sections.tsx`            | P4      | one import, one line at the end of `SETTINGS_SECTIONS`                                  |
| `src/tools/types.ts`                       | P5      | `"payout"` added to the `ToolId` union                                                  |
| `src/tools/registry.ts`                    | P5      | one import, `payout` appended to `TOOLS`                                                |
| `src/tools/registry.test.ts`               | P5      | the "lists ..." test gains the third pair `["payout", "green"]` (the behaviour changed) |
| `src/ui/Tag.tsx` (new), `src/ui/retro.css` | P5      | a new shared tag component; its rules appended at the end of `retro.css`                |
| `package.json`, `pnpm-lock.yaml`           | P8      | `pdfmake` and its types                                                                 |
| `src-tauri/src/shopify/oauth.rs`           | P9      | `SCOPES` gains `read_all_orders`; the authorize-url test follows                        |
| `README.md`                                | P8, P10 | a Payout section                                                                        |

Not touched at all: `App.tsx`, `tauri.conf.json`, `capabilities/default.json` (app commands need no capability
entry; the PDF bytes leave through the existing `write_file_bytes`), `Cargo.toml` (no new crate).

## 5. The maths, pinned down (P1 and P2 build exactly this)

Units: `bani` are integers (1 RON = 100). Rates are integer basis points (3% = 300). Inside the module every
amount is an `ExactAmount` (BigInt numerator and denominator, always reduced). Stored as the string `"n/d"`.

Inputs of one line (`LineInput`): `paidBani`, `listBani` (Q1), `qty`, `paintOption`
(`"primed" | "partial" | "complete" | "none"`), `primedUnitBani | null`, `costBani | null`, `printedBy`,
`paintedBy`. Settings (`PayoutRates`): `feeBp`, `splitBp`, `drybrushBp`, `drybrushMinBani`. People: `id`, `getsPaid`.

```
painted (partial or complete):  printPrice = primedUnit × qty × paid / list      (list = 0: blocked)
otherwise:                      printPrice = paid
fee       = printPrice × feeBp / 10000
drybrush  = primed ? max(printPrice × drybrushBp / 10000, drybrushMin × qty) : 0
profit    = printPrice − fee − cost − drybrush
printer   = profit × splitBp / 10000        to the person in Printed by, if that person gets paid; else company
company   = profit − printer
paintPrice = paid − printPrice              painted lines only
painter   = paintPrice − paintPrice × feeBp / 10000   to Painted by, if paid; else company
drybrush  goes to Painted by of a primed line, if paid; else company
```

Result of a line (`LineResult`): `status` (`ok` or `blocked` with a reason: `no-cost`, `no-primed-price`),
`fee`, `cost`, `shares` (list of `{ personId, part: "print" | "paint" | "drybrush", amount }`), `company`,
`tags` (`min-drybrush`, `cost-from-table`, `stays-in-company`, `not-paid-yet`, `loss`), and `steps`: the named
intermediate values the "How we got this" fold-out prints. Identity, asserted by a test on every case:
`fee (print) + fee (paint) + cost + sum of shares + company = paid`, exactly.

Month totals: each person's total = the exact sum of their shares and corrections, rounded once to bani, half
away from zero (so −0.005 gives −0.01). Company total as in Q2.

## 6. Chunks

- **Chunk A, branch `feat/payout`, slices P1 to P8.** No Shopify. Mergeable on its own: the tool opens, the
  Load button says the loader is not there yet. Whether a release goes out between A and B is the owner's call.
- **Chunk B, slices P9 and P10. BLOCKED on S3.2** being on `main` (`feat/voucher` merged), and on the two
  order scopes. Branch `feat/payout-shopify`, cut from `main` after that merge (or `feat/payout` rebased, if
  chunk A is not merged yet).

Every slice: test first, each new test seen red with the bug put back, gate green (section 3), the files touched
tidied to the rules, one commit, then one line under "Progress" at the end of this file.

---

### P1 Money core: exact amounts, the line maths, month totals (about 90k, Fable medium)

Goal: `calculateLine` and `sumMonth` give the spec's numbers exactly, with no UI and no Shopify.
Waits on: the rebase. Model: Fable medium, because it is money with many edge cases.

Files (all new, under `src/tools/payout/core/`):

- `exactAmount.ts`: `fromBani`, `add`, `subtract`, `multiply`, `divide`, `compare`, `maxOf`, `roundToBani`
  (half away from zero), `formatAmount` and `parseAmount` (`"n/d"`). Throws on a zero denominator.
- `types.ts`: `PayoutRates`, `Person`, `PaintOption`, `LineInput`, `LineResult`, `LineTag`, `MonthTotals`.
- `payoutMath.ts`: `calculateLine(input, rates, people)`, with `splitPrintPrice`, `drybrushPay`, `assignShare`.
- `monthTotals.ts`: `sumMonth(results, corrections)`: per person (print, paint, drybrush, corrections, total
  rounded), fees total, costs total, company total (Q2).
- `percent.ts`: `percentToBasisPoints("2.5")` and back, for the Settings fields (rejects more than 2 decimals).

Tests first (`*.test.ts` beside each file; made-up numbers only):

- The spec's two worked examples, to the ban: 102.06 / 68.04 / 378.30 and 20.00 / 15.54 / 10.36.
- Rounding: a half ban up, a negative half ban away from zero, a person total made of three thirds of a ban;
  the sum of rounded person totals plus company plus fees plus costs equals the paid sum.
- Minimum drybrush: percent above the minimum, below it, exactly equal, and quantity 3 (`min × qty`).
- Painted against primed: ratio 1, a 20% order discount (print part and paint part both scale), quantity 2,
  primed price above the discounted line (a negative paint part is returned and tagged, not hidden).
- People: a printer with _Gets paid_ off, a print farm (Q5), a painter not paid, drybrush to a not-paid person (Q6):
  each share lands in `company` and the line carries `stays-in-company`.
- Blocked: no cost, no primed price on a painted line (Q4), list price 0. A blocked line has no shares.
- Loss (Q3), quantity 0 (all zeros), paint option `none` (no painter, no drybrush).
- The identity of section 5 on every case above, through one shared helper.
- `exactAmount`: reduction, sign of the denominator, divide by zero throws, round trips through `"n/d"`.

Docs: none yet. Verify: the gate; no file outside `core/`.
Risks: BigInt and JSON (`JSON.stringify` throws on a BigInt): amounts cross every boundary as `"n/d"` strings,
and a test proves a `LineResult` survives `JSON.stringify` after `formatAmount`.

### P2 Line facts: from a raw order to the maths inputs (about 90k, Fable medium)

Goal: pure functions decide which lines count and what their inputs are, on a `RawOrder` shape the loader fills later.
Waits on: P1. Shares no file with P3 or P4. Model: Fable medium: refunds, fallbacks and time zones fail silently.

Files (new, `src/tools/payout/core/`):

- `rawOrder.ts`: types only. `RawOrder` (`id`, `name`, `createdAt`, `cancelledAt`, `financialStatus`,
  `taxesIncluded`, `lines`, `refunds`, `hasRefundWithoutLines`), `RawLine` (`id`, `productId`, `productTitle`,
  `productTags`, `variantId`, `variantTitle`, `options` as name and value pairs, `quantity`, `originalUnitBani`,
  `discountAllocatedBani`, `taxBani`), `RawRefundLine` (`lineId`, `quantity`, `subtotalBani`, `createdAt`),
  `ProductVariants` (per product: each variant's `options`, `priceBani`, `unitCostBani | null`).
- `productRule.ts`: `isPayoutLine(line, rule)`: any of the include tags, none of the exclude tags, or the title
  is in the extra-products list. Tags compare lower case.
- `paintOption.ts`: `resolvePaintOption(options)` matches on the option **value** (the option name varies), trimmed,
  case ignored; the three values are named constants. `findPrimedSibling(line, productVariants)`: the variant
  with the same other option values and the primed value.
- `lineCost.ts`: `resolveCost(...)`: the variant's own cost (for a painted line, the primed sibling's), then the
  Settings cost table (Q9), else `null`. Returns the source, for the `cost-from-table` tag.
- `orderMonth.ts`: `monthOf(createdAtIso, timeZone)` with `Intl.DateTimeFormat`; `listMonths(firstMonth, today)`.
- `lineFacts.ts`: `planMonthLines(orders, productVariants, settings, month)`: drops cancelled, voided and fully
  refunded orders, lines that do not count and lines with quantity 0 after refunds; computes `paidBani` (Q10),
  `listBani` (Q1) and `qty`; sets `not-paid-yet` (Q10) and the order warning (Q11). Returns the lines with their
  facts and a short "left out" count per reason.

Tests first: the default rule (each include tag, each exclude tag winning, an extra product by title, tag case);
option value match under two different option names, extra spaces, no paint option; sibling at the same size among
two sizes, missing sibling; cost from the variant, from the primed sibling, from the table with and without size,
none; an order at 23:30 UTC on the last day of a month lands in the next month for a zone ahead of UTC, and the
reverse; a line with one of three units refunded (quantity and paid both drop); a money-only refund on a line;
a fully refunded order left out; pending order tagged; taxes included against not included.

Docs: none. Verify: the gate.
Risks: the real field meanings (discount allocations, refund subtotals with tax) are only proven in P9. So
`RawLine` carries already-separated numbers and P9 owns the mapping: a wrong reading there changes one mapper,
not this slice.

### P3 Storage: app data commands and the payout store (about 85k, Sonnet)

Goal: settings, people, remembered choices and paid marks save to the app data folder and load back, typed.
Waits on: P1 (types). Shares no file with P2: the two may run side by side, in **separate worktrees** only.
**Touches Rust: `CARGO_TARGET_DIR` as in section 3.**

Files:

- New `src-tauri/src/app_data.rs`: `read_app_text(path) -> Option<String>` (a missing file is `None`, not an
  error), `write_app_text(path, text)` (creates folders; writes a temp file, then renames), `list_app_files(folder)`.
  A pure `resolve_inside(root, relative)` accepts only segments of letters, digits, `-`, `_`, `.`, refuses `..`,
  an absolute path, a drive letter and an empty path. Root: the app data dir.
- `src-tauri/src/lib.rs`: the two edits of section 4.
- New `src/lib/appData.ts`: `readAppText`, `writeAppText`, `listAppFiles` over the commands (dynamic import of
  `@tauri-apps/api/core`, as `src/lib/files.ts` does).
- New `src/tools/payout/storage/schemas.ts`: zod schemas, each with a `version`: settings (rates in basis points
  and bani, the product rule, the cost table, first month), people, remembered choices (by product id), paid marks.
  `DEFAULT_SETTINGS`: every rate 0, no people, the spec's default tags, first month empty. No real value.
- New `src/tools/payout/storage/payoutStore.ts`: the `PayoutStore` interface, `createAppDataStore()`,
  `createMemoryStore()`, and `getPayoutStore()` which picks by `isTauri()`. Files under `payout/`:
  `settings.json`, `people.json`, `choices.json`, `paid-marks.json`, `months/<yyyy-mm>.json` (the month schema
  arrives in P5; the store takes a schema as a parameter).

Tests first: Rust: `resolve_inside` accepts `payout/months/2026-01.json`, refuses `..`, `C:\x`, `/x`, `a//b`,
an empty path; write then read in a `tempfile` folder; a missing file gives `None`; the write leaves no temp file.
TS (through the memory store, which shares the parsing code): a round trip of each file; a missing file gives the
defaults; a broken file **throws** with the file name (never silent defaults over real data); an unknown
`version` throws.

Docs: `docs/learning-tauri.md`: a short part on app data commands and the atomic write.
Verify: the gate; in `corepack pnpm tauri dev`, call the store once from the console and see the file under
`%APPDATA%\eu.nerdcastle.workbench\payout\`.
Risks: `lib.rs` is the hot shared file (Voucher S3.3 adds to the same handler list): append at the end, and the
rebase conflict is two lines. The crate has no `tempfile` on `origin/main` (it comes with S3.2): if absent, use
`std::env::temp_dir()` plus a unique folder in the tests, do not add the crate twice.

### P4 Settings › Payout (about 80k, Sonnet)

Goal: the owner types people, rates, the product rule, the cost table and the first month once, and they persist.
Waits on: P3. Shares no file with P2.

Files:

- New `src/tools/payout/settings/PayoutSettingsSection.tsx` and small parts beside it (`PeopleTable.tsx`,
  `RatesFields.tsx`, `ProductRuleFields.tsx`, `CostTable.tsx`), built from `src/ui/` (Field, NumberField,
  Checkbox, Select, Button). Saves on change through the store; a failed save shows under the section.
- New `src/tools/payout/settings/settingsForm.ts`: pure: `validateSettings` (split 0 to 100, no negative rate,
  first month `yyyy-mm`), `validatePeople` (a name, no duplicate names, at most one default per job, Q7),
  `parseTagList("mini, figurine")`, `addPerson`, `removePerson` (refused while the person is a default).
- `src/app/settings/sections.tsx`: the edit of section 4. Section id constant `PAYOUT_SETTINGS_SECTION` exported
  from `src/tools/payout/settings/sectionId.ts`.
- `src/tools/payout/payout.css` (new): the table styles, tokens only.

Tests first: `settingsForm.test.ts`: each validation rule, the tag list parser (spaces, case, empty entries),
default-per-job uniqueness, removing a default person is refused. Nothing else is unit-testable, because the rest
is form wiring.

Docs: none. Verify: the gate; `corepack pnpm dev` in the Browser pane at 1100 × 720 and 1360 × 860: open
Settings, add two people, set rates, close, reopen: the values are there (memory store in the browser); then the
same once in `tauri dev` to see the files. No real name or rate typed into a screenshot that is kept.
Risks: `src/app` now imports from `src/tools/payout`: allowed (the registry already does), but the section must
not import the tool's screen, only `settings/`. People ids come from `crypto.randomUUID()`.

### P5 The tool and a read-only month (about 90k, Sonnet)

Goal: Payout is on the home grid; it lists the months and shows an open month's lines with their results, from demo data.
Waits on: P2, P3.

Files:

- `src/tools/types.ts`, `src/tools/registry.ts`, `src/tools/registry.test.ts`: the edits of section 4.
- New `src/tools/payout/index.ts` (id `payout`, name "Payout", colour `green`, no file types), `PayoutIcon.tsx`
  (retro line style, like `VoucherIcon.tsx`), `PayoutTool.tsx`.
- New `src/tools/payout/storage/monthSchema.ts`: the month file (`version`, `month`, `status`, `loadedAt`, lines
  with facts and the two choices; the closed-only parts stay optional until P7).
- New `src/tools/payout/core/monthView.ts`: pure: `buildMonthView(monthFile, settings, people)`: orders in date
  order, rows per line with money already formatted (`formatLei`), tags, the per-line `steps` as label and value
  pairs, the totals of `sumMonth`.
- New `MonthList.tsx`, `LineTable.tsx`, `TotalsPanel.tsx` (read-only here), `src/ui/Tag.tsx` + `retro.css` rules.
- New `src/tools/payout/demo/demoMonth.ts`: about 8 made-up orders covering every tag; loaded only when
  `import.meta.env.DEV` through a dynamic import, by a "Load demo data" button that exists only in a dev build.

Tests first: `monthView.test.ts`: grouping by order, row order, `formatLei` (thousands, two decimals, a negative),
tags in a fixed order, the totals equal `sumMonth`; `registry.test.ts` as above. The demo month is run through
`planMonthLines` and `calculateLine` in one test, so demo data cannot rot.

Docs: none. Verify: the gate; Browser pane at 1100 × 720 and 1360 × 860: the tile is green, the tool opens, the
demo month shows lines, tags and totals; `vite build` output holds no demo text (search `dist/` for a demo
product title).
Risks: a wide table at the 1100 minimum width: the table scrolls sideways inside its panel, the window does not.

### P6 Month screen: the two menus, remembered choices, fold-out, totals (about 90k, Sonnet)

Goal: the user sets _Printed by_ and _Painted by_ per line, sees the results change, and the choices survive a reload.
Waits on: P5.

Files:

- New `src/tools/payout/core/choices.ts`: pure: `defaultChoices(line, people, remembered)` (remembered per product,
  then the Settings default, Q7; _Painted by_ is empty and disabled for paint option `none`), `applyChoice`,
  `rememberChoice`, `mergeReload(oldMonth, freshLines)` (choices kept by line id; new lines get defaults; lines
  gone from the fresh load disappear), `blockingLines(view)` (blocked, or needing a choice, Q8).
- New `src/tools/payout/useMonth.ts`: loads the month file, saves after each choice, exposes the view.
- `LineTable.tsx`: the two `Select` menus per line, the "How we got this" fold-out (`<details>`), the tags.
  `TotalsPanel.tsx`: per person (print, paint, drybrush, total), company, fees, costs. `PayoutTool.tsx`: status
  bar text through `setStatus` ("3 lines need a look").

Tests first: `choices.test.ts`: remembered beats the default; a remembered person who no longer prints falls back;
a primed line takes the drybrush default; `mergeReload` keeps choices, drops vanished lines, defaults new ones;
`blockingLines` counts both kinds. Nothing else unit-testable: the rest is wiring.

Docs: none. Verify: the gate; Browser pane, both sizes: change a menu, the line and the totals change; reload the
page in `tauri dev`: the choice is still there; a second order of the same product starts with the remembered person.
Risks: recalculating every line on each change is fine at this size (hundreds of lines); do not add caching.

### P7 Close, lock, corrections, paid marks (about 95k, Fable medium)

Goal: a month closes only when clean, is then frozen for good, later refunds become corrections, totals get a Paid date.
Waits on: P6. Model: Fable medium: a locked money record and reversal logic with edge cases.

Files:

- New `src/tools/payout/core/closeMonth.ts`: pure: `planClose(month, settings, people, olderMonths)`: refuses
  while a line blocks (Q8) or an older month is open (Q13); else returns the closed file: settings and people as
  used, every `LineResult`, the totals, `closedAt`.
- New `src/tools/payout/core/corrections.ts`: pure: `planCorrections(closedMonths, currentFacts)`: for every
  locked line, its **effective state** is the locked one plus the corrections already locked in later closed
  months; a difference from the current facts (line gone, order cancelled, quantity or paid lower) gives one
  correction per person and for the company (Q12). Calling it twice with the same facts gives the same list.
- `storage/monthSchema.ts`: the closed parts become required when `status` is `closed`; `payoutStore.ts`:
  `writeMonth` **throws** if the stored month is closed. Paid marks: `markPaid(month, personId, date)`,
  `clearPaid` in `paid-marks.json`.
- New `CorrectionsBox.tsx`; `PayoutTool.tsx`: the Close button (a `Dialog` to confirm, listing what blocks),
  the locked look of a closed month (menus off), _Mark as paid_ with a date in `TotalsPanel.tsx` (closed only, Q14).
- `demo/demoMonth.ts`: one closed month and one late refund against it.

Tests first: `closeMonth.test.ts`: blocked line refuses, empty choice refuses, older open month refuses, the
closed file holds the results and is not changed by a later settings change (recompute from the snapshot gives the
same totals); `corrections.test.ts`: full refund after close reverses each person and the company exactly;
cancellation likewise; partial refund (Q12); a second run adds nothing; a correction already locked in a later
closed month is not made again; a correction rounds with the person's month total, not on its own; store test:
writing over a closed month throws.

Docs: none. Verify: the gate; Browser pane: close the demo month, the buttons and menus lock, the next month
shows the correction, mark a person paid, reload in `tauri dev`: all still there.
Risks: the lock is only as strong as `writeMonth`: nothing else may write under `months/`. Deleting a month file
by hand is the owner's way out; the tool offers no "reopen".

### P8 Statement: PDF and CSV (about 90k, Sonnet)

Goal: one A4 PDF and one CSV per person per closed month, saved where the user picks.
Waits on: P7.

Files:

- New `src/tools/payout/core/statement.ts`: pure: `buildStatement(closedMonth, personId, paidMark)`: total, the
  parts (print, paint, drybrush, corrections), the line list, the rules paragraph written from the month's own
  settings snapshot, the "Paid on" line, `statementId(month, personId)` (the month plus the first 6 characters of
  the person id, so a second export gives the same id).
- New `src/tools/payout/core/statementCsv.ts`: pure: `statementCsv(statement)`: a header row, one row per line,
  quoting of commas, quotes and line breaks, CRLF, a UTF-8 BOM so Excel reads the letters.
- New `src/tools/payout/core/statementDocument.ts`: pure: the `pdfmake` document definition (A4, margins, the
  table); a long line list flows to a second page instead of being cut.
- New `src/tools/payout/exportStatement.ts`: dynamic `import("pdfmake")`, `pickSaveFile` and `writeFileBytes`
  from `src/lib/files.ts`, file name through `safeFileName`. `TotalsPanel.tsx`: the PDF and CSV buttons (closed only).
- `package.json`, `pnpm-lock.yaml`: `pdfmake`, `@types/pdfmake`. `README.md`: a Payout section (what it does,
  where the data lives, that it only reads Shopify).

Tests first: `statement.test.ts` (parts add up to the total; corrections listed; the id is stable; the rules
paragraph carries the snapshot's rates, not the live ones); `statementCsv.test.ts` (quoting, a name with a comma,
a Romanian letter, CRLF, BOM); `statementDocument.test.ts` (page size A4, the total and the id are in the
content, one table row per line). The PDF rendering itself is the library: not tested.

Docs: README as above; the PR says which library, why, and what it pulls in (core rule 3).
Verify: the gate; in a **built** app (`corepack pnpm build:unsigned`, with `CARGO_TARGET_DIR` set): export a
demo statement, open the PDF: one A4 page, `ș` and `ț` render, the numbers match the screen; open the CSV in Excel.
Risks: the app's CSP is `default-src 'self'` with no `unsafe-eval`. If `pdfmake` needs eval or a worker in the
built app, stop and report: the fallback is `jspdf` with `jspdf-autotable` and an embedded OFL font, same pure
statement, a new document builder. The dev server does not enforce the CSP the same way, hence the built-app check.

---

### P9 Shopify loader for a month (about 105k, Fable medium). BLOCKED on S3.2 and the order scopes

Goal: _Load from Shopify_ fills the open month from real orders and can be pressed again and again.
Waits on: P8, `feat/voucher` (S3.2) merged to `main`, Q15. Model: Fable medium: the mapping decides real money.
**Touches Rust: `CARGO_TARGET_DIR` as in section 3.**

Files:

- New `src/tools/payout/shopify/ordersQuery.ts`: the query and its zod schema. Orders by `created_at`, one day
  wider than the month on both sides (the pure `monthOf` then decides, in the shop's `ianaTimezone`), cursor
  loop as in `src/tools/voucher/shopify/listCollections.ts` (same guard against a missing cursor). Per order:
  id, name, created and cancelled dates, financial status, taxes included, refunds with their lines; per line:
  ids, product title and tags, variant options, quantity, unit price, discount allocations, tax lines. Money is
  always the **shop** money (RON), never the presentment money. No customer name, email or address is asked for.
- New `src/tools/payout/shopify/variantsQuery.ts`: for the product ids of the lines that count, in batches:
  each variant's options, price and the inventory item's unit cost.
- New `src/tools/payout/shopify/mapOrders.ts`: pure: Shopify's shapes to `RawOrder` and `ProductVariants`
  (decimal strings to bani without floats; a deleted product or variant gives empty options and a null cost).
- New `src/tools/payout/shopify/loadMonth.ts`: takes the GraphQL call as a parameter (tests pass a stand-in),
  runs both queries, then `planMonthLines` and `mergeReload`. `PayoutTool.tsx`: the Load button with progress, the
  not-connected state with `openSettings(SHOPIFY_SETTINGS_SECTION)` (as `VoucherTool.tsx` does), errors shown as text.
- `src-tauri/src/shopify/oauth.rs`: `SCOPES` gains `read_all_orders`; its authorize-url test follows.

Tests first: `mapOrders.test.ts` on made-up Shopify answers: `"620.00"` to 62000 and `"0.1"` to 10, a line with
a code discount and an order discount, taxes included, a refund line, a deleted variant, an order in EUR
presentment still read in shop money; `loadMonth.test.ts` with a fake call: two pages merged, a missing cursor
throws, lines of the neighbour months dropped, a reload keeps choices. Rust: the scope test.

Docs: README: the two scopes, the reconnect. Field names are checked against the Shopify Admin API docs for the
API version in Settings before the query is written (a `researcher` job, read-only).
Verify: the gate. Then, **needs the owner's sign-off** (cannot be avoided: only a real store proves the mapping):

1. A new version of the Shopify app with both scopes, and a **reconnect** in Settings (issues a new token on the store).
2. The first live Load (read-only). The owner compares one finished month with the spreadsheet: one order with
   an order-level discount, one painted line, one partial refund, one cash-on-delivery order.

Risks: a nested query can pass Shopify's cost limit: keep line items at a modest page size and fetch variants in
the second query, never nested under orders. Unit cost may need a scope the app does not hold: if Shopify
refuses the field, stop and report (it would be one more scope, the owner's call). Without `read_all_orders`
Shopify silently returns only the last 60 days: the loader compares the oldest order date returned with the
month asked for and warns when a past month comes back empty.

### P10 Late refunds from Shopify, and the wrap-up (about 65k, Sonnet). BLOCKED on P9

Goal: a refund or cancellation on a closed month's order shows up as a correction after the next Load.
Waits on: P9.

Files:

- New `src/tools/payout/shopify/loadClosedChanges.ts`: orders created in closed months and **updated** since the
  oldest unclosed load, through the P9 query with another filter; mapped to current facts for `planCorrections`.
- `loadMonth.ts` and `useMonth.ts`: after the month's own load, the corrections of the oldest open month are
  replaced by the fresh plan (Q13).
- `README.md`: the monthly routine in five lines. This file: the Progress section closed.

Tests first: `loadClosedChanges.test.ts` with a fake call: the filter holds the right dates; an order updated
but with nothing changed gives no correction; a refund gives one; a second Load gives the same list, not two.

Docs: README. Verify: the gate; **needs the owner's sign-off** for the live check: refund a test order of a
closed month in the store (the owner does that write, not the tool, not an agent), Load, see the correction.
Then the standards and spec review (`inspector`, two fresh agents), one fixer slice if needed, the PR.
Risks: an order edited for another reason (a note, a tag) comes back in the "updated" filter: it must produce
nothing. That is the second test above.

---

## 7. Sign-offs in one list

| What                                                       | Why it cannot be avoided                                          |
| ---------------------------------------------------------- | ----------------------------------------------------------------- |
| Merge of chunk A's PR to `main`                            | it is the shared branch other tools release from                  |
| The access request for all orders on the Shopify app (Q15) | Shopify gives orders older than 60 days only after it             |
| New app version with the scopes, and the reconnect (P9)    | a token carries the scopes it was issued with                     |
| First live Load and the spreadsheet comparison (P9)        | only real orders prove the field mapping                          |
| The refund on a test order (P10), done by the owner        | the tool never writes to the store; the correction path needs one |
| Merge of chunk B's PR, and any release tag                 | a release reaches both stations through the updater               |

No slice writes to Shopify, the tracker or a release. Agents do none of the above.

## 8. Found, not in scope

- The spec's header still says "draft for sign-off". If it is signed off, the header wants one line changed.
- The local `main` worktree is at `369cd48`, three merges behind `origin/main`.
- `src/lib/files.ts` (on `origin/main`): `safeFileName` falls back to `"disc-design"`, a Disc Studio word in shared code.
- `oauth.rs` on `feat/voucher` asks for `read_orders` but nothing there uses it yet; the Voucher README says the
  Shopify app needs a new version for it. P9's new version can carry both scopes in one go.
- Voucher S3.4 will write a `codes.csv`. When it does, its writer and `statementCsv` are the second consumer of
  CSV quoting: promote one shared helper then (rule of two), not now.

## 9. Slice table

| Id  | Behaviour                                                    | Estimate | Waits on                  | Files                                                                                                          | Model                                   |
| --- | ------------------------------------------------------------ | -------- | ------------------------- | -------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| P1  | exact amounts, the line maths, month totals, with tests      | 90k      | rebase on `origin/main`   | `src/tools/payout/core/{exactAmount,types,payoutMath,monthTotals,percent}.ts` + tests                          | Fable medium: money, many edge cases    |
| P2  | raw order to maths inputs: rule, paint option, cost, refunds | 90k      | P1                        | `core/{rawOrder,productRule,paintOption,lineCost,orderMonth,lineFacts}.ts` + tests                             | Fable medium: silent-failure edge cases |
| P3  | app data commands and the typed payout store                 | 85k      | P1                        | `src-tauri/src/app_data.rs`, `lib.rs`, `src/lib/appData.ts`, `storage/{schemas,payoutStore}.ts`                | Sonnet                                  |
| P4  | Settings › Payout                                            | 80k      | P3                        | `settings/*`, `payout.css`, `src/app/settings/sections.tsx`                                                    | Sonnet                                  |
| P5  | the tool on the home grid, a read-only month from demo data  | 90k      | P2, P3                    | `types.ts`, `registry.ts` + test, `index.ts`, `PayoutTool.tsx`, `core/monthView.ts`, `src/ui/Tag.tsx`, `demo/` | Sonnet                                  |
| P6  | the two menus, remembered choices, fold-out, totals          | 90k      | P5                        | `core/choices.ts`, `useMonth.ts`, `LineTable.tsx`, `TotalsPanel.tsx`                                           | Sonnet                                  |
| P7  | close, lock, corrections, paid marks                         | 95k      | P6                        | `core/{closeMonth,corrections}.ts`, `storage/*`, `CorrectionsBox.tsx`, `PayoutTool.tsx`                        | Fable medium: locked money record       |
| P8  | statement PDF and CSV                                        | 90k      | P7                        | `core/{statement,statementCsv,statementDocument}.ts`, `exportStatement.ts`, `package.json`, README             | Sonnet                                  |
| P9  | Shopify loader for a month, `read_all_orders`                | 105k     | P8, **S3.2 on main**, Q15 | `shopify/{ordersQuery,variantsQuery,mapOrders,loadMonth}.ts`, `PayoutTool.tsx`, `oauth.rs`                     | Fable medium: the mapping decides money |
| P10 | late refunds become corrections; README; review              | 65k      | P9                        | `shopify/loadClosedChanges.ts`, `loadMonth.ts`, `useMonth.ts`, README                                          | Sonnet                                  |

**Sum: about 880k** (chunk A 710k, chunk B 170k), plus the review and one fixer slice.

**Blocked on S3.2:** P9 and P10 only. P1 to P8 need nothing from `feat/voucher`.

**Parallel:** no slice both shares no file and waits on nothing: P1 is first. After P1, **P2 and P3** share no
file and may run side by side; after P3, **P2 and P4** likewise. Only in separate worktrees: two sessions in one
worktree share one git index and sweep each other's staged files. Everything from P5 on runs in order
(`PayoutTool.tsx`, `TotalsPanel.tsx` and the store are touched by each).

## Progress

(One line per finished slice: what landed, the decisions taken, what the next slice must know.)

- **P1 done.** `core/{exactAmount,types,payoutMath,monthTotals,percent}.ts`, 84 tests. Decided: whole money is a number of bani (`paidBani`, `costBani`), anything that can hold a fraction is an `ExactAmount`; `LineResult` is a union, and a blocked line has a reason and no amounts; a third block reason `no-list-price` and a sixth tag `negative-paint` were added; a painted line with quantity 0 is all zeros, not blocked. `sumMonth` takes corrections as `LineAmounts` (the change to a whole line: paid, fee, cost, shares, company), so the month still adds up to the ban; it leaves blocked lines out and counts them in `blockedLines`. Next slices must know: `calculateLine` sets only `min-drybrush`, `stays-in-company`, `loss` and `negative-paint` (P2 adds `cost-from-table` and `not-paid-yet`); an empty or unknown _Printed by_ or _Painted by_ pays nobody, goes to the company and carries no tag (P6 adds "needs a choice"); there is no function yet that writes a whole `LineResult` as `"n/d"` strings (P3 owns the stored shape; `formatAmount` and `parseAmount` are the two ends); `percentToBasisPoints` takes a dot only, 0 to 100, and returns null on bad text.
- **P2 done.** `core/{rawOrder,matchText,productRule,paintOption,lineCost,orderMonth,lineFacts}.ts`, 92 tests (176 in the payout core). `planMonthLines(orders, productVariants, settings, month)` returns `{ lines, leftOut }`; a `PlannedLine` holds the order and line ids and titles, `facts` (a `LineInput` without the two people), `tags` (`cost-from-table`, `not-paid-yet`) and `orderWarning` (`refund-without-lines` or null, the same on every line of the order). Decided: text is compared through one `toMatchKey` (trimmed, inner spaces collapsed, lower case) for tags, extra-product titles, option names and values, and cost-table rows; an extra product counts even with an exclude tag; `RawOrder.financialStatus` is a lower-case union of eight values and `expired` is kept with no tag; `RawRefundLine.subtotalBani` is **without tax and after discounts** and `RawLine.discountAllocatedBani` and `taxBani` are for the whole line (P9 maps to that); `paid` = unit × ordered quantity − discounts − tax (only when taxes are included) − refund subtotals; `listBani` = unit × quantity left and keeps the tax, as the current primed price does, so the ratio takes the tax out of a painted print price; the cost function is `resolveUnitCost` (per piece, source `shopify` or `table`), a cost of 0 in the shop is a cost, and a painted line whose primed sibling has no cost goes to the table, never to its own variant; a cost-table size matches any option value of the line; a primed line gets its own current price as `primedUnitBani`; `listMonths(firstMonth, lastMonth)` takes two `YYYY-MM` texts (the caller passes `monthOf(now, zone)`); more pieces refunded than ordered throws with the order name; `leftOut` counts orders for `other-month`, `cancelled`, `voided`, `refunded` and lines for `not-payout-line`, `no-units-left`. Next slices must know: `LineFactsSettings` is `{ rule, costTable, timeZone }` and P4 stores `ProductRule` and `CostTableRow` as typed here; `ProductVariants` must hold the **current** variants of every product in the month, or a painted line blocks on `no-primed-price`; the line tags shown are the fact tags plus the ones `calculateLine` returns (P5 joins them); `RawRefundLine.createdAt` is carried for P10 and read by nothing yet; a line fully refunded by money alone (pieces kept) stays in the month with `paid` 0.
- **P3 done.** `src-tauri/src/app_data.rs` (`read_app_text`, `write_app_text`, `list_app_files`, 16 Rust tests), `src/lib/appData.ts`, `storage/{schemas,payoutStore}.ts` (19 TS tests, plus 1 for `appData.ts`), `lib.rs` (one `mod`, three handler lines), a part in `docs/learning-tauri.md`. Decided: `resolve_inside` also refuses a part that starts or ends with a dot and the Windows device names (`con`, `nul`, `com1` ...), and the write refuses to replace a file whose top-level `status` is `"closed"` (Rust holds the lock for P7; no other file may use that status); a temp file is `<name>.tmp` and the list hides it; files are `payout/{settings,people,choices,paid-marks}.json` and `payout/months/<yyyy-mm>.json`; every file has `version: 1`, a read of a missing file gives a fresh copy of the default, a broken, wrong-shaped or other-version file throws with the file name, and a write is validated with the schema first, so a bad value is never stored. `DEFAULT_SETTINGS` holds rates 0, no cost rows, first month `""` and the spec's default tags. Stored shapes: settings `{ version, rates: { feeBp, splitBp, drybrushBp, drybrushMinBani }, rule: ProductRule, costTable: CostTableRow[], firstMonth }` (no time zone: P9 reads the shop's); people `{ version, people: { id, name, prints, paints, getsPaid, defaultFor: ("printing" | "painting" | "drybrush")[] }[] }`; choices `{ version, byProduct: { [productId]: { printedBy, paintedBy } } }`; paid marks `{ version, marks: { month, personId, paidOn: "yyyy-mm-dd" }[] }`. Next slices must know: `getPayoutStore()` is the store (desktop: app data folder; plain browser: one memory store per page load); the store is `createPayoutStore(backend)` over a `TextBackend`, and `createMemoryBackend(seed)` exposes `files` for tests; `readMonth`, `writeMonth(month, schema, value)` take the month schema as a parameter and `listMonthKeys()` lists months oldest first; P5 owns the month schema and its `version`; P7's TS `writeMonth` should still throw on a closed month (the memory store has no lock yet, only Rust does); a Rust refusal reaches the page as an `Error` with the Rust message; the people ids are free text (P4 makes them with `crypto.randomUUID()`); `defaultFor` uniqueness is P4's rule, not the schema's; P7's `markPaid` and `clearPaid` are not written yet (they are `readPaidMarks` and `writePaidMarks` with a changed list).
- **P4 done.** `settings/{fieldText,peopleForm,settingsForm}.ts` (62 tests, each rule proved red by putting the bug back), `usePayoutSettings.ts`, `PayoutSettingsSection.tsx`, `PeopleTable.tsx`, `RatesFields.tsx`, `ProductRuleFields.tsx`, `CostTable.tsx`, `sectionId.ts` (`PAYOUT_SETTINGS_SECTION = "payout"`), `payoutSection.ts`, `payout.css`; `sections.tsx` gained one import and the line `payoutSection,`. Decided: the screen holds a text draft (`SettingsDraft`) and saves on every change **only when `settingsFromDraft` / `validatePeople` find no problem**, so the files never hold half-typed values (the problems are listed under the section); `parsePercentText` accepts one comma as the decimal mark (`percentToBasisPoints` stays dot-only), `parseMoneyText` takes lei with a dot or comma and at most 2 decimals; tags are stored lower case, trimmed, one spelling per tag (`parseTagList`), extra products are one title per line (a title may hold a comma) and are typed, not picked: P9 may add a picker once the loader can list products; the rule needs at least one include tag or one extra product; blank cost rows are skipped, a size left blank is `sizeValue: null`, two rows with the same product and size (compared by `toMatchKey`) are refused, a cost of 0 is allowed; first month may be empty (not set yet) or `yyyy-mm`; `defaultFor` has three jobs (Q7) and a person can be the default only for a job they do (printing needs Prints, painting and drybrush need Paints); `setPersonDefault` moves the job off its old holder, so at most one person holds it; turning Prints or Paints off drops the defaults that needed it; `removePerson` is refused while the person is any default; Q5: a print farm is a person with Prints on and Gets paid off, no other flag; a new person is `getsPaid: true`, id from `crypto.randomUUID()`. The Settings dialog is 480px and does not scroll, so `payout.css` widens and scrolls a dialog that holds `.payout-settings` (`:has`); the rules are scoped to it. Next slices must know: P5 to P8 read people and settings only through `getPayoutStore()`; a stored person can have an empty `name` only if a file was edited by hand (the screen never saves one); `removePerson` does not look at remembered choices (P6) or closed months (P7): a closed month must freeze the person's name and `getsPaid`, since a person can be removed later and the choices of a removed person must be ignored by P6; `jobsOf(person)` (in `peopleForm.ts`) lists the jobs a person may be a menu default for; P5 opens this section with `PAYOUT_SETTINGS_SECTION` from `settings/sectionId.ts` and must not import the section's component.
- **P5 done.** Payout is on the home grid (green); `index.ts`, `PayoutIcon.tsx`, `PayoutTool.tsx`, `MonthList.tsx`, `LineTable.tsx`, `TotalsPanel.tsx`, `usePayoutData.ts`, `src/ui/Tag.tsx` (+ rules at the end of `retro.css`), `storage/monthSchema.ts`, `core/{formatLei,monthView,monthList,monthLines}.ts`, `demo/demoMonth.ts`; 40 new tests; the screen was checked in a browser at 1700, 1360, 1100 and 700 wide. Decided: **`ToolContext.openSettings` and `SettingsWindow.focusSectionId` are on `feat/voucher`, not on this branch (the plan said `origin/main`: it is wrong)**, so "first month not set" is a text ("open Settings, the gear at the bottom right") plus a _Check again_ button, with no jump to the section; wiring `openSettings(PAYOUT_SETTINGS_SECTION)` is one line once the two branches meet. The month file is `{ version, month, status: "open" | "closed", timeZone, loadedAt, lines }` and a line is `{ orderId, orderName, orderCreatedAt, lineId, productId, productTitle, variantTitle, facts (a `LineFacts`), tags (the fact tags), orderWarning, printedBy, paintedBy }`; `core/monthLines.ts` `toMonthLines(plan, orders, choiceOf)` builds it from `planMonthLines` (the loader and the demo both use it; `choiceOf` is where P6's `defaultChoices` goes); the closed-only parts are not in the schema yet (P7 adds them; the top-level `status` is what Rust reads for the lock). The view (`buildMonthView(file, settings, people)`) calculates each line once and gives rows (money as text through `formatLei`: `1,234.50`, `−34.09` with a real minus, rounded per line for display only), orders in date order (grouped by order id even when the file lists them apart), `steps` as label and value pairs (drawn by P6's fold-out, not yet), tags in a fixed order with a `place` (`product`, `printed`, `painted`): _stays in company_ goes under the person whose part stays (one tag per cell), _drybrush: minimum_ under Painted by, the rest next to the product; "not paid yet" and the refund-without-lines warning are on the order header, not on each line; `notices` (blocked lines by reason, orders with a refund tied to no line) feed the red banner. Tags under the menu, not beside it, as the owner asked: the Painted by and Printed by cells are a column (`.payout-stack`). The column "Owed to" lists each person's total for the line (print + paint + drybrush), the mockup's person columns would not fit a variable list of people. Month list: `buildMonthList({ firstMonth, currentMonth, files })` is every month from the first to now plus every month that has a file, newest first, status `open`, `closed` or `not-loaded`; "now" is the month on this PC's clock and zone (P9 should cut by the shop's zone). **Demo data is in memory only**: the button _Load demo data_ (shown when `import.meta.env.DEV`) imports `demo/demoMonth.ts` dynamically and the screen shows its own settings, people and month over the real ones; nothing is written, so it cannot overwrite real files in `tauri dev`. A release build holds none of it (checked: `dist/` has no demo title, person id or module; only the button label text stays in the unrendered branch). The demo month is March 2031 (made up, far from any real month), 9 orders, every tag, 2 blocked lines, a cancelled and an other-month order that are left out; one test runs it through `planMonthLines`, the schema, `calculateLine` (the exact identity per line) and `buildMonthView`. Layout: the lines table scrolls sideways inside its own box; the totals sit under it as cards, and beside it from a main part 1240px wide (a container query, rules last in `payout.css`). Next slices must know: the view takes `corrections` nowhere yet (`sumMonth(results, [])`; P7 adds the argument and the Corrections box); `PayoutTool` has no _Close month_ button (P7) and the _Load from Shopify_ button is disabled with its reason in the text under the title (P9 enables it); `usePayoutData` reads Settings, people and every month file on mount, on window focus, on picking a month and on _Check again_, because the tool stays mounted under the Settings dialog and gets no signal when it closes (P6's `useMonth` should keep that, and write through the store, never from this hook); the demo bundle is a separate source in `PayoutTool`, so P6's menus and P7's close must either work on it in memory or be disabled while `demo !== null`; a month file that cannot be read stops the whole screen with the file name (as the settings do); `src/ui/Tag.tsx` has the tones `plain`, `warn`, `good`, `danger` and the view's `TagTone` repeats the same union so `core/` does not import from `ui/`.
- **P6 done.** `core/choices.ts` (+46 tests), `saveChoice.ts` (+4), `useMonth.ts`, the two `Select` menus and the `<details>` fold-out in `LineTable.tsx`, notes in `TotalsPanel.tsx`; `monthView` gained 7 tests, `Select`/`FieldFrame` got `hideLabel` (a label read by screen readers, not drawn; rule at the end of the Fields part of `retro.css`). Checked in a browser at 1500 and 700 wide on the demo month: changing _Painted by_ moves the line's pay and the totals at once, the fold-out opens with the keyboard, no sideways page scroll. Decided: **menus work in memory on the demo** (no write; the demo month changed on purpose: one line has no printer, so the "needs a choice" tag is seen). Rules: a menu lists people who Print (_Printed by_) or Paint (_Painted by_), in Settings order, after an empty "Choose..."; a person chosen earlier who no longer does the job stays in that menu as "Name (does not print now)"; a removed person is no choice (the menu shows the empty option, the line is tagged, the part pays nobody). `defaultChoices(line, people, remembered)`: the remembered person for the product (only if they still exist and do the job), else the Settings default (printing; a primed line takes the drybrush default, a partial or complete line the painting default), else null; no painter for paint option `none`. **Remembered is one _Painted by_ per product**, shared by its primed and painted lines (the stored shape from P3 has no split). `mergeReload(oldLines, freshLines, people)`: fresh lines already carry their defaults; a line that was there keeps each choice by line id unless it is empty or points at a removed person; vanished lines go; order is the fresh order. `listMissingChoices(line, people)` and the view's `missingChoices`, tag `needs-choice` (label "needs a choice", danger, one under each empty menu), `needsChoiceLines`, a notice and ", N need a choice" in the status text; `blockingLines(view)` returns `{ blocked, needsChoice, total }` (a line both counts once in `total`): **P7 blocks Close on `total > 0`**. Writes: a choice shows at once (a draft over the file read), then `saveChoice` writes the month file and then the remembered choices through the store, one write after the other; a failed write goes back to the file as read and shows a red line; when the last write ends the data is re-read. A closed month's menus are disabled (P7 must also not rely on that: Rust refuses the write). Next slices must know: P9 builds a month with `toMonthLines(plan, orders, (line) => defaultChoices(line, people, await store.readChoices()))` and merges a reload with `mergeReload`; Settings defaults changed after a load do not fill lines already empty (they fill on the next load); clearing a menu back to "Choose..." is allowed and blocks Close; the totals panel says how many blocked lines it leaves out and how many lines pay nobody. Not checked in a browser: that a choice survives a reload (the plain browser keeps files in memory only; the write path is unit-tested with the memory store and `tauri dev` was not run).
- **P7 done.** `core/{closeMonth,corrections}.ts`, `storage/amountCodec.ts`, the closed parts in `storage/monthSchema.ts`, the TS lock and `markPaid`/`clearPaid` in `payoutStore.ts`, `CloseMonthDialog.tsx`, `CorrectionsBox.tsx`, `usePaidMarks.ts`, _Mark as paid_ in `TotalsPanel.tsx`, the Close button in `PayoutTool.tsx`; 59 new tests (nine bugs put back one at a time, each failed a test), `core/testMonths.ts` holds the made-up months the tests share. Checked in a browser at 1500 and 700 wide on the demo: Close asks first, Escape and Cancel close nothing, the refusal lists what blocks, a closed month shows the same totals with every menu disabled, a paid mark is set and cleared. Decided: **the month file is a union**: open `{ ..., status: "open", corrections? }` (left out means none), closed `{ ..., status: "closed", corrections, closedAt, settings: { rates, rule, costTable }, people (the whole stored people list), results: [{ lineId, result }] (one per line, in line order, the schema refuses anything else), totals }`; amounts in a closed file and in a correction are `"n/d"` text, and `amountCodec` (`storeAmounts`/`readAmounts`, `storeResult`/`readResult`, `storeTotals`/`readTotals`) is the only crossing. `planClose({ file, settings, people, months, closedAt })` returns `{ kind: "ready", closed }` or `{ kind: "refused", blockers }`; a month that was never loaded counts as not closed, so a month with no orders must still be loaded and closed before a later one (Q13). `buildMonthView` **reads** a closed month (its own results, totals, rates and people) and ignores the live Settings; it only works out an open one. **A correction is one per changed line, not one per person**: `{ sourceMonth, lineId, orderName, productTitle, variantTitle, reason: "removed" | "reduced", amounts }`, where `amounts` is the P1 `LineAmounts` change (the shares in it are the per-person parts, `company` the company part), so `sumMonth` takes it as it is. `planCorrections(closedMonths, currentLines)` takes `{ month, lineId, state: { qty, paidBani, listBani } | null }`; null is a line that is gone (refunded in full, or its order cancelled). **Only those three values come from now**: the cost per piece, the primed price, the paint option, the two people, the rates and each person's `getsPaid` are the locked ones, so a price or cost edited in the shop after the close, or an order touched for another reason, gives no correction. The effective state is the locked result plus every correction for that line in any closed month; no change gives no correction. It throws for a month that is not closed, a line the month does not hold, a quantity of 0 (pass null) and a cost that does not divide by the quantity. `findCorrectionsMonth(months)` is the oldest month not closed. The view shows a person who is gone from Settings as "Unknown person" instead of dropping their total (only a correction can name one). The lock: `writeMonth` reads the stored file first and throws if its top-level `status` is `closed`, on both backends; Rust still refuses too. `markPaid` throws unless the month file is closed (Q14), keeps one mark per person and month, and never touches the month file. **The demo is now a memory store of its own** (`createDemoStore()`: January closed with one paid mark, February open and clean with two late refunds from January, March as before), so Close and Paid run the real code on it and nothing reaches the PC; `usePayoutData(store)` and `useMonth({ store })` take the store, and data read from one store is never shown over another. Closing goes through the same write queue as the choices. Next slices must know: P8 reads a closed month through `readResult`/`readTotals` and takes the rates from `closed.settings`, the names from `closed.people`, the paid day from `data.paidMarks` (`usePaidMarks` gives `paidOnOf`); its PDF and CSV buttons go in `PersonCard` next to `PaidMark`, shown when `paid !== null`. P9 must write an open month **with the `corrections` it already carries** (a reload that drops the field loses them) and must create a file for a month with no orders. P10 maps each changed order line of a closed month to `{ qty, paidBani, listBani }` with P2's rules (or null when the line is gone), calls `planCorrections` with **every** closed month, and writes the list as the `corrections` of `findCorrectionsMonth(...)`, replacing what was there; it may pass unchanged lines too, they give nothing. Not checked: a reload in `tauri dev` (the Rust lock has its own test from P3, the TS path is tested on the memory store); the Tauri window was not run in this slice.

- **P8 done.** `core/{statement,statementCsv,statementDocument}.ts` (42 tests; 21 bugs put back one at a time, each failed a test), `exportStatement.ts`, `useStatementExport.ts`, the PDF and CSV buttons in `PersonCard` (`TotalsPanel.tsx`, `PayoutTool.tsx`, a rule in `payout.css`), `monthView.ts` now exports `formatMoment` and `UNKNOWN_PERSON`, README gained a Payout section, `package.json` and the lockfile gained `pdfmake` 0.3.14 and `@types/pdfmake` 0.3.3 (both pinned exactly, without a caret: the plan asked for pinned, the rest of the file uses carets). **CSP checked, no change needed:** the production bundle (`vite build`) was served with the exact CSP string of `tauri.conf.json` to Chromium (WebView2's engine); a probe proved `new Function` is blocked under that header, and pdfmake still built a PDF with no security-policy violation, no eval and no worker; the `jspdf` fallback was not needed, and `tauri.conf.json` is untouched. A full Tauri build was not run. pdfmake's two lazy chunks are about 770 kB and 850 kB (gzip 290 kB and 470 kB); the start chunk did not grow. Decided: **buttons only for a closed month (Q14)**: `paid !== null` and the closed file are the same thing, the exporter is built from the closed file only. `buildStatement(closed, personId, paidOn)` reads the month through `readResult`/`readTotals`, rates from `closed.settings`, names from `closed.people` ("Unknown person" for one that is gone), and throws for a person with no part in the month. The total is the locked `totalBani`; **parts and lines are rounded for display, so each list ends with a "Rounding" row when its rounded rows miss the total by a ban** (a test pins both cases), which keeps the PDF and CSV adding up exactly. Parts: print share (the split % from the snapshot), painting, drybrush, corrections, always the four, even at 0.00. Lines: one row per share the person has (print, paint, drybrush; "Drybrush (min.)" when the line carries the minimum tag), a share of exactly 0 is left out, rows in the month screen's order (order date, then order name), then one "Correction" row per correction that touches the person, with the source month and why in the item text; a correction has no quantity. The rules paragraph is one fixed text with the snapshot's fee, split, drybrush % and minimum; the statement id is `PAY-<yyyy-mm>-<first 6 letters or digits of the person id, capitals>` (not the mockup's wording: no company initials in a public repo). The page is Roboto only (bundled in pdfmake, has `ș` `ț` `Ă` `â` `î` and the real minus), no mono font; "Paid on" is the paid mark's date or a blank line to write on; the footer shows the id and the page number only when there is a second page. The CSV: columns `Statement,Person,Order,Item,Qty,Work,Amount (lei)`, a Total row, comma, CRLF, BOM, a dot decimal, plain ASCII minus, no thousands mark, and a text cell that starts with `=` `+` `-` `@` gets an apostrophe in front (shop titles are data). Open in Excel was not tried; a PC set to Romanian regional settings may read the dot or the comma wrongly: if so, the fix is one function in `statementCsv.ts`. Save: the dialog comes first (a cancel builds nothing), the file name starts as `Payout <yyyy-mm> - <name>`, the bytes go through `writeFileBytes`; in a plain browser the click shows the one "desktop app only" error. Checked: the PDF rendered to an image (one page for 11 lines; two pages for 45 with the header repeated and the footer), and the buttons in a browser on the demo (two buttons per person in the closed month, none in the open one). Not checked: a real save in the Tauri window, and the CSV in Excel. Next slices must know: P9 and P10 do not touch statements; a statement of a month is only as right as the closed file, which P7 locks.
- **Review fixes done.** Every rate and price in the branch is now made up: fee 3%, split 60%, drybrush 12% with a minimum of 20.00 (the spec's worked example is 620.00 / 230.00 / 53.00 and a 70.00 bust; `testMonths.ts` keeps its own minimum of 10.00), and every expected value was worked out again by hand; the maths did not change. An `expired` order is left out and counted (`leftOut.expired`). The CSV guard also puts an apostrophe before a formula character that follows `;`, `,` or a tab inside a cell, and knows the full-width forms. `write_app_text` syncs the temp file to disk before the rename; `COM0` and `LPT0` are device names. Comments no longer name plan questions or slices. `MonthScreen` is split into `useChosenMonth`, `useCloseDialog` and `SaveErrors`, same behaviour. **The next slice must know:** `LeftOutReason` has a seventh key, `expired`; the earlier commits of this branch still hold the old numbers, so the branch must reach the public remote as one squashed commit.
