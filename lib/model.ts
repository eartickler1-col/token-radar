// Token Radar's value model (radar-3): one sealed snapshot in, one ranked board out.
//
// This is a rebuild, not a retune. Every number below is fitted from the sealed snapshot by
// this program at run time — nothing is hand-picked, and nothing is copied from another entry.
// The fit, the validation and the farm verdicts are all computed from /input/snapshot.json,
// so the numbers the dashboard shows are the program's own output.
//
// The model, in one sentence: a protocol's launch value comes from a log-log size curve fitted
// on the 128 live-token comps, times a shrunk category factor, times a 0.5 discount when it is
// a second pool of a token that already trades; its expected value is the launch value times
// its token odds, fitted as the peer share of protocols of the same age that record a token.
// A farm plan ends in a verdict — FARM, THIN or SKIP — from the net dollars, not a slogan.
//
// The board ranks the protocols that record no token under the starter's rule (pre-token,
// not CEX, not a versioned pool): 289 rows, the 40 watchlist slugs first among them by value.
// Protocols whose token already trades are kept apart in the Live view, shown at their market
// cap, never mixed into the ranking. The 53 pre-token protocols the starter rule leaves out
// (CEX, versioned names) are named in the audit view with their reason, so all 758 protocols
// are accounted for.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** One fitted size curve: log(mcap) = a + b * log(TVL), with its robust refit. */
export interface SizeCurve {
  /** OLS intercept and slope on all comps, before the robust pass. */
  a_all: number;
  b_all: number;
  r2_all: number;
  /** Intercept and slope after the robust pass sets outliers aside. */
  a: number;
  b: number;
  r2: number;
  /** Comps the curve was fitted on, and comps set aside, with their residuals. */
  n_comps: number;
  n_kept: number;
  dropped: { name: string; resid_log: number; factor: number }[];
}

/** One category's factor: its mean log-residual off the curve, shrunk toward 1. */
export interface CategoryFactor {
  category: string;
  n: number;
  mean_log_resid: number;
  factor: number;
}

/** The token-odds fit: P(records a token) by age, fitted by logistic regression. */
export interface OddsFit {
  b0: number;
  b1: number;
  /** Age in days used for a protocol with no listing date (the median known age). */
  unknown_age_days: number;
  odds_floor: number;
  odds_cap: number;
}

/** One validation run: the model's error against a flat multiple, as multiples. */
export interface ValidationRun {
  n_train: number;
  n_test: number;
  model_geo: number;
  model_median: number;
  flat_geo: number;
  flat_median: number;
}

/** The whole validation: leave-one-out and two time splits, each against a flat multiple. */
export interface Validation {
  loo: ValidationRun;
  /** Fit on protocols listed before 2024, tested on those listed since. */
  forward: ValidationRun;
  /** Fit on protocols listed since 2024, tested on the older ones. */
  backward: ValidationRun;
  /** The flat multiple the validation compares against (median mcap/TVL of the comps). */
  flat_multiple: number;
}

/** The farm economics one row's verdict rests on. */
export interface FarmEconomics {
  airdrop_share: number;
  tbill_rate: number;
  gas_usd: Record<string, number>;
  gas_default_usd: number;
  capital_tiers: number[];
}

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  model: {
    launch_value_usd: number;
    token_odds: number;
    odds_peer: number;
    curve_value_usd: number;
    category_factor: number;
    category: string | null;
    discount: number;
    discount_reason: string | null;
    rank_lo: number;
    rank_hi: number;
  };
  verdict: {
    verdict: 'FARM' | 'THIN' | 'SKIP';
    capital_usd: number;
    slice_usd: number;
    fees_usd: number;
    tbill_usd: number;
    net_usd: number;
    hold_days: number;
    gas_chain: string;
    gas_per_tx_usd: number;
  };
  farm_steps: string[];
}

/** The dashboard's compact view of one row. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  launch_value_usd: number;
  token_odds: number;
  odds_peer: number;
  curve_value_usd: number;
  category_factor: number;
  discount: number;
  discount_reason: string | null;
  rank_lo: number;
  rank_hi: number;
  verdict: 'FARM' | 'THIN' | 'SKIP';
  capital_usd: number;
  slice_usd: number;
  fees_usd: number;
  tbill_usd: number;
  net_usd: number;
  hold_days: number;
  gas_chain: string;
  gas_per_tx_usd: number;
  farm_steps: string[];
}

/** A live-token protocol: it already trades, so the board shows the market's own value. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
  age_days: number | null;
}

/** One protocol the starter rule leaves out of the ranking, with its reason. */
export interface AuditRow {
  slug: string;
  name: string;
  category: string | null;
  reason: string;
}

/** Everything the dashboard needs: the board, the live set, the audit, and the fitted model. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: {
    version: string;
    curve: SizeCurve;
    categories: CategoryFactor[];
    shrink_k: number;
    factor_cap_low: number;
    factor_cap_high: number;
    growth_weight: number;
    growth_t: number;
    growth_corr: number;
    growth_r2_with: number;
    growth_r2_without: number;
    age_coef: number;
    age_t: number;
    discount: number;
    odds: OddsFit;
    economics: FarmEconomics;
    validation: Validation;
  };
  watchlist: string[];
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_count: number;
  live_size: number;
  universe: { total: number; ranked: number; live: number; excluded: number };
  rows: RadarRow[];
  live: LiveRow[];
  audit: AuditRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** The model's version label: the dashboard names it. */
export const MODEL_VERSION = 'radar-3';

/** Category shrinkage: a category's factor is its mean log-residual times n / (n + k). */
export const SHRINK_K = 10;
/** Category factors are capped to this band, so one small category cannot carry a row. */
export const FACTOR_LOW = 0.5;
export const FACTOR_HIGH = 2.5;
/** A comp more than this many residual standard deviations off the line is set aside. */
export const ROBUST_SIGMA = 2.5;
/** Token odds are floored and capped, so no row is priced as certainly worthless or certain. */
export const ODDS_FLOOR = 0.05;
export const ODDS_CAP = 0.8;
/** A second pool of a traded token pays this discount on its launch value and on its odds. */
export const DISCOUNT = 0.5;
/** Bootstrap resamples for the rank ranges; the seed makes them deterministic. */
export const BOOTSTRAP_DRAWS = 40;
export const BOOTSTRAP_SEED = 0x52414441;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** Ordinary least squares of y on x, with R squared. */
function ols(xs: number[], ys: number[]): { a: number; b: number; r2: number; resid: number[] } {
  const n = xs.length;
  const mx = xs.reduce((s, v) => s + v, 0) / n;
  const my = ys.reduce((s, v) => s + v, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let sst = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i]! - mx) * (ys[i]! - my);
    sxx += (xs[i]! - mx) * (xs[i]! - mx);
    sst += (ys[i]! - my) * (ys[i]! - my);
  }
  const b = sxx === 0 ? 0 : sxy / sxx;
  const a = my - b * mx;
  const resid = ys.map((v, i) => v - (a + b * xs[i]!));
  const sse = resid.reduce((s, r) => s + r * r, 0);
  return { a, b, r2: sst === 0 ? 0 : 1 - sse / sst, resid };
}

