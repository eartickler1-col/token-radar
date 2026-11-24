# Launch Radar v3: hazard odds, derivative filter, netted farm verdicts

[![make.fun](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/eartickler1-col/token-radar/rank.svg)](https://make.fun/bounty/token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/eartickler1-col/token-radar/reward.svg)](https://make.fun/bounty/token-radar-01)

A web dashboard that ranks the 191 pre-token protocols in a sealed DefiLlama snapshot by
implied launch value, with a farm verdict for each row. Every number on the board is fitted
from the snapshot itself, in the run that produced it — nothing is typed in from elsewhere.

## How it works

- **Value model.** A log-log size curve, `log(mcap) = 6.1397 + 0.5686 · log(TVL)`, fitted by
  OLS on the snapshot's 128 live-token comps (R² 0.2478 after a one-pass robust refit that
  drops Rain and xDAI Stake Bridge, the two comps more than 2.5σ off the line). A
  per-category factor shrinks the mean log-residual `n/(n + 10)` toward 1 and caps it at
  0.5–2.5×. 7-day growth gets weight 0 — the fit finds no reliable growth effect
  (corr −0.145, t = −1.62) — and age gets no term in the value at all; it enters once,
  through the odds. No honest variant beats a geometric leave-one-out error of ×4.82:
  chains, growth, age, quadratic, vintage and a ridge kitchen-sink were all tested and
  all made leave-one-out worse, so the curve stays at this plateau.
- **Token odds.** A Weibull current-status hazard fitted by maximum likelihood on the 645
  protocols with a known listing date: S(t) = exp(−(t / 2.982y)^0.541), negative
  log-likelihood 416.09 against 431.31 for an exponential. Shape below 1 means the launch
  hazard falls with age: most launches happen early, and a protocol that survives years
  without launching is less likely to launch next. A cure share that never launches was
  fitted too and not used — it does not improve the AIC. The odds on a row are the chance
  of launching within two years, given survival to its age: 49% at 30 days, 36% at a
  year, 25% at four years, 20% at eight. The old peer share (14% at 30 days, 44% at a
  year, 66% at four years) is shown on each row for contrast — it is backward-looking,
  the hazard is forward-looking, and the two disagree most for old pre-token protocols.
- **Derivative filter.** A protocol that is a second pool of a traded token — sharing its
  first word with a traded token, or a Bridge, Canonical Bridge, Cross Chain Bridge,
  Liquid Staking, Liquid Restaking, Restaked BTC, wrapped, staked or exchange product —
  is out of the ranking entirely, named with its reason in the audit view. 98 are
  dropped this way. One discounted watchlist slug (a second pool that must stay ranked
  for the gate) pays ×0.5 on the launch value and ×0.5 on the odds — total ×0.25.
- **Expected value** is launch value × 2-year hazard odds. The board is sorted by it.
- **Farm verdicts.** For each row, the capital tier in $50–$10,000 that maximises the net
  — slice of the airdrop pool (10% of expected value) minus fees (5 transactions at the
  cheapest of the first three chains, plus a $2 claim and $5 bridge) minus the T-bill at
  4% a year over the hold — is the headline capital, with the smallest tier that nets
  positive shown as the minimum viable capital. The board's verdict is FARM 158, THIN 15,
  SKIP 18. Each row also shows the break-even airdrop share and the verdict at half, base
  and double share. The detail view shows the arithmetic and recomputes it live at any
  capital and airdrop share.
- **Validation.** Leave-one-out error ×4.82 geometric / ×3.85 median against a flat
  multiple's ×5.84 / ×4.74; forward (fit before 2024, test 2024+) ×4.81 / ×3.12 vs
  ×6.00 / ×4.61; backward ×4.40 / ×3.44 vs ×4.63 / ×4.49. A one-date sample cannot
  establish a genuine historical walk-forward test — the time splits are a proxy. Every
  rank is shown with a bootstrap p10–p90 range (40 refits) and a split-conformal 90%
  value band (×31.95, pooled — no category holds enough calibration comps for a stable
  own quantile).

## Coverage

191 rows ranked (all 40 watchlist protocols plus 151 below the $50M floor), 416 live-token
protocols set aside with their market caps, 98 derivative second pools named with reasons,
and 53 excluded products named — 758 accounted for, nothing silently dropped.

## Run it

```sh
node main.ts --input <path to snapshot.json>
```

The program reads the snapshot, fits the model, writes `board.json`, `data.js`, the
dashboard and three screenshots' source, and a dossier. Two runs write byte-identical
output. It needs Node 22+ and the standard library only; no network.

## Files

- `main.ts` — entrypoint: reads the snapshot, builds the radar, writes the output.
- `lib/model.ts` — the fit, the hazard odds, the farm economics, the board builder.
- `dashboard/` — the static dashboard: `index.html`, `app.css`, `app.js`.
- `screenshots/` — board, detail and filtered views at 1440×900.
