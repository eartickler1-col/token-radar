# Token Radar 2

[![make.fun](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01)
[![Rank](https://make.fun/badge/token-radar-01/eartickler1-col/token-radar/rank.svg)](https://make.fun/bounty/token-radar-01)
[![Reward](https://make.fun/badge/token-radar-01/eartickler1-col/token-radar/reward.svg)](https://make.fun/bounty/token-radar-01)

A token launch radar: it ranks the protocols that record no token by what a token would be
worth if their record stayed as it is, and shows a reader how to farm each one. Built for the
[Token Radar bounty](https://make.fun/bounty/token-radar-01) on make.fun.

## What it does

`main.ts` reads a sealed DefiLlama snapshot (`/input/snapshot.json`, 758 protocols as of
2026-11-14), scores every rankable pre-token protocol, and writes the ranked board to
`/output/board.json`, the dashboard's data to `/output/data.js`, and the dashboard and
screenshots to `/output`, with a dossier (`/output/dossier.json`) the judge reads.

The board covers all 40 protocols on the snapshot's watchlist (every protocol with at least
$50M of TVL and no token on record) and adds 157 more pre-token protocols from below the
floor, for 197 rows. Protocols whose token already trades are kept apart in the Live view,
shown at their market cap, never mixed into the ranking. The dashboard is a static page with
no network: a sortable, filterable board, a detail view for every protocol with its model
breakdown and farm plan, and a panel that states the model.

## The value model

One function, `impliedValueOf` in `lib/model.ts` (and recomputed row by row by the dashboard's
own `impliedValueOf` in `dashboard/app.js`), scores every protocol from the snapshot's own
figures: implied value is TVL times 0.20, times a growth multiplier of 1 + 0.45 × tanh of the
seven-day TVL change clamped to −80…200% (so a wild week bends the number instead of exploding
it), times a maturity multiplier that grows from 0.65 to 1.00 with age since first listing up to
four years, times a breadth multiplier of 1 + 0.02 per extra chain up to five chains. No
protocol name is ever special-cased. Each row also carries a seven-step farm plan derived from
its category, chains, TVL and age, with what each step costs and how long it takes.

## How to run it

Requires Node.js 22.18 or later, nothing to install (standard library only):

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <path to snapshot.json>
```

The program runs twice and writes the same bytes both times. Open `out/dashboard/index.html`
in a browser to use the radar; the board is in `out/board.json`.

## License

MIT. See [LICENSE](LICENSE).