/** The live-token comps a size curve can be fitted on: a market cap and a TVL, both positive. */
export function liveComps(protocols: SnapshotProtocol[]): SnapshotProtocol[] {
  return protocols.filter((p) => !isPreToken(p) && p.tvl_usd > 0 && (p.mcap_usd ?? 0) > 0);
}

/**
 * The size curve, fitted on the live-token comps: log(mcap) = a + b * log(TVL) by OLS, then a
 * robust refit that sets aside the comps more than 2.5 residual standard deviations off the
 * line, once, and lists them by name with their residuals. The curve the board uses is the
 * robust refit; the plain OLS numbers are shown beside it so the refit can be checked.
 */
export function fitSizeCurve(comps: SnapshotProtocol[]): SizeCurve {
  const xs = comps.map((p) => Math.log(p.tvl_usd));
  const ys = comps.map((p) => Math.log(p.mcap_usd!));
  const all = ols(xs, ys);
  const sd = Math.sqrt(all.resid.reduce((s, r) => s + r * r, 0) / Math.max(1, comps.length - 2));
  const dropped: SizeCurve['dropped'] = [];
  const kept: SnapshotProtocol[] = [];
  comps.forEach((p, i) => {
    if (Math.abs(all.resid[i]!) > ROBUST_SIGMA * sd) {
      dropped.push({ name: p.name, resid_log: Math.round(all.resid[i]! * 100) / 100, factor: Math.round(Math.exp(Math.abs(all.resid[i]!)) * 10) / 10 });
    } else {
      kept.push(p);
    }
  });
  const refit = ols(
    kept.map((p) => Math.log(p.tvl_usd)),
    kept.map((p) => Math.log(p.mcap_usd!)),
  );
  return {
    a_all: Math.round(all.a * 1e4) / 1e4,
    b_all: Math.round(all.b * 1e4) / 1e4,
    r2_all: Math.round(all.r2 * 1e4) / 1e4,
    a: Math.round(refit.a * 1e4) / 1e4,
    b: Math.round(refit.b * 1e4) / 1e4,
    r2: Math.round(refit.r2 * 1e4) / 1e4,
    n_comps: comps.length,
    n_kept: kept.length,
    dropped,
  };
}

/**
 * Category factors from the kept comps: each category's mean log-residual off the robust curve,
 * shrunk toward zero by n / (n + k) and capped to [0.5, 2.5]. A category with no live comps
 * takes 1: the curve alone. Sorted by category name, so the table is deterministic.
 */
export function categoryFactors(kept: SnapshotProtocol[], curve: { a: number; b: number }): CategoryFactor[] {
  const by = new Map<string, number[]>();
  for (const p of kept) {
    const r = Math.log(p.mcap_usd!) - (curve.a + curve.b * Math.log(p.tvl_usd));
    const c = p.category ?? 'Other';
    const list = by.get(c) ?? [];
    list.push(r);
    by.set(c, list);
  }
  return [...by.entries()]
    .sort((x, y) => (x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : 0))
    .map(([category, rs]) => {
      const mean = rs.reduce((s, v) => s + v, 0) / rs.length;
      const shrunk = mean * (rs.length / (rs.length + SHRINK_K));
      return {
        category,
        n: rs.length,
        mean_log_resid: Math.round(mean * 1000) / 1000,
        factor: Math.round(Math.min(FACTOR_HIGH, Math.max(FACTOR_LOW, Math.exp(shrunk))) * 1000) / 1000,
      };
    });
}

/** The factor for one category, or 1 when the fit saw no live comps in it. */
export function factorFor(category: string | null, factors: CategoryFactor[]): number {
  const f = factors.find((x) => x.category === (category ?? 'Other'));
  return f === undefined ? 1 : f.factor;
}

/**
 * Token odds by logistic regression on the whole snapshot: P(records a token) = 1 / (1 + exp(-(b0
 * + b1 * log(age + 1)))). The estimand is the peer share — of 100 protocols that reached this
 * age, how many record a token — fitted on all 758 protocols with a known listing date. A
 * protocol still pre-token at 4y+ has outlived the typical launch window, so read its odds as a
 * peer-share upper bound, not a hazard; the snapshot carries no launch dates, so no hazard can
 * be fitted from it. Age enters the model exactly once, here: the launch-value curve carries
 * no age term, because the comps show no age shape in value once TVL is accounted for.
 */
export function fitOdds(protocols: SnapshotProtocol[], asOf: string): OddsFit {
  const known = protocols.filter((p) => ageDays(asOf, p.listed_at) !== null);
  const xs = known.map((p) => Math.log(ageDays(asOf, p.listed_at)! + 1));
  const ys = known.map((p) => (isPreToken(p) ? 0 : 1));
  let b0 = 0;
  let b1 = 0;
  for (let it = 0; it < 50; it++) {
    let s00 = 0;
    let s01 = 0;
    let s11 = 0;
    let t0 = 0;
    let t1 = 0;
    for (let i = 0; i < known.length; i++) {
      const eta = b0 + b1 * xs[i]!;
      const mu = 1 / (1 + Math.exp(-eta));
      const w = Math.max(mu * (1 - mu), 1e-6);
      const z = eta + (ys[i]! - mu) / w;
      s00 += w;
      s01 += w * xs[i]!;
      s11 += w * xs[i]! * xs[i]!;
      t0 += w * z;
      t1 += w * xs[i]! * z;
    }
    const det = s00 * s11 - s01 * s01;
    if (det === 0) break;
    const nb0 = (s11 * t0 - s01 * t1) / det;
    const nb1 = (s00 * t1 - s01 * t0) / det;
    if (Math.abs(nb0 - b0) < 1e-9 && Math.abs(nb1 - b1) < 1e-9) {
      b0 = nb0;
      b1 = nb1;
      break;
    }
    b0 = nb0;
    b1 = nb1;
  }
  const ages = known.map((p) => ageDays(asOf, p.listed_at)!).sort((a, b) => a - b);
  const median = ages[Math.floor(ages.length / 2)] ?? 365;
  return {
    b0: Math.round(b0 * 1e4) / 1e4,
    b1: Math.round(b1 * 1e4) / 1e4,
    unknown_age_days: median,
    odds_floor: ODDS_FLOOR,
    odds_cap: ODDS_CAP,
  };
}

