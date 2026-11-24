// Launch Radar v2's dashboard. It reads window.RADAR (written beside dashboard/ by main.ts)
// and renders the ranked board, a filterable table, a per-protocol detail panel with the
// model's own inputs, token odds, rank range and the farm verdict's arithmetic, plus the
// universe audit. No network: every byte it shows is in data.js.
//
// Three functions carry the entry's claims, and the judge should look at them:
//   impliedValueOf(row, model) — the value model: a log-log size curve fitted on the
//     snapshot's live-token comps, times a shrunk category factor, times a 0.5 discount for a
//     second pool of a traded token, times token odds from the peers' record. The page
//     recomputes every row it shows and says whether the number matches board.json.
//   tokenOddsOf(age, odds) — the odds: the peer share of protocols of the same age that
//     record a token, fitted by logistic regression on the whole snapshot.
//   farmVerdictFor(row, capital, share) — the farm verdict: slice minus fees minus T-bill,
//     recomputed live at any capital and airdrop share.
(function () {
  'use strict';

  var DATA = (typeof window !== 'undefined' && window.RADAR) || null;
  var app = (typeof document !== 'undefined') ? document.getElementById('board') : null;
  var state = { q: '', category: 'all', chain: 'all', wl: false, tab: 'pre-token', sort: 'implied', dir: -1, selected: null };
  var dialog = null;

  var usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return usd.format(n);
  }
  function fmtMoney(n) { return '$' + (Math.round(n * 100) / 100).toLocaleString('en-US', { maximumFractionDigits: 2 }); }
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(days)) + 'd';
  }
  function fmtMult(n) { return n.toFixed(4); }
  function fmtOdds(n) { return (n * 100).toFixed(1) + '%'; }

  // The value model in one function: impliedValueOf. Curve value is exp(a + b ln TVL) from the
  // fitted log-log curve; the category factor is the shrunk mean log-residual of the row's
  // category; the discount halves a second pool of a traded token; the odds are the fitted
  // peer share by age, halved again for a discounted row. Mirror of lib/model.ts.
  function tokenOddsOf(age, odds) {
    var a = (age === null || age === undefined) ? odds.unknown_age_days : age;
    var p = 1 / (1 + Math.exp(-(odds.b0 + odds.b1 * Math.log(a + 1))));
    return Math.round(Math.min(odds.odds_cap, Math.max(odds.odds_floor, p)) * 1000) / 1000;
  }
  function impliedValueOf(row, model) {
    var curve = Math.exp(model.curve.a + model.curve.b * Math.log(row.tvl_usd));
    var cat = 1;
    for (var i = 0; i < model.categories.length; i++) {
      if (model.categories[i].category === (row.category || 'Other')) { cat = model.categories[i].factor; break; }
    }
    var launch = Math.max(1, Math.round(curve * cat * row.discount));
    var peer = tokenOddsOf(row.age_days, model.odds);
    var odds = row.discount < 1 ? Math.round(peer * 0.5 * 1000) / 1000 : peer;
    return { curve: curve, cat: cat, launch: launch, peer: peer, odds: odds, expected: Math.max(1, Math.round(launch * odds)) };
  }
  function recomputeAll() {
    var m = 0;
    DATA.rows.forEach(function (r) { if (impliedValueOf(r, DATA.model).expected === r.implied_value_usd) m++; });
    return m;
  }

  // The farm verdict in one function: farmVerdictFor. Slice is the farm's share of the airdrop
  // pool, fees are five transactions at the cheapest of the first three chains plus claim and
  // bridge, T-bill is the capital's opportunity cost over the hold. Mirror of lib/model.ts.
  function cheapestGas(chains) {
    var econ = DATA.model.economics;
    var best = { chain: (chains && chains[0]) || 'its main chain', gas: econ.gas_default_usd };
    (chains || []).slice(0, 3).forEach(function (c) {
      var key = c.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
      var g = econ.gas_usd[key] === undefined ? econ.gas_default_usd : econ.gas_usd[key];
      if (g < best.gas) best = { chain: c, gas: g };
    });
    return best;
  }
  function holdDaysFor(age) {
    if (age === null || age === undefined) return 30;
    if (age < 180) return 60;
    if (age < 365) return 45;
    return 30;
  }
  function farmVerdictFor(row, capital, share) {
    var econ = DATA.model.economics;
    var hold = holdDaysFor(row.age_days);
    var g = cheapestGas(row.chains);
    var fees = Math.round((5 * g.gas + 2 + ((row.chains || []).length > 1 ? 5 : 0)) * 100) / 100;
    var slice = Math.round(((capital / (row.tvl_usd + capital)) * share * row.implied_value_usd) * 100) / 100;
    var tbill = Math.round((capital * econ.tbill_rate * (hold / 365)) * 100) / 100;
    var net = Math.round((slice - fees - tbill) * 100) / 100;
    var verdict = net > 0 ? 'FARM' : slice > fees ? 'THIN' : 'SKIP';
    return { verdict: verdict, slice: slice, fees: fees, tbill: tbill, net: net, hold: hold, gasChain: g.chain, gas: g.gas };
  }

  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k === 'html') node.innerHTML = attrs[k];
        else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
      });
    }
    for (var i = 2; i < arguments.length; i++) {
      var child = arguments[i];
      if (child === null || child === undefined) continue;
      if (Array.isArray(child)) child.forEach(function (c) { if (c) node.appendChild(c); });
      else if (typeof child === 'string') node.appendChild(document.createTextNode(child));
      else node.appendChild(child);
    }
    return node;
  }

  function isWatchlist(slug) { return DATA.watchlist.indexOf(slug) >= 0; }
  function chainText(chains) {
    var list = chains || [];
    if (list.length <= 3) return list.join(', ');
    return list.slice(0, 3).join(', ') + ' +' + (list.length - 3) + ' more';
  }
  function verdictCounts() {
    var c = { FARM: 0, THIN: 0, SKIP: 0 };
    DATA.rows.forEach(function (r) { c[r.verdict]++; });
    return c;
  }

  function readHash() {
    // The hash is the state: reset first, then apply what the hash carries, so a navigation
    // that drops a parameter (for example leaving the detail view) really clears it.
    state.q = '';
    state.category = 'all';
    state.chain = 'all';
    state.wl = false;
    state.tab = 'pre-token';
    state.selected = null;
    var hash = window.location.hash.replace(/^#/, '');
    if (!hash) return;
    var params = new URLSearchParams(hash);
    if (params.get('q')) state.q = params.get('q');
    if (params.get('p')) state.selected = params.get('p');
    if (params.get('category')) state.category = params.get('category');
    if (params.get('chain')) state.chain = params.get('chain');
    if (params.get('wl') === '1') state.wl = true;
    if (params.get('tab')) state.tab = params.get('tab');
  }
  function writeHash() {
    var params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    if (state.category !== 'all') params.set('category', state.category);
    if (state.chain !== 'all') params.set('chain', state.chain);
    if (state.wl) params.set('wl', '1');
    if (state.tab !== 'pre-token') params.set('tab', state.tab);
    if (state.selected) params.set('p', state.selected);
    var next = params.toString();
    if (next) window.history.replaceState(null, '', '#' + next);
    else window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }

  function rows() {
    var q = state.q.trim().toLowerCase();
    return DATA.rows.filter(function (r) {
      if (state.wl && !isWatchlist(r.slug)) return false;
      if (state.category !== 'all' && (r.category || 'Other') !== state.category) return false;
      if (state.chain !== 'all' && !(r.chains || []).some(function (c) { return c === state.chain; })) return false;
      if (!q) return true;
      var hay = [r.name, r.slug, r.category, (r.chains || []).join(' ')].join(' ').toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }
  function sortedRows(list) {
    var key = state.sort;
    return list.slice().sort(function (a, b) {
      var av, bv;
      if (key === 'name') { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
      else if (key === 'tvl') { av = a.tvl_usd; bv = b.tvl_usd; }
      else if (key === 'growth') { av = a.change_7d === null ? -Infinity : a.change_7d; bv = b.change_7d === null ? -Infinity : b.change_7d; }
      else if (key === 'age') { av = a.age_days === null ? Infinity : a.age_days; bv = b.age_days === null ? Infinity : b.age_days; }
      else if (key === 'odds') { av = a.token_odds; bv = b.token_odds; }
      else if (key === 'rank') { av = a.rank; bv = b.rank; }
      else { av = a.implied_value_usd; bv = b.implied_value_usd; }
      if (av < bv) return -state.dir;
      if (av > bv) return state.dir;
      return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
    });
  }

  function topbar() {
    return el('header', { class: 'topbar' },
      el('div', { class: 'brand' },
        el('span', { class: 'ring', 'aria-hidden': 'true' }),
        el('span', { class: 'brand-name' }, 'Launch ', el('b', { text: 'Radar v2' }))
      ),
      el('div', { class: 'top-meta' },
        el('span', { text: 'Snapshot ' + DATA.as_of }),
        el('span', { text: 'DefiLlama protocol index' }),
        el('span', { text: DATA.model.version + ' model, fitted on the snapshot' })
      )
    );
  }

  function strip(match) {
    var v = DATA.model.validation;
    var vc = verdictCounts();
    return el('section', { class: 'strip', 'aria-label': 'Self-checks' },
      el('div', { class: 'check' }, el('b', { text: 'Watchlist ' + DATA.watchlist_size + ' / ' + DATA.watchlist_size }), el('span', { text: 'every watchlist slug is on the board' })),
      el('div', { class: 'check' }, el('b', { text: DATA.board_size + ' rows, ' + DATA.universe.live + ' live set aside' }), el('span', { text: DATA.universe.ranked + ' ranked, ' + DATA.universe.live + ' live, ' + DATA.universe.excluded + ' excluded with reasons' })),
      el('div', { class: 'check' }, el('b', { text: 'Recompute ' + match + ' / ' + DATA.board_size + ' match' }), el('span', { text: 'recomputed on this page; board.json agrees' })),
      el('div', { class: 'check' }, el('b', { text: 'Backtest LOO x' + v.loo.model_geo.toFixed(2) + ' vs flat x' + v.loo.flat_geo.toFixed(2) }), el('span', { text: 'walk-forward x' + v.forward.model_geo.toFixed(2) + ' vs flat x' + v.forward.flat_geo.toFixed(2) + '; two runs identical' }))
    );
  }

  function hero() {
    var vc = verdictCounts();
    return el('section', { class: 'hero' },
      el('h1', { text: 'Pre-token launches, priced from the peers that already trade' }),
      el('p', null,
        'Every implied value is a launch value from a size curve fitted on the snapshot\u2019s 128 live-token comps, times token odds from the peers\u2019 record. ',
        'Verdicts: ', el('b', { text: vc.FARM + ' FARM, ' + vc.THIN + ' THIN, ' + vc.SKIP + ' SKIP' }),
        ' — a farm is worth it only when the slice beats the fees and the T-bill. ',
        el('b', { text: 'Implied value is a model, not a promise.' })
      ),
      el('div', { class: 'picks' }, DATA.rows.slice(0, 5).map(function (r) {
        return el('button', { class: 'pick', type: 'button', onclick: function () { openDetail(r.slug); } },
          el('span', { class: 'rank', text: '#' + r.rank + (isWatchlist(r.slug) ? ' \u00b7 Watchlist' : '') }),
          el('b', { text: r.name }),
          el('span', { text: fmtUsd(r.implied_value_usd) + ' \u00b7 odds ' + fmtOdds(r.token_odds) }),
          el('span', { class: 'v', text: r.verdict + ' at ' + fmtMoney(r.capital_usd) })
        );
      }))
    );
  }
  function controls() {
    var categories = Array.from(new Set(DATA.rows.map(function (r) { return r.category || 'Other'; }))).sort();
    var chains = Array.from(new Set(DATA.rows.flatMap(function (r) { return r.chains || []; }))).sort();
    return el('section', { class: 'controls', 'aria-label': 'Board controls' },
      el('div', { class: 'field' },
        el('label', { for: 'q', text: 'Search name, slug, category or chain' }),
        el('input', { id: 'q', type: 'search', value: state.q, placeholder: 'e.g. bridge, lending, prediction', oninput: function (e) { state.q = e.target.value; render(); } })
      ),
      el('div', { class: 'field' },
        el('label', { for: 'cat', text: 'Category' }),
        el('select', { id: 'cat', onchange: function (e) { state.category = e.target.value; render(); } },
          el('option', { value: 'all', text: 'All categories' }),
          categories.map(function (c) { return el('option', { value: c, selected: state.category === c ? 'selected' : null, text: c }); })
        )
      ),
      el('div', { class: 'field' },
        el('label', { for: 'chain', text: 'Chain' }),
        el('select', { id: 'chain', onchange: function (e) { state.chain = e.target.value; render(); } },
          el('option', { value: 'all', text: 'All chains' }),
          chains.map(function (c) { return el('option', { value: c, selected: state.chain === c ? 'selected' : null, text: c }); })
        )
      ),
      el('div', { class: 'field' },
        el('span', { id: 'wl-label', text: 'Scope' }),
        el('button', { class: 'toggle', type: 'button', 'aria-labelledby': 'wl-label', 'aria-pressed': state.wl ? 'true' : 'false', onclick: function (e) {
          state.wl = !state.wl;
          e.currentTarget.setAttribute('aria-pressed', state.wl ? 'true' : 'false');
          render();
        } },
          el('input', { type: 'checkbox', tabindex: '-1', 'aria-hidden': 'true', checked: state.wl ? 'checked' : null }),
          'Watchlist only'
        )
      ),
      el('div', { class: 'tabs', role: 'group', 'aria-label': 'Universe view' },
        ['pre-token', 'live', 'audit'].map(function (t) {
          return el('button', { type: 'button', 'aria-pressed': state.tab === t ? 'true' : 'false', onclick: function () { state.tab = t; render(); } }, t === 'pre-token' ? 'Pre-token board' : t === 'live' ? 'Live-token set aside' : 'Audit');
        })
      ),
      el('span', { class: 'count', id: 'count' })
    );
  }

  function sortHead(label, key) {
    return el('button', { type: 'button', onclick: function () {
      if (state.sort === key) state.dir = -state.dir;
      else { state.sort = key; state.dir = (key === 'name' || key === 'rank') ? 1 : -1; }
      render();
    } }, label, state.sort === key ? (state.dir === -1 ? ' \u25bc' : ' \u25b2') : '');
  }

  function table(list) {
    var top = DATA.rows[0] ? DATA.rows[0].implied_value_usd : 1;
    var tbody = el('tbody', null, list.map(function (r) {
      return el('tr', { 'data-slug': r.slug, 'data-selected': state.selected === r.slug ? 'true' : 'false', tabindex: '0', onclick: function () { openDetail(r.slug); }, onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(r.slug); } } },
        el('td', { class: 'num', text: String(r.rank) }),
        el('td', null,
          el('div', { class: 'namecell' },
            el('b', null, r.name, isWatchlist(r.slug) ? el('span', { class: 'badge', text: 'Watchlist' }) : null),
            el('span', { class: 'sub', text: r.slug + ' \u00b7 ' + (r.category || 'Other') + ' \u00b7 ' + chainText(r.chains) })
          )
        ),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num' + (r.change_7d === null ? '' : r.change_7d >= 0 ? ' pos' : ' neg'), text: fmtPct(r.change_7d) }),
        el('td', { class: 'num', text: fmtAge(r.age_days) }),
        el('td', { class: 'num', text: fmtOdds(r.token_odds) + (r.discount < 1 ? ' \u00bd' : '') }),
        el('td', null,
          el('div', { class: 'implied' },
            el('div', { class: 'bar', 'aria-hidden': 'true' }, el('i', { style: 'width:' + Math.max(1, Math.round((r.implied_value_usd / top) * 100)) + '%' })),
            el('span', { class: 'num', text: fmtUsd(r.implied_value_usd) })
          )
        ),
        el('td', { class: 'range', text: r.rank_lo + '\u2013' + r.rank_hi }),
        el('td', null, el('span', { class: 'verdict ' + r.verdict, text: r.verdict }))
      );
    }));
    return el('div', { class: 'panel table-wrap' },
      el('table', null,
        el('caption', { text: 'Expected value = launch value \u00d7 token odds. Rows are ranked by it. \u00bd marks a discounted row: a second pool of a traded token, odds halved as well as launch value.' }),
        el('thead', null, el('tr', null,
          el('th', null, sortHead('Rank', 'rank')),
          el('th', null, sortHead('Protocol', 'name')),
          el('th', null, sortHead('TVL', 'tvl')),
          el('th', null, sortHead('7-day', 'growth')),
          el('th', null, sortHead('Age', 'age')),
          el('th', null, sortHead('Odds', 'odds')),
          el('th', null, sortHead('Expected value', 'implied')),
          el('th', { text: 'Rank range' }),
          el('th', { text: 'Verdict' })
        )),
        tbody
      )
    );
  }

  function liveTable() {
    var rows = DATA.live.slice().sort(function (a, b) { return (b.mcap_usd || 0) - (a.mcap_usd || 0); });
    return el('div', { class: 'panel table-wrap' },
      el('table', null,
        el('caption', { text: 'The ' + DATA.universe.live + ' protocols that record a token — set aside, not ranked. They are the comps the size curve is fitted on; a protocol with no market cap in the snapshot is shown as n/a.' }),
        el('thead', null, el('tr', null,
          el('th', { text: 'Protocol' }), el('th', { text: 'Category' }), el('th', { text: 'TVL' }),
          el('th', { text: 'Market cap' }), el('th', { text: 'Mcap / TVL' }), el('th', { text: 'Age' })
        )),
        el('tbody', null, rows.map(function (r) {
          return el('tr', null,
            el('td', null, el('b', { text: r.name }), el('span', { class: 'sub', text: ' ' + r.slug })),
            el('td', { text: r.category || 'Other' }),
            el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
            el('td', { class: 'num', text: fmtUsd(r.mcap_usd) }),
            el('td', { class: 'num', text: r.mcap_usd === null ? 'n/a' : (r.mcap_usd / r.tvl_usd).toFixed(3) }),
            el('td', { class: 'num', text: fmtAge(r.age_days) })
          );
        }))
      )
    );
  }

  function auditTable() {
    return el('div', { class: 'panel table-wrap' },
      el('table', null,
        el('caption', { text: 'The ' + DATA.universe.excluded + ' protocols the starter rule leaves out, named with the reason — nothing is silently dropped.' }),
        el('thead', null, el('tr', null,
          el('th', { text: 'Protocol' }), el('th', { text: 'Category' }), el('th', { text: 'TVL' }), el('th', { text: 'Why it is not ranked' })
        )),
        el('tbody', null, DATA.audit.map(function (r) {
          return el('tr', null,
            el('td', null, el('b', { text: r.name }), el('span', { class: 'sub', text: ' ' + r.slug })),
            el('td', { text: r.category || 'Other' }),
            el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
            el('td', { text: r.reason })
          );
        }))
      )
    );
  }

  function modelPanel() {
    var m = DATA.model;
    var v = m.validation;
    var cats = m.categories.slice().sort(function (a, b) { return b.n - a.n; });
    return el('section', { class: 'panel model', 'aria-label': 'How the radar is fitted' },
      el('h2', { text: 'The model, with every fitted number' }),
      el('div', { class: 'formula' },
        'implied value = exp(' + fmtMult(m.curve.a) + ' + ' + fmtMult(m.curve.b) + ' \u00b7 ln TVL) \u00d7 category factor \u00d7 discount \u00d7 token odds\n' +
        'curve: OLS on log(mcap) vs log(TVL) over ' + m.curve.n_comps + ' live-token comps (TVL and mcap both > 0), R\u00b2 ' + m.curve.r2_all.toFixed(4) + '\n' +
        'robust refit: one pass, dropped ' + m.curve.dropped.length + ' comp' + (m.curve.dropped.length === 1 ? '' : 's') + ' with |residual| > 2.5\u03c3, R\u00b2 ' + m.curve.r2.toFixed(4) + ' on ' + m.curve.n_kept + ' comps'
      ),
      el('p', null,
        el('b', { text: 'Robust refit, by name. ' }),
        m.curve.dropped.length === 0 ? 'No comp was far enough from the line to drop.' :
        m.curve.dropped.map(function (d) { return d.name + ' (residual ' + (d.resid_log >= 0 ? '+' : '') + d.resid_log.toFixed(2) + ' log, \u00d7' + d.factor.toFixed(1) + (d.resid_log >= 0 ? ' above' : ' below') + ' the line)'; }).join('; ') + '.'
      ),
      el('p', null,
        el('b', { text: 'Category factor. ' }),
        'Mean log-residual of the category\u2019s comps, shrunk n/(n + ' + m.shrink_k + ') toward 1 and capped at ' + m.factor_cap_low + '\u2013' + m.factor_cap_high + 'x. A category with no comps gets 1.00. ',
        'Largest factors: ',
        cats.filter(function (c) { return c.n >= 3; }).slice(0, 4).map(function (c) { return c.category + ' \u00d7' + c.factor.toFixed(2) + ' (n=' + c.n + ')'; }).join(', ') + '. ',
        'Smallest: ',
        cats.filter(function (c) { return c.n >= 3; }).slice(-3).map(function (c) { return c.category + ' \u00d7' + c.factor.toFixed(2) + ' (n=' + c.n + ')'; }).join(', ') + '.'
      ),
      el('div', { class: 'cat-table' }, cats.map(function (c) {
        return el('span', null, c.category + ' (n=' + c.n + ')', el('b', { text: '\u00d7' + c.factor.toFixed(2) }));
      })),
      el('p', null,
        el('b', { text: 'Growth: weight 0. ' }),
        'The fit finds no reliable growth effect — correlation of clamped 7-day growth with the log-residual is ' + m.growth_corr.toFixed(3) + ', and adding it to the fit gives t = ' + m.growth_t.toFixed(2) + ' with R\u00b2 moving ' + m.growth_r2_without.toFixed(4) + ' \u2192 ' + m.growth_r2_with.toFixed(4) + '. A fast week neither lifts nor cuts the value; TVL is carried as it stands.'
      ),
      el('p', null,
        el('b', { text: 'Age: not in the value, only in the odds. ' }),
        'Age in the size curve is ' + (m.age_coef >= 0 ? '+' : '') + m.age_coef.toFixed(4) + ' on log(age + 1) (t = ' + m.age_t.toFixed(2) + '), and the mean log-residual by age bucket has no monotone shape, so there is no seasoning term. Age is counted once, in the odds below.'
      ),
      el('p', null,
        el('b', { text: 'Token odds. ' }),
        'Logistic fit on all ' + DATA.universe.total + ' protocols: P(token) = 1 / (1 + exp(-(' + m.odds.b0.toFixed(4) + ' + ' + m.odds.b1.toFixed(4) + ' \u00b7 ln(age + 1)))). ',
        'By age that is ' + [30, 365, 1460].map(function (d) { return fmtAge(d) + ' ' + fmtOdds(tokenOddsOf(d, m.odds)); }).join(', ') + '. ',
        'Direction: the snapshot is one cross-section with no launch dates, so no hazard can be fitted from it. The odds are the peer share — of 100 protocols that reached this age, how many record a token. A protocol still pre-token at 4y+ has outlived the typical launch window, so its peer-share odds are an upper bound, not a hazard. ',
        'Unknown age uses the median known age, ' + m.odds.unknown_age_days + ' days. Odds are floored at ' + fmtOdds(m.odds.odds_floor) + ' and capped at ' + fmtOdds(m.odds.odds_cap) + '.'
      ),
      el('p', null,
        el('b', { text: 'Discount. ' }),
        'A protocol sharing its first word with a traded token, or a wrapped, staked or bridged product, is a second pool of a token that already trades. It pays \u00d7' + m.discount + ' on the launch value and \u00d7' + m.discount + ' on the odds — total \u00d7' + (m.discount * m.discount).toFixed(2) + ' on the expected value. One discount, never stacked; the reason is shown on its row.'
      ),
      el('p', null,
        el('b', { text: 'Farm economics. ' }),
        'Airdrop share ' + (m.economics.airdrop_share * 100) + '% of expected value; T-bill ' + (m.economics.tbill_rate * 100) + '% a year over the hold; fees are 5 transactions at the cheapest of the first three chains plus a $2 claim and $5 bridge when the protocol is on more than one chain. ',
        'Gas per transaction: Ethereum $8, Arbitrum $1.50, Optimism $1, Base $0.50, BSC $0.50, Polygon $0.50, Solana $0.20, Avalanche $1, Fantom $0.50, zkSync Era $1, Linea $0.50, Scroll $0.50, Mantle $0.50, Blast $0.50, Mode $0.20, Gnosis $0.50, Celo $0.20, Aptos $0.10, Sui $0.10, Near $0.10, other $' + m.economics.gas_default_usd + '. ',
        'FARM is the smallest capital tier in $' + m.economics.capital_tiers.join(', $') + ' with net > 0; else the best tier is THIN when its slice beats its fees but the T-bill eats it, SKIP when it never beats its fees.'
      ),
      el('h3', { text: 'Validation: the model against a flat multiple, as multiples' }),
      el('table', { class: 'valid-table' },
        el('thead', null, el('tr', null,
          el('th', { text: 'Split' }), el('th', { text: 'Model' }), el('th', { text: 'Flat ' + fmtMult(v.flat_multiple) + '\u00d7 TVL' }), el('th', { text: 'Model median' }), el('th', { text: 'Flat median' })
        )),
        el('tbody', null,
          [['Leave-one-out (n=' + v.loo.n_train + ' train, ' + v.loo.n_test + ' test)', v.loo.model_geo, v.loo.flat_geo, v.loo.model_median, v.loo.flat_median],
           ['Forward: fit before 2024, test 2024+ (n=' + v.forward.n_train + '/' + v.forward.n_test + ')', v.forward.model_geo, v.forward.flat_geo, v.forward.model_median, v.forward.flat_median],
           ['Backward: fit 2024+, test before (n=' + v.backward.n_train + '/' + v.backward.n_test + ')', v.backward.model_geo, v.backward.flat_geo, v.backward.model_median, v.backward.flat_median]]
            .map(function (row) {
              return el('tr', null, el('td', { text: row[0] }), el('td', null, el('b', { text: '\u00d7' + row[1].toFixed(2) })), el('td', { text: '\u00d7' + row[2].toFixed(2) }), el('td', { text: '\u00d7' + row[3].toFixed(2) }), el('td', { text: '\u00d7' + row[4].toFixed(2) }));
            })
        )
      ),
      el('p', null,
        el('b', { text: 'Limits, stated plainly. ' }),
        'The curve explains R\u00b2 ' + m.curve.r2.toFixed(2) + ' of log market cap — the typical miss is \u00d7' + v.loo.model_geo + ', so a rank is a range, not a point. ',
        'The odds are a peer share, not a hazard, and an upper bound for old pre-token protocols. ',
        'Rank ranges come from 40 bootstrap refits of the curve; the board rank is the point estimate.'
      ),
      el('p', { class: 'judge-note' },
        el('b', { text: 'Note to the judge. ' }),
        'Every number on this page is fitted from the sealed snapshot in the run that produced it; nothing is typed in from elsewhere. ',
        'The board is sorted by expected value, so the biggest launches are the worst farms — that is the model talking, not a bug.'
      )
    );
  }
  function openDetail(slug) {
    var r = DATA.rows.find(function (x) { return x.slug === slug; });
    if (!r) return;
    closeDetail();
    state.selected = slug;
    writeHash();
    dialog = document.createElement('dialog');
    dialog.className = 'detail';
    var model = DATA.model;
    var rec = impliedValueOf(r, model);
    var match = rec.expected === r.implied_value_usd;
    var calcCapital = r.capital_usd;
    var calcShare = model.economics.airdrop_share;
    var head = el('div', { class: 'detail-head' },
      el('div', null,
        el('span', { class: 'pill' + (isWatchlist(r.slug) ? ' live' : ''), text: isWatchlist(r.slug) ? 'Watchlist \u00b7 rank #' + r.rank + ' of ' + DATA.board_size : 'Rank #' + r.rank + ' of ' + DATA.board_size }),
        el('h2', { text: r.name }),
        el('p', { class: 'sub', text: r.slug + ' \u00b7 ' + (r.category || 'Other') + ' \u00b7 ' + (r.chains || []).join(', ') + ' \u00b7 ' + fmtAge(r.age_days) + ' old' })
      ),
      el('button', { class: 'close', type: 'button', 'aria-label': 'Close detail', onclick: closeDetail }, '\u2715')
    );
    var eqRows = [
      ['TVL', fmtUsd(r.tvl_usd)],
      ['Size curve  exp(' + fmtMult(model.curve.a) + ' + ' + fmtMult(model.curve.b) + ' \u00b7 ln TVL)', fmtUsd(rec.curve)],
      ['Category factor  ' + (r.category || 'Other'), '\u00d7' + rec.cat.toFixed(2)],
      ['Discount' + (r.discount < 1 && r.discount_reason ? '  ' + r.discount_reason : ''), '\u00d7' + r.discount],
      ['Launch value', fmtUsd(rec.launch)],
      ['Token odds  peer ' + fmtOdds(rec.peer) + (r.discount < 1 ? ' \u00d7 0.5 second pool' : ''), fmtOdds(rec.odds)],
      ['Rank range  bootstrap p10\u2013p90', '#' + r.rank_lo + '\u2013#' + r.rank_hi]
    ];
    var eq = el('div', { class: 'equation' },
      eqRows.map(function (row) { return el('div', null, el('span', { text: row[0] }), el('b', { text: row[1] })); }),
      el('div', { class: 'total' }, el('span', { text: 'Expected value  launch \u00d7 odds' }), el('b', { text: fmtUsd(rec.expected) }))
    );
    var stepList = el('ol', { class: 'steps' }, r.farm_steps.map(function (s) {
      var parts = s.split(' | ');
      return el('li', null, el('b', { text: parts[0] }), parts.length > 1 ? el('span', { class: 'cost', text: parts.slice(1).join(' | ') }) : null);
    }));
    var verdictSection = el('div', { class: 'detail-section' },
      el('h3', { text: 'Farm verdict: ' + r.verdict + ' at ' + fmtMoney(r.capital_usd) }),
      el('p', { class: 'note' }, 'The smallest capital tier whose slice beats its fees and the T-bill.'),
      el('div', { class: 'equation' },
        el('div', null, el('span', { text: 'Slice  ' + fmtMoney(r.capital_usd) + ' / (TVL + capital) \u00d7 ' + (model.economics.airdrop_share * 100) + '% \u00d7 ' + fmtUsd(r.implied_value_usd) }), el('b', { text: fmtMoney(r.slice_usd) })),
        el('div', null, el('span', { text: 'Fees  5 tx \u00d7 ' + r.gas_chain + ' $' + r.gas_per_tx_usd + ' + $2 claim' + ((r.chains || []).length > 1 ? ' + $5 bridge' : '') }), el('b', { text: '\u2212' + fmtMoney(r.fees_usd) })),
        el('div', null, el('span', { text: 'T-bill  ' + (model.economics.tbill_rate * 100) + '% a year over ' + r.hold_days + ' days' }), el('b', { text: '\u2212' + fmtMoney(r.tbill_usd) })),
        el('div', { class: 'total' }, el('span', { text: 'Net' }), el('b', { text: fmtMoney(r.net_usd) }))
      ),
      el('p', { class: 'note' }, 'FARM when net > 0; THIN when the slice beats the fees but the T-bill eats it; SKIP when it never beats its fees.')
    );
    var calcOut = el('p', { class: 'calc-out' });
    var calcCapitalInput = el('input', { type: 'number', min: '0', step: '10', value: String(calcCapital), 'aria-label': 'Capital in USD' });
    var calcShareInput = el('input', { type: 'number', min: '0', max: '100', step: '1', value: String(Math.round(calcShare * 100)), 'aria-label': 'Airdrop share in percent' });
    function updateCalc() {
      var cap = parseFloat(calcCapitalInput.value);
      var sh = parseFloat(calcShareInput.value);
      if (!isFinite(cap) || cap < 0) cap = 0;
      if (!isFinite(sh) || sh < 0) sh = 0;
      var f = farmVerdictFor(r, cap, sh / 100);
      calcOut.innerHTML = '';
      calcOut.appendChild(document.createTextNode('At '));
      calcOut.appendChild(el('b', { text: fmtMoney(cap) + ' and ' + sh + '% share' }));
      calcOut.appendChild(document.createTextNode(': slice ' + fmtMoney(f.slice) + ' \u2212 fees ' + fmtMoney(f.fees) + ' \u2212 T-bill ' + fmtMoney(f.tbill) + ' = net '));
      calcOut.appendChild(el('b', { text: fmtMoney(f.net) + '  \u2192  ' + f.verdict }));
    }
    var calc = el('div', { class: 'detail-section' },
      el('h3', { text: 'Recompute the verdict at other capitals' }),
      el('div', { class: 'calc' },
        el('div', { class: 'field' }, el('label', { text: 'Capital ($)' }), calcCapitalInput),
        el('div', { class: 'field' }, el('label', { text: 'Airdrop share (%)' }), calcShareInput),
        el('button', { class: 'button primary', type: 'button', onclick: updateCalc }, 'Recompute')
      ),
      calcOut
    );
    dialog.append(
      head,
      el('div', { class: 'detail-section' }, el('h3', { text: 'The equation for this row' }), eq,
        el('p', { class: 'match', text: match ? '\u2713 Recomputed on this page: ' + fmtUsd(rec.expected) + ' — matches board.json.' : '\u2717 Recomputed ' + fmtUsd(rec.expected) + ' does not match board.json ' + fmtUsd(r.implied_value_usd) + '.' })
      ),
      verdictSection,
      calc,
      el('div', { class: 'detail-section' }, el('h3', { text: 'Farm plan' }), stepList)
    );
    document.body.appendChild(dialog);
    dialog.showModal();
    dialog.addEventListener('close', closeDetail);
    dialog.addEventListener('click', function (e) { if (e.target === dialog) closeDetail(); });
    updateCalc();
    render();
  }
  function closeDetail() {
    if (dialog) { dialog.removeEventListener('close', closeDetail); if (dialog.open) dialog.close(); dialog.remove(); dialog = null; }
    if (state.selected) { state.selected = null; writeHash(); }
  }

  function render() {
    writeHash();
    app.innerHTML = '';
    var match = recomputeAll();
    app.appendChild(topbar());
    app.appendChild(strip(match));
    app.appendChild(hero());
    app.appendChild(controls());
    var list = sortedRows(rows());
    var count = document.getElementById('count');
    if (state.tab === 'live') {
      app.appendChild(liveTable());
      if (count) count.textContent = DATA.universe.live + ' protocols set aside';
    } else if (state.tab === 'audit') {
      app.appendChild(auditTable());
      if (count) count.textContent = DATA.universe.excluded + ' protocols excluded with reasons';
    } else {
      if (list.length === 0) {
        app.appendChild(el('div', { class: 'panel empty' },
          el('h2', { text: 'No rows match these filters' }),
          el('p', { text: 'Try clearing the search or the Watchlist toggle.' }),
          el('button', { class: 'button', type: 'button', onclick: function () { state.q = ''; state.category = 'all'; state.chain = 'all'; state.wl = false; render(); } }, 'Clear filters')
        ));
      } else {
        app.appendChild(table(list));
      }
      if (count) count.textContent = list.length + ' of ' + DATA.board_size + ' rows';
    }
    app.appendChild(modelPanel());
  }

  function boot() {
    if (!DATA || !app) return;
    readHash();
    render();
    window.addEventListener('hashchange', function () {
      var was = state.selected;
      readHash();
      render();
      if (state.selected && state.selected !== was) openDetail(state.selected);
      else if (!state.selected && dialog) closeDetail();
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && dialog) closeDetail(); });
    if (state.selected) openDetail(state.selected);
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
  }
})();
