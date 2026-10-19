/* Numerical teaching engine. Reference paths and deliberate reductions are in About. */
(function (root) {
  'use strict';
  const sum = a => a.reduce((s, v) => s + v, 0);
  const mean = a => a.length ? sum(a) / a.length : 0;
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], (a[2] || 0) - (b[2] || 0));
  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
  const argmin = a => a.reduce((best, v, i) => v < a[best] ? i : best, 0);
  const ordered = values => values.map((d, id) => ({ d, id })).sort((a, b) => a.d - b.d || a.id - b.id);
  const copy = a => JSON.parse(JSON.stringify(a));
  function subset(longer, shorter) {
    const n = longer.length, m = shorter.length;
    const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(Infinity));
    const take = Array.from({ length: m + 1 }, () => Array(n + 1).fill(false));
    dp[0].fill(0);
    for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) {
      const choose = dp[i - 1][j - 1] + Math.abs(longer[j - 1].d - shorter[i - 1].d);
      take[i][j] = choose <= dp[i][j - 1];
      dp[i][j] = Math.min(choose, dp[i][j - 1]);
    }
    const ids = []; let i = m, j = n;
    while (i > 0 && j > 0) { if (take[i][j]) { ids.unshift(j - 1); i--; } j--; }
    return ids.map(id => longer[id]);
  }
  function patterns(a, width) {
    if (!a.length) return [];
    const tiny = Number.EPSILON * Math.max(a[a.length - 1].d - a[0].d, ...a.map(v => Math.abs(v.d)), 1) * 16;
    const pad = [...Array.from({ length: width }, (_, i) => a[0].d - tiny * (width - i)),
      ...a.map(v => v.d), ...Array.from({ length: width }, (_, i) => a[a.length - 1].d + tiny * (i + 1))];
    return a.map((v, i) => {
      const window = pad.slice(i, i + 2 * width + 1).map(d => d - v.d), pairs = [];
      for (let j = 0; j < window.length; j++) for (let k = j + 1; k < window.length; k++) pairs.push(Math.abs(window[j] - window[k]));
      return { window, pairs };
    });
  }
  function match(query, reference, opts = {}) {
    const { width = 2, alpha = .5, normalized = false } = opts;
    let q = ordered(query), r = ordered(reference);
    const originalQ = copy(q), originalR = copy(r), trace = [], accepted = [];
    if (q.length > r.length) q = subset(q, r);
    else if (r.length > q.length) r = subset(r, q);
    const droppedQ = originalQ.filter(a => !q.some(b => a.id === b.id));
    const droppedR = originalR.filter(a => !r.some(b => a.id === b.id));
    trace.push({ phase: 'prepare', q: copy(q), r: copy(r), accepted: [], candidates: [], droppedQ, droppedR });
    let round = 0;
    while (q.length && r.length) {
      round++;
      const pq = patterns(q, width), pr = patterns(r, width);
      const details = q.map((a, i) => r.map((b, j) => {
        const abs = Math.abs(a.d - b.d), terms = pq[i].pairs.map((v, k) => Math.abs(v - pr[j].pairs[k]));
        const pattern = sum(terms) / (normalized ? Math.max(terms.length, 1) : 1);
        return { abs, pattern, cost: alpha * abs + (1 - alpha) * pattern,
          qWindow: pq[i].window, rWindow: pr[j].window, terms, normalizer: normalized ? terms.length : 1 };
      }));
      const costs = details.map(row => row.map(d => d.cost));
      const rows = costs.map(argmin), cols = r.map((_, j) => argmin(costs.map(row => row[j])));
      const candidates = q.flatMap((a, i) => cols[rows[i]] === i ? [{ qi: a.id, ri: r[rows[i]].id,
        q: a.d, r: r[rows[i]].d, cost: costs[i][rows[i]], i, j: rows[i] }] : []).sort((a, b) => a.cost - b.cost || a.i - b.i || a.j - b.j);
      const base = { round, q: copy(q), r: copy(r), details, costs, rows, cols, droppedQ, droppedR };
      trace.push({ ...base, phase: 'cost', candidates: [], accepted: copy(accepted) });
      trace.push({ ...base, phase: 'merge', candidates: copy(candidates), accepted: copy(accepted) });
      const checked = [];
      for (const p of candidates) {
        const crossing = accepted.find(old => (p.q - old.q) * (p.r - old.r) < 0);
        const decision = { ...p, rejected: !!crossing, crossing: crossing || null };
        checked.push(decision);
        if (!crossing) accepted.push(p);
        trace.push({ ...base, phase: 'purge', candidates: copy(checked), active: decision, accepted: copy(accepted) });
      }
      q = q.filter((_, i) => !candidates.some(p => p.i === i));
      r = r.filter((_, j) => !candidates.some(p => p.j === j));
      trace.push({ ...base, phase: 'urge', remainingQ: copy(q), remainingR: copy(r), candidates: copy(checked), accepted: copy(accepted) });
    }
    trace.push({ phase: 'done', q: [], r: [], candidates: [], accepted: copy(accepted), droppedQ, droppedR });
    return { matches: accepted, trace, originalQ, originalR, droppedQ, droppedR, opts: { width, alpha, normalized } };
  }
  function mapLocalize(query, refs, k = 3, alpha = .7) {
    const ranked = refs.map((ref, id) => {
      const result = match(query, ref.delays, { width: 6, alpha, normalized: true });
      const count = result.matches.length;
      const coverage = count / Math.max(query.length, ref.delays.length, 1);
      const avg = count ? mean(result.matches.map(m => m.cost)) : Infinity;
      return { id, ...ref, result, count, coverage, avg, score: count ? avg / coverage : Infinity, weight: 0 };
    }).sort((a, b) => a.score - b.score || a.id - b.id);
    const chosen = ranked.filter(r => Number.isFinite(r.score)).slice(0, k);
    const norm = sum(chosen.map(r => 1 / Math.max(r.score, Number.EPSILON)));
    chosen.forEach(r => { r.weight = (1 / Math.max(r.score, Number.EPSILON)) / norm; });
    return { ranked, chosen, estimate: chosen.length ? [sum(chosen.map(r => r.xy[0] * r.weight)), sum(chosen.map(r => r.xy[1] * r.weight))] : null };
  }
  function leastSquares(anchors, ranges, start, max = 40) {
    let p = [...start], history = [], lambda = .001;
    const objective = p => sum(anchors.map((a, i) => (dist(p, a) - ranges[i]) ** 2));
    for (let iter = 0; iter < max; iter++) {
      let aa = lambda, bb = 0, cc = lambda, gx = 0, gy = 0;
      anchors.forEach((a, i) => {
        const d = Math.max(dist(p, a), 1e-9), x = (p[0] - a[0]) / d, y = (p[1] - a[1]) / d, e = d - ranges[i];
        aa += x * x; bb += x * y; cc += y * y; gx += x * e; gy += y * e;
      });
      const determinant = aa * cc - bb * bb;
      if (Math.abs(determinant) < 1e-12) break;
      const step = [(-cc * gx + bb * gy) / determinant, (bb * gx - aa * gy) / determinant];
      const next = [p[0] + step[0], p[1] + step[1]], before = objective(p), after = objective(next);
      if (after <= before) {
        history.push({ from: [...p], to: [...next], before, after, step }); p = next; lambda = Math.max(lambda / 3, 1e-9);
        if (Math.hypot(...step) < 1e-7) break;
      } else lambda *= 10;
    }
    return { position: p, history, residuals: anchors.map((a, i) => dist(p, a) - ranges[i]) };
  }
  function smart(query, sources, initial, iterations = 4) {
    let p = [...initial]; const rounds = [];
    for (let t = 0; t < iterations; t++) {
      const predicted = sources.map(s => dist(p, s));
      const association = match(query, predicted);
      if (association.matches.length < 3) { rounds.push({ initial: p, predicted, association, stopped: true }); break; }
      const anchors = association.matches.map(m => sources[m.ri]);
      const ranges = association.matches.map(m => m.q);
      const fit = leastSquares(anchors, ranges, p);
      rounds.push({ initial: p, predicted, association, anchors, ranges, fit });
      const delta = dist(p, fit.position); p = fit.position;
      if (delta < 1e-5) break;
    }
    return { rounds, estimate: p };
  }
  function studentCDF(x) {
    const u = x / Math.sqrt(3);
    return .5 + (Math.atan(u) + u / (1 + u * u)) / Math.PI;
  }
  function density(d, location, scale = .18, limit = 25) {
    const s = Math.max(scale, .01), z = (d - location) / s;
    const norm = Math.max(studentCDF((limit - location) / s) - studentCDF(-location / s), 1e-15);
    return (2 / (Math.PI * Math.sqrt(3) * s)) / ((1 + z * z / 3) ** 2) / norm;
  }
  function features(point, data, scale = .18) {
    const { model, survey } = data, h = model.parameters.field_length_m;
    const spatial = survey.map(p => Math.exp(-(dist(p, point) ** 2) / (2 * h * h)));
    const denominator = sum(spatial) + .5;
    const intensities = model.anchors.map((_, j) => clamp((sum(spatial.map((w, i) => w * model.softCounts[i][j])) + .5 * model.globalCounts[j]) / denominator, .015, 1.8));
    const bgCounts = model.background.map(row => sum(row.map(p => p.w)));
    const bgIntegral = (sum(bgCounts.map((v, i) => v * spatial[i])) + .5 * mean(bgCounts)) / denominator;
    return { point, spatial, denominator, intensities, ranges: model.anchors.map(a => dist(point, a)), integral: sum(intensities) + bgIntegral, bgIntegral, scale };
  }
  function scorePoint(observed, f, data, nuisance = {}) {
    const survival = nuisance.survival ?? .75, clutter = nuisance.clutter ?? 2, limit = 25;
    const source = observed.map(d => sum(f.ranges.map((r, j) => f.intensities[j] * density(d, r, f.scale, limit))));
    const background = observed.map(d => {
      const byRow = data.model.background.map(row => sum(row.map(p => p.w * density(d, p.d, f.scale, limit))));
      return (sum(byRow.map((v, i) => v * f.spatial[i])) + .5 * mean(byRow)) / f.denominator;
    });
    const lambda = source.map((s, i) => survival * (s + background[i]) + clutter / limit);
    const penalty = -survival * f.integral - clutter;
    return { score: penalty + sum(lambda.map(Math.log)), source, background, lambda, penalty, expectedCount: -penalty };
  }
  function geometricMedian(points, weights) {
    let p = [sum(points.map((v, i) => v[0] * weights[i])), sum(points.map((v, i) => v[1] * weights[i]))];
    for (let iter = 0; iter < 100; iter++) {
      // Modified Weiszfeld handles a candidate exactly at the current iterate.
      const distances = points.map(q => dist(q, p));
      let denom = 0, num = [0, 0], residual = [0, 0], coincidentWeight = 0;
      points.forEach((q, i) => {
        if (distances[i] < 1e-10) { coincidentWeight += weights[i]; return; }
        const w = weights[i] / distances[i]; denom += w; num[0] += w * q[0]; num[1] += w * q[1];
        residual[0] += w * (q[0] - p[0]); residual[1] += w * (q[1] - p[1]);
      });
      if (denom === 0) return p;
      const eta = Math.min(1, coincidentWeight / Math.max(Math.hypot(...residual), 1e-30));
      const next = [eta * p[0] + (1 - eta) * num[0] / denom, eta * p[1] + (1 - eta) * num[1] / denom];
      if (dist(next, p) < 1e-7) return next;
      p = next;
    }
    return p;
  }
  function sapp(query, data, options = {}) {
    const step = .25, points = [];
    for (let y = .5; y <= 5.5; y += step) for (let x = .5; x <= 7.5; x += step) points.push([x, y]);
    const fs = points.map(p => features(p, data, options.scale || .18));
    // Evaluate residual kernels once per survey row and observation, not per grid cell.
    const bgByRow = data.model.background.map(row => query.map(d => sum(row.map(p => p.w * density(d, p.d, options.scale || .18)))));
    const bgGlobal = query.map((_, j) => mean(bgByRow.map(row => row[j])));
    const survival = options.survival ?? .75, clutter = options.clutter ?? 2;
    const scores = fs.map(f => {
      const source = query.map(d => sum(f.ranges.map((r, j) => f.intensities[j] * density(d, r, f.scale))));
      const background = query.map((_, j) => (sum(f.spatial.map((w, i) => w * bgByRow[i][j])) + .5 * bgGlobal[j]) / f.denominator);
      const lambda = source.map((v, i) => survival * (v + background[i]) + clutter / 25);
      const penalty = -survival * f.integral - clutter;
      return { score: penalty + sum(lambda.map(Math.log)), source, background, lambda, penalty, expectedCount: -penalty };
    });
    const maxScore = Math.max(...scores.map(s => s.score)), raw = scores.map(s => Math.exp(s.score - maxScore));
    const weights = raw.map(w => w / sum(raw)), mode = argmin(scores.map(s => -s.score));
    return { points, fs, scores, weights, mode, estimate: geometricMedian(points, weights), step };
  }
  function observations(point, sources, noise = .08, missing = false, clutter = 0) {
    let q = sources.map((s, i) => Math.max(.01, dist(point, s) + noise * Math.sin(i * 5.31 + 1.1)));
    if (missing) q = q.filter((_, i) => i !== 1);
    for (let i = 0; i < clutter; i++) q.push(9.3 + 6.9 * i);
    return q.sort((a, b) => a - b);
  }
  const api = { sum, mean, dist, clamp, argmin, match, mapLocalize, leastSquares, smart, density, features, scorePoint, geometricMedian, sapp, observations };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.LabEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