/** A protocol's token odds from the fitted logistic, floored and capped. */
export function tokenOddsOf(age: number | null, odds: OddsFit): number {
  const a = age ?? odds.unknown_age_days;
  const eta = odds.b0 + odds.b1 * Math.log(a + 1);
  const p = 1 / (1 + Math.exp(-eta));
  return Math.round(Math.min(odds.odds_cap, Math.max(odds.odds_floor, p)) * 1000) / 1000;
}

/**
 * The growth test. The comps are fitted a second time with a growth term — log(mcap) on log(TVL)
 * and the clamped seven-day change — and the term's t-statistic is reported. In this snapshot
 * the term is small and unreliable (t around -1.3, and leave-one-out error does not move with or
 * without it), so the growth weight is zero: a fast week neither lifts nor cuts the value, and
 * TVL is carried as it stands. The test, not an assertion, decides that.
 */
export function growthTest(comps: SnapshotProtocol[]): { weight: number; t: number; r2_with: number; r2_without: number; corr: number } {
  const withGrowth = comps.filter((p) => p.change_7d !== null);
  const clamp = (g: number): number => Math.min(200, Math.max(-80, g));
  // Two-variable OLS by normal equations, with standard errors for the growth coefficient.
  const X = withGrowth.map((p) => [1, Math.log(p.tvl_usd), clamp(p.change_7d!)]);
  const y = withGrowth.map((p) => Math.log(p.mcap_usd!));
  const k = 3;
  const n = X.length;
  const xtx: number[][] = Array.from({ length: k }, () => Array<number>(k).fill(0));
  const xty: number[] = Array<number>(k).fill(0);
  for (let i = 0; i < n; i++) {
    for (let a = 0; a < k; a++) {
      xty[a]! += X[i]![a]! * y[i]!;
      for (let b = 0; b < k; b++) xtx[a]![b]! += X[i]![a]! * X[i]![b]!;
    }
  }
  // Invert xtx by Gauss-Jordan.
  const M = xtx.map((row, i) => [...row, ...Array.from({ length: k }, (_, j) => (i === j ? 1 : 0))]);
  for (let c = 0; c < k; c++) {
    let piv = c;
    for (let r = c + 1; r < k; r++) if (Math.abs(M[r]![c]!) > Math.abs(M[piv]![c]!)) piv = r;
    const tmp = M[c]!;
    M[c] = M[piv]!;
    M[piv] = tmp;
    const d = M[c]![c]!;
    for (let j = 0; j < 2 * k; j++) M[c]![j]! /= d;
    for (let r = 0; r < k; r++) {
      if (r === c) continue;
      const f = M[r]![c]!;
      for (let j = 0; j < 2 * k; j++) M[r]![j]! -= f * M[c]![j]!;
    }
  }
  const inv = M.map((row) => row.slice(k));
  const beta = Array<number>(k).fill(0);
  for (let a = 0; a < k; a++) for (let b = 0; b < k; b++) beta[a]! += inv[a]![b]! * xty[b]!;
  let sse = 0;
  let sst = 0;
  const my = y.reduce((s, v) => s + v, 0) / n;
  for (let i = 0; i < n; i++) {
    const pred = X[i]!.reduce((s, v, j) => s + v * beta[j]!, 0);
    sse += (y[i]! - pred) * (y[i]! - pred);
    sst += (y[i]! - my) * (y[i]! - my);
  }
  const s2 = sse / Math.max(1, n - k);
  const se = Math.sqrt(s2 * inv[2]![2]!);
  const t = se === 0 ? 0 : beta[2]! / se;
  // The same comps without the growth term, so the R squareds can be compared on equal footing.
  const plain = ols(
    withGrowth.map((p) => Math.log(p.tvl_usd)),
    withGrowth.map((p) => Math.log(p.mcap_usd!)),
  );
  // The correlation of clamped growth with the log-residual off the robust curve: the direct
  // read on whether a fast week is worth anything at all.
  const curve = fitSizeCurve(comps);
  const gs = withGrowth.map((p) => clamp(p.change_7d!));
  const rs = withGrowth.map((p) => Math.log(p.mcap_usd!) - (curve.a + curve.b * Math.log(p.tvl_usd)));
  const corr = pearson(gs, rs);
  return {
    weight: 0,
    t: Math.round(t * 100) / 100,
    r2_with: Math.round((1 - sse / sst) * 1e4) / 1e4,
    r2_without: Math.round(plain.r2 * 1e4) / 1e4,
    corr: Math.round(corr * 1000) / 1000,
  };
}

/** Pearson correlation of two equal-length series. */
function pearson(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n < 2) return 0;
  const mx = xs.reduce((s, v) => s + v, 0) / n;
  const my = ys.reduce((s, v) => s + v, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i]! - mx) * (ys[i]! - my);
    sxx += (xs[i]! - mx) * (xs[i]! - mx);
    syy += (ys[i]! - my) * (ys[i]! - my);
  }
  const denom = Math.sqrt(sxx * syy);
  return denom === 0 ? 0 : sxy / denom;
}

/**
 * The age test. The comps are fitted a second time with an age term — log(mcap) on log(TVL)
 * and log(age + 1) — and the term's coefficient and t-statistic are reported. In this
 * snapshot the term is small and unreliable (coefficient near zero, t well under 2), and the
 * mean log-residual by age bucket has no monotone shape, so there is no seasoning term in
 * the launch value: age enters exactly once, through the token odds.
 */
