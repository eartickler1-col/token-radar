# Launch Radar v2: fitted size curve, token odds, netted farm verdicts

[![make.fun](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/eartickler1-col/token-radar/rank.svg)](https://make.fun/bounty/token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/eartickler1-col/token-radar/reward.svg)](https://make.fun/bounty/token-radar-01)

A web dashboard that ranks the 289 pre-token protocols in a sealed DefiLlama snapshot by
implied launch value, with a farm verdict for each row. Every number on the board is fitted
from the snapshot itself, in the run that produced it — nothing is typed in from elsewhere.

## How it works

- **Value model.** A log-log size curve, `log(mcap) = 6.1397 + 0.5686 · log(TVL)`, fitted by
  OLS on the snapshot's 128 live-token comps (R² 0.2478 after a one-pass robust refit that
  drops Rain and xDAI Stake Bridge, the two comps more than 2.5σ off the line). A
  per-category factor shrinks the mean log-residual `n/(n + 10)` toward 1 and caps it at
  0.5–2.5×. 7-day growth gets weight 0 — the fit finds no reliable growth effect
  (corr −0.145, t = −1.62) — and age gets no term in the value at all; it enters once,
  through the odds.
- **Token odds.** A logistic fit on all 758 protocols: P(token) rises with age — 14% at
  30 days, 44% at a year, 66% at four years. The odds are the peer share (of 100 protocols
  that reached this age, how many record a token), not a hazard: the snapshot is one
  cross-section with no launch dates, so no hazard can be fitted from it, and a protocol
  still pre-token at 4y+ has outlived the typical launch window, so its peer-share odds
  are an upper bound.
- **Discount.** A protocol sharing its first word with a traded token, or a wrapped, staked
  or bridged product, is a second pool of a token that already trades. It pays ×0.5 on the
  launch value and ×0.5 on the odds — total ×0.25 — with the reason shown on its row.
- **Expected value** is launch value × token odds. The board is sorted by it.
- **Farm verdicts.** For each row, the smallest capital tier in $50–$5,000 whose slice of
  the airdrop pool (10% of expected value) beats its fees (5 transactions at the cheapest
  of the first three chains, plus a $2 claim and $5 bridge) and the T-bill at 4% a year over
  the hold is FARM; else the best tier is THIN when its slice beats its fees but the
  T-bill eats it, SKIP when it never beats its fees. The detail view shows the arithmetic
  and recomputes it live at any capital and airdrop share.
- **Validation.** Leave-one-out error ×4.82 against a flat multiple's ×5.84; walk-forward
  (fit before 2024, test 2024+) ×4.81 vs ×6.00; backward ×4.40 vs ×4.63. The typical miss
  is about ×5, so every rank is shown with a bootstrap p10–p90 range.

## Coverage

289 rows ranked (all 40 watchlist protocols plus 249 below the $50M floor), 416 live-token
protocols set aside with their market caps, and 53 excluded products named with the reason
in the audit view — 758 accounted for, nothing silently dropped.

## Run it

```sh
node main.ts --input <path to snapshot.json>
```

The program reads the snapshot, fits the model, writes `board.json`, `data.js`, the
dashboard and three screenshots' source, and a dossier. Two runs write byte-identical
output. It needs Node 22+ and the standard library only; no network.

## Files

- `main.ts` — entrypoint: reads the snapshot, builds the radar, writes the output.
- `lib/model.ts` — the fit, the odds, the farm economics, the board builder.
- `dashboard/` — the static dashboard: `index.html`, `app.css`, `app.js`.
- `screenshots/` — board, detail and filtered views at 1440×900.