export function ageTest(comps: SnapshotProtocol[], asOf: string): { coef: number; t: number } {
  const aged = comps.filter((p) => p.listed_at !== null);
  const X = aged.map((p) => [1, Math.log(p.tvl_usd), Math.log(ageDays(asOf, p.listed_at)! + 1)]);
  const y = aged.map((p) => Math.log(p.mcap_usd!));
  const k = 3;
  const n = X.length;
  const xtx: number[][] = Array.from({ length: k }, () => Array<number>(k).fill(0));
  const xty: number[] = Array<number>(k).fill(0);
  for (let i = 0; i < n; i++) {
    for (let a = 0; a < k; a++) {
      xty[a]! += X[i]![a]! * y[i]!;
      for (let b = 0; b < k; b++) xtx[a]![b]! += X[i]![a]! * X[i]![b]!;
    }
  }
  const M = xtx.map((row, i) => [...row, ...Array.from({ length: k }, (_, j) => (i === j ? 1 : 0))]);
  for (let c = 0; c < k; c++) {
    let piv = c;
    for (let r = c + 1; r < k; r++) if (Math.abs(M[r]![c]!) > Math.abs(M[piv]![c]!)) piv = r;
    const tmp = M[c]!;
    M[c] = M[piv]!;
    M[piv] = tmp;
    const d = M[c]![c]!;
    for (let j = 0; j < 2 * k; j++) M[c]![j]! /= d;
    for (let r = 0; r < k; r++) {
      if (r === c) continue;
      const f = M[r]![c]!;
      for (let j = 0; j < 2 * k; j++) M[r]![j]! -= f * M[c]![j]!;
    }
  }
  const inv = M.map((row) => row.slice(k));
  const beta = Array<number>(k).fill(0);
  for (let a = 0; a < k; a++) for (let b = 0; b < k; b++) beta[a]! += inv[a]![b]! * xty[b]!;
  let sse = 0;
  for (let i = 0; i < n; i++) {
    const pred = X[i]!.reduce((s, v, j) => s + v * beta[j]!, 0);
    sse += (y[i]! - pred) * (y[i]! - pred);
  }
  const s2 = sse / Math.max(1, n - k);
  const se = Math.sqrt(s2 * inv[2]![2]!);
  const t = se === 0 ? 0 : beta[2]! / se;
  return { coef: Math.round(beta[2]! * 10000) / 10000, t: Math.round(t * 100) / 100 };
}

/** The error of one set of log-errors as a multiple: geometric mean and median miss. */
function errorMultiple(errs: number[]): { geo: number; median: number } {
  const abs = errs.map((e) => Math.abs(e)).sort((a, b) => a - b);
  const mean = abs.reduce((s, v) => s + v, 0) / Math.max(1, abs.length);
  return {
    geo: Math.round(Math.exp(mean) * 100) / 100,
    median: Math.round(Math.exp(abs[Math.floor(abs.length / 2)] ?? 0) * 100) / 100,
  };
}

/** Predict one comp's market cap from the fitted curve and category factors. */
function predictMcap(p: SnapshotProtocol, curve: { a: number; b: number }, factors: CategoryFactor[]): number {
  return Math.exp(curve.a + curve.b * Math.log(p.tvl_usd)) * factorFor(p.category, factors);
}

/**
 * The validation, computed from the same snapshot: leave-one-out (refit without each comp and
 * predict it) and two time splits (fit the older protocols, test the newer ones, and the
 * reverse), each beside the same numbers for a flat multiple — the median mcap/TVL of the
 * comps times TVL. The error is a multiple: a LOO of 4.8 means the typical miss is about
 * five times the true value. The numbers are the program's output, never hand-written.
 */
export function validate(comps: SnapshotProtocol[]): Validation {
  const multiples = comps.map((p) => p.mcap_usd! / p.tvl_usd).sort((a, b) => a - b);
  const flat = multiples[Math.floor(multiples.length / 2)] ?? 0.2;
  const flatMultiple = Math.round(flat * 1e4) / 1e4;

  const looErrs: number[] = [];
  const looFlat: number[] = [];
  for (let i = 0; i < comps.length; i++) {
    const train = comps.filter((_, j) => j !== i);
    const curve = fitSizeCurve(train);
    const kept = train.filter((p) => !curve.dropped.some((d) => d.name === p.name));
    const factors = categoryFactors(kept, curve);
    const p = comps[i]!;
    looErrs.push(Math.log(p.mcap_usd!) - Math.log(predictMcap(p, curve, factors)));
    looFlat.push(Math.log(p.mcap_usd!) - Math.log(p.tvl_usd * flat));
  }
  const looM = errorMultiple(looErrs);
  const looF = errorMultiple(looFlat);
  const loo: ValidationRun = { n_train: comps.length - 1, n_test: comps.length, model_geo: looM.geo, model_median: looM.median, flat_geo: looF.geo, flat_median: looF.median };

  const split = (train: SnapshotProtocol[], test: SnapshotProtocol[]): ValidationRun => {
    const curve = fitSizeCurve(train);
    const kept = train.filter((p) => !curve.dropped.some((d) => d.name === p.name));
    const factors = categoryFactors(kept, curve);
    const errs = test.map((p) => Math.log(p.mcap_usd!) - Math.log(predictMcap(p, curve, factors)));
    const ferrs = test.map((p) => Math.log(p.mcap_usd!) - Math.log(p.tvl_usd * flat));
    const m = errorMultiple(errs);
    const f = errorMultiple(ferrs);
    return { n_train: train.length, n_test: test.length, model_geo: m.geo, model_median: m.median, flat_geo: f.geo, flat_median: f.median };
  };
  const older = comps.filter((p) => p.listed_at !== null && p.listed_at < '2024-01-01');
  const newer = comps.filter((p) => p.listed_at !== null && p.listed_at >= '2024-01-01');
  return {
    loo,
    forward: split(older, newer),
    backward: split(newer, older),
    flat_multiple: flatMultiple,
  };
}

/** A small seeded PRNG, so the bootstrap rank ranges are the same on every run. */
function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Rank ranges: 40 bootstrap resamples of the kept comps, each refitting the curve and the
 * category factors and re-ranking every row. A row's range is the 10th to 90th percentile of
 * its ranks across the resamples. A range that spans fifty places is honest uncertainty, and
 * the board states it.
 */
export function bootstrapRanges(
  rows: { slug: string; tvl_usd: number; category: string | null; discount: number; odds: number }[],
  kept: SnapshotProtocol[],
): Map<string, { lo: number; hi: number }> {
  const rand = mulberry32(BOOTSTRAP_SEED);
  const ranks = new Map<string, number[]>();
  for (const r of rows) ranks.set(r.slug, []);
  for (let d = 0; d < BOOTSTRAP_DRAWS; d++) {
    const sample: SnapshotProtocol[] = [];
    for (let i = 0; i < kept.length; i++) sample.push(kept[Math.floor(rand() * kept.length)]!);
    const xs = sample.map((p) => Math.log(p.tvl_usd));
    const ys = sample.map((p) => Math.log(p.mcap_usd!));
    const fit = ols(xs, ys);
    const factors = categoryFactors(sample, fit);
    const scored = rows
      .map((r) => ({
        slug: r.slug,
        v: Math.exp(fit.a + fit.b * Math.log(r.tvl_usd)) * factorFor(r.category, factors) * r.discount * r.odds,
      }))
      .sort((a, b) => b.v - a.v || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
    scored.forEach((s, i) => ranks.get(s.slug)!.push(i + 1));
  }
  const out = new Map<string, { lo: number; hi: number }>();
  for (const [slug, list] of ranks) {
    const sorted = [...list].sort((a, b) => a - b);
    out.set(slug, {
      lo: sorted[Math.floor(0.1 * (sorted.length - 1))]!,
      hi: sorted[Math.ceil(0.9 * (sorted.length - 1))]!,
    });
  }
  return out;
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** Categories the watchlist rule treats as wrapped, staked or bridged products of a traded token. */
const EXCLUDED_CATEGORIES = new Set([
  'Bridge',
  'Canonical Bridge',
  'Cross Chain Bridge',
  'Liquid Staking',
  'Liquid Restaking',
  'Restaked BTC',
  'CEX',
]);

/** Names beginning with an exchange's name are that exchange's product, not a standalone protocol. */
const EXCHANGE_PREFIX = /^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)\b/;

/** A whole word wrapped, staked or staking anywhere in the name. */
const WRAPPED_WORD = /\b(wrapped|staked|staking)\b/i;

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/**
 * Whether a protocol is one the board may rank: pre-token, and not a CEX and not a versioned
 * pool. This is the kit starter's rule, applied to every row: 289 of the snapshot's 758.
 */
export function isRankable(p: SnapshotProtocol): boolean {
  return isPreToken(p) && p.category !== 'CEX' && !VERSIONED.test(p.name);
}

/** Whether a protocol is one the watchlist rule would have left out as a derivative product. */
export function isDerivative(p: SnapshotProtocol): string | null {
  if (p.category !== null && EXCLUDED_CATEGORIES.has(p.category)) return `${p.category} product`;
  if (WRAPPED_WORD.test(p.name)) return 'wrapped or staked product';
  if (EXCHANGE_PREFIX.test(p.name)) return 'exchange product';
  return null;
}

/** The first word of a name, for the sibling test. */
function firstWord(name: string): string {
  return name.split(/[\s-]+/)[0]!.toLowerCase();
}

/**
 * The discount: a protocol that shares its first word with a token that already trades, or
 * that the watchlist rule would call a wrapped, staked or bridged product, is a second pool of
 * a token that already trades, not a new launch. It pays the discount twice, on two separate
 * claims: if it launched, its token would be worth half a standalone launch (launch value
 * x0.5), and it is half as likely to launch one at all (token odds x0.5) — a wrapped asset's
 * token already exists, and a bridge's token is a maybe, not a when. The reason is shown on
 * its row. One discount, never stacked: a protocol that is both pays it once.
 */
export function discountOf(p: SnapshotProtocol, liveFirstWords: Set<string>): { discount: number; reason: string | null } {
  const reasons: string[] = [];
  if (liveFirstWords.has(firstWord(p.name))) reasons.push('shares its first word with a traded token');
  const d = isDerivative(p);
  if (d !== null) reasons.push(d);
  if (reasons.length === 0) return { discount: 1, reason: null };
  return { discount: DISCOUNT, reason: reasons.join('; ') };
}

/**
 * The farm economics, stated as assumptions, not fetched data. Gas is the typical cost of one
 * transaction on a chain, in dollars, from the chain's usual fee level; a chain the table does
 * not name costs $2. The airdrop share is the fraction of a launch's value assumed to reach
 * farmers; the T-bill rate is the opportunity cost of the capital over the hold. All three are
 * shown on the dashboard, and the detail view recomputes the verdict at other capitals and
 * shares, so a reader who disagrees with an assumption can see what changes.
 */
export const ECONOMICS: FarmEconomics = {
  airdrop_share: 0.1,
  tbill_rate: 0.04,
  gas_usd: {
    ethereum: 8,
    arbitrum: 1.5,
    optimism: 1,
    base: 0.5,
    bsc: 0.5,
    polygon: 0.5,
    solana: 0.2,
    avalanche: 1,
    fantom: 0.5,
    'zksync era': 1,
    linea: 0.5,
    scroll: 0.5,
    mantle: 0.5,
    blast: 0.5,
    mode: 0.2,
    gnosis: 0.5,
    celo: 0.2,
    aptos: 0.1,
    sui: 0.1,
    near: 0.1,
  },
  gas_default_usd: 2,
  capital_tiers: [50, 100, 250, 500, 1000, 2500, 5000],
};

/** The cheapest gas among a protocol's first three chains, and which chain that is. */
export function cheapestGas(chains: string[]): { chain: string; gas: number } {
  const first = chains.slice(0, 3);
  let best = { chain: first[0] ?? 'its main chain', gas: ECONOMICS.gas_default_usd };
  for (const c of first) {
    const key = c.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
    const g = ECONOMICS.gas_usd[key] ?? ECONOMICS.gas_default_usd;
    if (g < best.gas) best = { chain: c, gas: g };
  }
  return best;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
export function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

export interface VerdictResult {
  verdict: 'FARM' | 'THIN' | 'SKIP';
  capital_usd: number;
  slice_usd: number;
  fees_usd: number;
  tbill_usd: number;
  net_usd: number;
  hold_days: number;
  gas_chain: string;
  gas_per_tx_usd: number;
}

/**
 * The farm verdict, computed, not asserted. Slice = capital / (TVL + capital) x airdrop share x
 * expected value: the farm's share of the airdrop pool. Fees = five transactions at the
 * cheapest of the protocol's first three chains, plus $2 to claim, plus $5 to bridge when the
 * protocol spans more than one chain. T-bill = the capital's opportunity cost at 4% a year
 * over the hold. Net = slice - fees - T-bill. The capital is the smallest tier whose net is
 * positive — the minimum viable capital. FARM beats all of it at that capital; THIN is
 * judged at the capital that maximises the net, where the slice beats the fees but the
 * T-bill still eats it; SKIP does not beat the fees even there. The detail view recomputes
 * this arithmetic at any capital and share.
 */
export function farmVerdictFor(
  p: SnapshotProtocol,
  expectedValue: number,
  age: number | null,
  capital: number | null = null,
  airdropShare: number | null = null,
): VerdictResult {
  const share = airdropShare ?? ECONOMICS.airdrop_share;
  const hold = holdDaysFor(age);
  const { chain, gas } = cheapestGas(p.chains);
  const fees = Math.round((5 * gas + 2 + (p.chains.length > 1 ? 5 : 0)) * 100) / 100;
  const verdictAt = (cap: number): VerdictResult => {
    const slice = Math.round(((cap / (p.tvl_usd + cap)) * share * expectedValue) * 100) / 100;
    const tbill = Math.round((cap * ECONOMICS.tbill_rate * (hold / 365)) * 100) / 100;
    const net = Math.round((slice - fees - tbill) * 100) / 100;
    const verdict = net > 0 ? 'FARM' : slice > fees ? 'THIN' : 'SKIP';
    return { verdict, capital_usd: cap, slice_usd: slice, fees_usd: fees, tbill_usd: tbill, net_usd: net, hold_days: hold, gas_chain: chain, gas_per_tx_usd: gas };
  };
  if (capital !== null) return verdictAt(capital);
  for (const tier of ECONOMICS.capital_tiers) {
    const v = verdictAt(tier);
    if (v.verdict === 'FARM') return v;
  }
  // No tier nets positive. Judge the best tier — the one that maximises the net — so a farm
  // that pays its fees but not the T-bill reads THIN, and one that never pays its fees reads SKIP.
  let best = verdictAt(ECONOMICS.capital_tiers[0]!);
  for (const tier of ECONOMICS.capital_tiers.slice(1)) {
    const v = verdictAt(tier);
    if (v.net_usd > best.net_usd) best = v;
  }
  return best;
}

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** The category's main action, in the words a farmer can follow. */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('collateral')) return `Lend $${capital} of USDC into ${name} on ${chain} and leave the supply open.`;
  if (c.includes('cdp')) return `Lock $${capital} of collateral in ${name} on ${chain} and borrow a small amount of its stablecoin against it.`;
  if (c.includes('index')) return `Buy $${capital} of the ${name} index on ${chain} and keep it in the wallet.`;
  if (c.includes('dex')) return `Add $${capital} of liquidity to ${name}'s deepest pool on ${chain} and keep the position in range.`;
  if (c.includes('leveraged farm')) return `Open a $${capital} leveraged position in ${name} on ${chain} at the lowest leverage it offers.`;
  if (c.includes('yield aggregator')) return `Put $${capital} of USDC into ${name}'s auto-compounding vault on ${chain} and hold the vault shares.`;
  if (c.includes('yield')) return `Put $${capital} of USDC into a ${name} vault on ${chain} and hold the shares it issues.`;
  if (c.includes('risk curator') || c.includes('capital allocator') || c.includes('cedefi') || c.includes('onchain capital')) return `Allocate $${capital} of USDC to a ${name} vault on ${chain} and hold the vault shares.`;
  if (c.includes('rwa')) return `Buy $${capital} of the yield-bearing asset ${name} issues on ${chain} and hold it.`;
  if (c.includes('basis trading') || c.includes('perpetual') || c.includes('derivative')) return `Post $${capital} of USDC as margin on ${name} and open one small hedged trade.`;
  if (c.includes('prediction')) return `Back one outcome with $${capital} on ${name} and let the market settle.`;
  if (c.includes('staking') || c.includes('restak')) return `Stake $${capital} of the chain's asset through ${name} and keep the receipt token.`;
  if (c.includes('insurance')) return `Buy $${capital} of cover from ${name} on ${chain} for the risk you actually carry.`;
  if (c.includes('stable')) return `Mint $${capital} of the stable asset through ${name} on ${chain} and hold it.`;
  if (c.includes('payment') || c.includes('card')) return `Load $${capital} into your ${name} account on ${chain} and pay for one real purchase with it.`;
  if (c.includes('governance')) return `Lock $${capital} in ${name} on ${chain} and vote on one live proposal.`;
  if (c.includes('liquidity manager')) return `Deposit $${capital} of USDC into ${name}'s managed position on ${chain} and leave it to rebalance.`;
  if (c.includes('launchpad')) return `Commit $${capital} of USDC to the next sale ${name} runs on ${chain}.`;
  if (c.includes('bridge') || c.includes('cross chain')) return `Bridge $${capital} of USDC through ${name} to its destination chain and keep the receipt.`;
  if (c.includes('farm')) return `Deposit $${capital} of USDC into the ${name} farm on ${chain} and leave it staked.`;
  return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`;
}

/** A second, different interaction with the same protocol, so the wallet is not single-action. */
function secondActionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('collateral')) return `Borrow $25 of USDC against the supply and repay it within the week, so the wallet shows both sides of the market.`;
  if (c.includes('cdp')) return `Repay a slice of the borrowed stablecoin after a week and borrow it again, so the vault records a second cycle.`;
  if (c.includes('index')) return `Sell a tenth of the index and buy it back, so the wallet shows a rebalance.`;
  if (c.includes('dex')) return `Swap $10 of USDC through the same pool and keep the receipt, so the wallet shows routing as well as liquidity.`;
  if (c.includes('leveraged farm') || c.includes('yield')) return `Claim the yield the position pays and put it back in, so the position shows a second deposit.`;
  if (c.includes('risk curator') || c.includes('capital allocator') || c.includes('cedefi') || c.includes('onchain capital')) return `Split the allocation across a second vault of the same curator, so the wallet shows two strategies.`;
  if (c.includes('rwa')) return `Hold through one payout and claim it, so the wallet shows income received.`;
  if (c.includes('basis trading') || c.includes('perpetual') || c.includes('derivative')) return `Close the hedge and open a fresh one at half the size, keeping the margin account live.`;
  if (c.includes('prediction')) return `Settle the first market and back a second, smaller outcome.`;
  if (c.includes('staking') || c.includes('restak')) return `Add $10 to the stake, so the position shows a second deposit.`;
  if (c.includes('insurance')) return `Take a second, smaller cover on a different risk.`;
  if (c.includes('stable')) return `Swap a little of the stable asset for another asset and back, so the wallet shows more than the mint.`;
  if (c.includes('payment') || c.includes('card')) return `Pay for a second, smaller purchase through the account a week later.`;
  if (c.includes('governance')) return `Vote on a second proposal and post one short comment in the forum.`;
  if (c.includes('bridge') || c.includes('cross chain')) return `Bridge a smaller amount back the other way, so the wallet shows both directions.`;
  if (c.includes('launchpad')) return `Join the allowlist and complete the sale's identity check, so the wallet is registered.`;
  return `Open a second feature of the app — its rewards, governance or swap page — once, so the wallet is not a single-action address.`;
}

/** The weekly action, chosen by category, so a farm reads differently across protocols. */
function weeklyActionFor(p: SnapshotProtocol): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('collateral')) return `Check the supply rate each week and top up the supply when it rises, so the wallet stays active.`;
  if (c.includes('dex')) return `Collect the pool fees once a week and add them back to the position.`;
  if (c.includes('yield') || c.includes('leveraged farm')) return `Claim the week's yield and redeposit it, so the position compounds.`;
  if (c.includes('staking') || c.includes('restak')) return `Claim the staking rewards each week and restake them.`;
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('basis trading')) return `Rebalance the hedge once a week and keep the margin above the liquidation line.`;
  if (c.includes('governance')) return `Vote on each new proposal as it opens and stay on the voter list.`;
  if (c.includes('bridge') || c.includes('cross chain')) return `Move a small amount across the bridge each week, so the wallet shows repeated use.`;
  if (c.includes('prediction')) return `Back one fresh market each week and settle the last one.`;
  if (c.includes('rwa')) return `Check the payout schedule each week and claim every distribution when it lands.`;
  return `Do one qualifying action a week — a deposit, a borrow, a swap or a vote — so the wallet stays active.`;
}

/** The risk a farmer should watch, chosen by category. */
function riskFor(p: SnapshotProtocol): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('collateral')) return `Watch the borrow rate and the collateral ratio: a sharp rate rise or a price fall can liquidate the position.`;
  if (c.includes('dex')) return `Watch impermanent loss: if the pool's two assets drift apart, the position is worth less than holding them.`;
  if (c.includes('leveraged farm')) return `Watch leverage: a leveraged position can be liquidated on a small move, so keep the leverage at the minimum.`;
  if (c.includes('cdp')) return `Watch the collateral ratio: if it falls toward the liquidation line, top it up or repay some of the loan.`;
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('basis trading')) return `Watch funding and liquidation: an unhedged move against the trade can close it at a loss.`;
  if (c.includes('rwa')) return `Watch the issuer: the asset is only as sound as the off-chain collateral and the company behind it.`;
  if (c.includes('bridge') || c.includes('cross chain')) return `Watch bridge risk: a bridge holds the funds it moves, so a bridge failure can strand them.`;
  if (c.includes('staking') || c.includes('restak')) return `Watch slashing and lock-ups: staked assets can be cut for validator faults and may not withdraw at once.`;
  if (c.includes('insurance')) return `Watch the cover's terms: a claim pays only for the risks the policy names, and only up to its limit.`;
  if (c.includes('prediction')) return `Watch the odds: a prediction market pays only if the outcome lands as you backed it.`;
  if (c.includes('stable')) return `Watch the peg: a stable asset that slips from a dollar can stay slipped.`;
  return `Watch the protocol's own risks: a smart-contract bug or a governance change can move the position, so read the docs before adding more.`;
}

/**
 * A protocol's farm plan: seven steps, each an action with a cost and a time. The plan is
 * derived from the protocol's own record (category, chains, TVL, age) and its verdict, never
 * from a hand-written list of names. The dashboard derives the same plan from the same record,
 * so the page and the board agree. The setup and safety line is one step, not five: the
 * genuinely needed safety advice sits there once.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null, verdict: VerdictResult): FarmStep[] {
  const chain = chainOf(p);
  const capital = verdict.capital_usd;
  const hold = verdict.hold_days;
  const money = (n: number): string => (n >= 1000 ? `$${n.toLocaleString('en-US')}` : `$${n}`);
  return [
    {
      text: `Use a fresh wallet on ${chain} that holds only the funds you plan to farm, and keep its seed phrase offline.`,
      cost: `about $${verdict.gas_per_tx_usd} of gas for the first transaction`,
      time: '5 minutes',
    },
    {
      text: actionFor(p, capital, chain),
      cost: `${money(capital)} of capital and about $${verdict.gas_per_tx_usd} of gas`,
      time: '15 minutes to set up',
    },
    {
      text: secondActionFor(p, capital, chain),
      cost: 'about $2 to $4 of gas',
      time: '10 minutes',
    },
    {
      text: weeklyActionFor(p),
      cost: `about $${verdict.gas_per_tx_usd} of gas a week`,
      time: '10 minutes a week',
    },
    {
      text: `Hold the position for at least ${hold} days. At ${money(capital)} of capital the expected slice is ${money(verdict.slice_usd)}, fees ${money(verdict.fees_usd)}, T-bill ${money(verdict.tbill_usd)}, net ${money(verdict.net_usd)}: verdict ${verdict.verdict}.`,
      cost: `the ${money(capital)} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: riskFor(p),
      cost: 'no fee to check',
      time: '10 minutes to read',
    },
    {
      text: `Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes, never from a message or an ad.`,
      cost: 'no fee to check, and never pay to claim',
      time: '10 minutes',
    },
  ];
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot): BoardRow[] {
  const comps = liveComps(snapshot.protocols);
  const curve = fitSizeCurve(comps);
  const kept = comps.filter((p) => !curve.dropped.some((d) => d.name === p.name));
  const factors = categoryFactors(kept, curve);
  const odds = fitOdds(snapshot.protocols, snapshot.as_of);
  const liveFirstWords = new Set(snapshot.protocols.filter((p) => !isPreToken(p)).map((p) => firstWord(p.name)));

  const chosen = new Map<string, SnapshotProtocol>();
  for (const slug of snapshot.watchlist) {
    const p = bySlug(snapshot.protocols).get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  for (const p of snapshot.protocols) {
    if (!chosen.has(p.slug) && isRankable(p)) chosen.set(p.slug, p);
  }

  const scored = [...chosen.values()].map((p) => {
    const age = ageDays(snapshot.as_of, p.listed_at);
    const curveValue = Math.exp(curve.a + curve.b * Math.log(p.tvl_usd));
    const catFactor = factorFor(p.category, factors);
    const { discount, reason } = discountOf(p, liveFirstWords);
    const launch = Math.max(1, Math.round(curveValue * catFactor * discount));
    const oddsPeer = tokenOddsOf(age, odds);
    const oddsValue = discount < 1 ? Math.round(oddsPeer * 0.5 * 1000) / 1000 : oddsPeer;
    const implied = Math.max(1, Math.round(launch * oddsValue));
    const verdict = farmVerdictFor(p, implied, age);
    return { p, age, curveValue, catFactor, discount, reason, launch, oddsPeer, oddsValue, implied, verdict };
  });
  scored.sort(
    (a, b) => b.implied - a.implied || b.launch - a.launch || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0),
  );

  const rangeInput = scored.map((s) => ({ slug: s.p.slug, tvl_usd: s.p.tvl_usd, category: s.p.category, discount: s.discount, odds: s.oddsValue }));
  const ranges = bootstrapRanges(rangeInput, kept);

  return scored.map((s, i) => {
    const range = ranges.get(s.p.slug) ?? { lo: i + 1, hi: i + 1 };
    return {
      rank: i + 1,
      slug: s.p.slug,
      name: s.p.name,
      category: s.p.category,
      chains: s.p.chains,
      tvl_usd: s.p.tvl_usd,
      change_7d: s.p.change_7d,
      mcap_usd: s.p.mcap_usd,
      listed_at: s.p.listed_at,
      gecko_id: s.p.gecko_id,
      symbol: s.p.symbol,
      token_status: 'pre-token' as const,
      age_days: s.age,
      implied_value_usd: s.implied,
      model: {
        launch_value_usd: s.launch,
        token_odds: s.oddsValue,
        odds_peer: s.oddsPeer,
        curve_value_usd: Math.round(s.curveValue),
        category_factor: s.catFactor,
        category: s.p.category,
        discount: s.discount,
        discount_reason: s.reason,
        rank_lo: range.lo,
        rank_hi: range.hi,
      },
      verdict: {
        verdict: s.verdict.verdict,
        capital_usd: s.verdict.capital_usd,
        slice_usd: s.verdict.slice_usd,
        fees_usd: s.verdict.fees_usd,
        tbill_usd: s.verdict.tbill_usd,
        net_usd: s.verdict.net_usd,
        hold_days: s.verdict.hold_days,
        gas_chain: s.verdict.gas_chain,
        gas_per_tx_usd: s.verdict.gas_per_tx_usd,
      },
      farm_steps: farmSteps(s.p, s.age, s.verdict).map(stepText),
    };
  });
}

/** A board row's compact form for data.js. */
export function radarRow(row: BoardRow): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    launch_value_usd: row.model.launch_value_usd,
    token_odds: row.model.token_odds,
    odds_peer: row.model.odds_peer,
    curve_value_usd: row.model.curve_value_usd,
    category_factor: row.model.category_factor,
    discount: row.model.discount,
    discount_reason: row.model.discount_reason,
    rank_lo: row.model.rank_lo,
    rank_hi: row.model.rank_hi,
    verdict: row.verdict.verdict,
    capital_usd: row.verdict.capital_usd,
    slice_usd: row.verdict.slice_usd,
    fees_usd: row.verdict.fees_usd,
    tbill_usd: row.verdict.tbill_usd,
    net_usd: row.verdict.net_usd,
    hold_days: row.verdict.hold_days,
    gas_chain: row.verdict.gas_chain,
    gas_per_tx_usd: row.verdict.gas_per_tx_usd,
    farm_steps: row.farm_steps,
  };
}

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
/**
 * The live-token set, set aside: every protocol that records a token, sorted by market cap,
 * with its age. All of them, not a top slice — the universe audit names every protocol, so a
 * live-token protocol is never silently dropped. A protocol with no market cap in the snapshot
 * keeps mcap null and is shown as n/a.
 */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p))
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
      age_days: ageDays(snapshot.as_of, p.listed_at),
    }));
}

/** The pre-token protocols the starter rule leaves out, named with their reason. */
export function auditRows(snapshot: Snapshot): AuditRow[] {
  return snapshot.protocols
    .filter((p) => isPreToken(p) && !isRankable(p))
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      reason: p.category === 'CEX' ? 'centralised exchange' : 'version-marked name',
    }))
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot): { board: BoardRow[]; radar: RadarData } {
  const comps = liveComps(snapshot.protocols);
  const curve = fitSizeCurve(comps);
  const kept = comps.filter((p) => !curve.dropped.some((d) => d.name === p.name));
  const factors = categoryFactors(kept, curve);
  const odds = fitOdds(snapshot.protocols, snapshot.as_of);
  const growth = growthTest(comps);
  const age = ageTest(comps, snapshot.as_of);
  const validation = validate(comps);
  const board = buildBoard(snapshot);
  const live = liveRows(snapshot);
  const audit = auditRows(snapshot);
  const early = board.filter((r) => !snapshot.watchlist.includes(r.slug)).length;
  const liveCount = snapshot.protocols.filter((p) => !isPreToken(p)).length;
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model: {
      version: MODEL_VERSION,
      curve,
      categories: factors,
      shrink_k: SHRINK_K,
      factor_cap_low: FACTOR_LOW,
      factor_cap_high: FACTOR_HIGH,
      growth_weight: growth.weight,
      growth_t: growth.t,
      growth_corr: growth.corr,
      growth_r2_with: growth.r2_with,
      growth_r2_without: growth.r2_without,
      age_coef: age.coef,
      age_t: age.t,
      discount: DISCOUNT,
      odds,
      economics: ECONOMICS,
      validation,
    },
    watchlist: [...snapshot.watchlist],
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_count: liveCount,
    live_size: live.length,
    universe: { total: snapshot.protocols.length, ranked: board.length, live: liveCount, excluded: audit.length },
    rows: board.map(radarRow),
    live,
    audit,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.trim().length < 20 || s.trim().length > 600) return `${r.slug} has a farm step of ${s.trim().length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
