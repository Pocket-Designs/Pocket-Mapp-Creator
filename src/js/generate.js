// Pocket-Mapp-Creator — random generators: names, realms, road routing, dungeons and towns
// Copyright (c) 2026 Pocket-Designs — MIT Licence
(function () {
  'use strict';
  const MT = window.MT;

  // ---------------------------------------------------------------- fantasy names
  const PRE = ['Ash', 'Bel', 'Black', 'Bright', 'Cold', 'Crow', 'Dun', 'Eld', 'Elm', 'Fair', 'Fen', 'Frost', 'Glen', 'Gold', 'Grey', 'Hal', 'Harrow', 'High', 'Iron', 'Kings', 'Lark', 'Long', 'Marsh', 'Mill', 'Mist', 'Moor', 'North', 'Oak', 'Old', 'Raven', 'Red', 'Rose', 'Salt', 'Silver', 'Stone', 'Storm', 'Sun', 'Thorn', 'Wester', 'White', 'Wild', 'Willow', 'Wolf', 'Wyn'];
  const SUF = ['bridge', 'brook', 'burg', 'bury', 'by', 'combe', 'dale', 'den', 'field', 'ford', 'gate', 'hall', 'ham', 'haven', 'hold', 'holm', 'hurst', 'keep', 'lea', 'mere', 'minster', 'moor', 'mouth', 'port', 'reach', 'stead', 'stone', 'ton', 'vale', 'wall', 'water', 'well', 'wick', 'wood'];
  const SYL = ['ar', 'bel', 'cor', 'dra', 'el', 'fen', 'gar', 'hal', 'ith', 'kar', 'lor', 'mar', 'nor', 'or', 'ran', 'sil', 'tor', 'ul', 'val', 'wyn', 'ys', 'zan', 'mir', 'dor', 'eth', 'ost', 'ael', 'ruin'];
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  MT.nameGen = function (rng) {
    const used = new Set();
    const pick = (a) => a[Math.floor(rng() * a.length)];
    const uniq = (fn) => { for (let i = 0; i < 40; i++) { const n = fn(); if (!used.has(n)) { used.add(n); return n; } } return fn(); };
    const word = (n) => cap(Array.from({ length: n }, () => pick(SYL)).join(''));
    return {
      town: () => uniq(() => (rng() < 0.8 ? pick(PRE) + pick(SUF) : word(2))),
      land: () => uniq(() => word(2 + (rng() < 0.4 ? 1 : 0))),
      realm: () => uniq(() => { const w = word(2); return pick([`Kingdom of ${w}`, `${w}`, `The ${w} Marches`, `Duchy of ${w}`, `${w} Reach`, `Free Cities of ${w}`, `${w}shire`]); }),
      sea: () => uniq(() => pick([`The ${pick(['Sundering', 'Silent', 'Shivering', 'Grey', 'Endless', 'Amber', 'Drowned', 'Storm', 'Glass', 'Western', 'Eastern', 'Northern'])} Sea`, `${word(2)} Sea`, `Bay of ${word(2)}`, `The ${word(2)} Strait`])),
      mountains: () => uniq(() => pick([`The ${word(2)} Mountains`, `${pick(['Grey', 'Iron', 'Frost', 'Dragon', 'Storm', 'Ash'])}peaks`, `The ${pick(PRE)} Spine`])),
      forest: () => uniq(() => pick([`${word(2)} Wood`, `The ${pick(['Dark', 'Old', 'Whispering', 'Deep', 'Silver', 'Tangled'])}wood`, `${pick(PRE)} Forest`]))
    };
  };

  // ---------------------------------------------------------------- Voronoi realms
  // Splits the rectangle W×H into one convex cell per site, then roughens shared edges the same way
  // on both sides so neighbouring realms still meet exactly.
  MT.voronoiCells = function (sites, W, H, seed, rough = 0.12) {
    const clip = (poly, a, b, c) => { // keep points where a*x + b*y <= c
      const out = [];
      for (let i = 0; i < poly.length; i++) {
        const P = poly[i], Q = poly[(i + 1) % poly.length];
        const pi = a * P[0] + b * P[1] - c, qi = a * Q[0] + b * Q[1] - c;
        if (pi <= 0) out.push(P);
        if ((pi < 0 && qi > 0) || (pi > 0 && qi < 0)) { const t = pi / (pi - qi); out.push([P[0] + (Q[0] - P[0]) * t, P[1] + (Q[1] - P[1]) * t]); }
      }
      return out;
    };
    const n1 = (x, y) => { const s = Math.sin(x * 12.9898 + y * 78.233 + seed * 0.37) * 43758.5453; return s - Math.floor(s); };
    const onFrame = (p) => p[0] < 0.5 || p[1] < 0.5 || p[0] > W - 0.5 || p[1] > H - 0.5;
    const key = (p) => `${Math.round(p[0] * 2)},${Math.round(p[1] * 2)}`;
    const memo = new Map();
    const roughEdge = (A, B, depth) => {
      if (depth === 0 || (onFrame(A) && onFrame(B))) return [];
      const k = key(A) < key(B) ? key(A) + '|' + key(B) : key(B) + '|' + key(A);
      let mid = memo.get(k);
      if (!mid) {
        const L = Math.hypot(B[0] - A[0], B[1] - A[1]), mx = (A[0] + B[0]) / 2, my = (A[1] + B[1]) / 2;
        mid = [mx + (n1(mx, my) - 0.5) * L * rough * 2, my + (n1(my, mx) - 0.5) * L * rough * 2];
        mid[0] = Math.min(W, Math.max(0, mid[0])); mid[1] = Math.min(H, Math.max(0, mid[1]));
        memo.set(k, mid);
      }
      return [...roughEdge(A, mid, depth - 1), mid, ...roughEdge(mid, B, depth - 1)];
    };
    return sites.map((s, i) => {
      let poly = [[0, 0], [W, 0], [W, H], [0, H]];
      sites.forEach((t, j) => {
        if (i === j) return;
        const a = t[0] - s[0], b = t[1] - s[1], c = (t[0] * t[0] + t[1] * t[1] - s[0] * s[0] - s[1] * s[1]) / 2;
        poly = clip(poly, a, b, c);
      });
      const out = [];
      for (let k = 0; k < poly.length; k++) { const A = poly[k], B = poly[(k + 1) % poly.length]; out.push(A, ...roughEdge(A, B, 4)); }
      return out.map(([x, y]) => [Math.round(x * 10) / 10, Math.round(y * 10) / 10]);
    });
  };

  // ---------------------------------------------------------------- A* on a cost grid (Infinity = blocked)
  MT.astar = function (cost, gw, gh, s, e) {
    const N = gw * gh, g = new Float32Array(N).fill(Infinity), from = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
    const idx = (x, y) => y * gw + x, h = (x, y) => Math.hypot(x - e[0], y - e[1]);
    const heap = []; // binary heap of [f, i]
    const push = (f, i) => { heap.push([f, i]); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
    const si = idx(s[0], s[1]), ei = idx(e[0], e[1]);
    g[si] = 0; push(h(s[0], s[1]), si);
    const D = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
    while (heap.length) {
      const [, i] = pop(); if (closed[i]) continue; closed[i] = 1;
      if (i === ei) break;
      const x = i % gw, y = (i / gw) | 0;
      for (const [dx, dy, dl] of D) {
        const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue;
        const j = idx(nx, ny); if (closed[j]) continue;
        const c = cost[j]; if (!isFinite(c) && j !== ei) continue;
        const ng = g[i] + dl * (isFinite(c) ? c : 1);
        if (ng < g[j]) { g[j] = ng; from[j] = i; push(ng + h(nx, ny), j); }
      }
    }
    if (from[ei] < 0 && si !== ei) return null;
    const path = []; for (let i = ei; i >= 0; i = from[i]) { path.push([i % gw, (i / gw) | 0]); if (i === si) break; }
    return path.reverse();
  };
  // Chaikin corner cutting: turns a stair-stepped grid path into a smooth line
  MT.smoothLine = function (pts, iters = 3) {
    let p = pts;
    for (let k = 0; k < iters; k++) {
      if (p.length < 3) return p;
      const q = [p[0]];
      for (let i = 0; i < p.length - 1; i++) { const [ax, ay] = p[i], [bx, by] = p[i + 1]; q.push([ax * 0.75 + bx * 0.25, ay * 0.75 + by * 0.25], [ax * 0.25 + bx * 0.75, ay * 0.25 + by * 0.75]); }
      q.push(p[p.length - 1]); p = q;
    }
    return p;
  };

  // ---------------------------------------------------------------- dungeon layout (grid squares)
  // Returns rooms, the carved squares and doorways. opts: { rooms, minSize, maxSize, corridor, loops }
  MT.dungeonLayout = function (cols, rows, opts, rng) {
    const R = (a, b) => a + Math.floor(rng() * (b - a + 1));
    const rooms = [], cells = new Set(), roomOf = new Map();
    const want = opts.rooms || 8, lo = opts.minSize || 3, hi = Math.max(lo, opts.maxSize || 7);
    for (let tries = 0; rooms.length < want && tries < want * 80; tries++) {
      const w = R(lo, hi), h = R(lo, Math.max(lo, hi - 1)), x = R(1, Math.max(1, cols - w - 2)), y = R(1, Math.max(1, rows - h - 2));
      if (x + w >= cols || y + h >= rows) continue;
      if (rooms.some((q) => x < q.x + q.w + 2 && x + w + 2 > q.x && y < q.y + q.h + 2 && y + h + 2 > q.y)) continue;
      const shape = rng() < (opts.round ?? 0.15) && w >= 5 && h >= 5 ? 'round' : 'rect';
      rooms.push({ x, y, w, h, shape });
    }
    rooms.forEach((r, i) => {
      for (let yy = r.y; yy < r.y + r.h; yy++) for (let xx = r.x; xx < r.x + r.w; xx++) {
        if (r.shape === 'round') { const dx = (xx + 0.5 - r.x - r.w / 2) / (r.w / 2), dy = (yy + 0.5 - r.y - r.h / 2) / (r.h / 2); if (dx * dx + dy * dy > 1.05) continue; }
        cells.add(`${xx},${yy}`); roomOf.set(`${xx},${yy}`, i);
      }
    });
    // connect rooms: a spanning tree by nearest neighbour, plus a few extra loops
    const centre = (r) => [Math.floor(r.x + r.w / 2), Math.floor(r.y + r.h / 2)];
    const links = [];
    const inTree = new Set([0]);
    while (inTree.size < rooms.length) {
      let best = null;
      for (const i of inTree) for (let j = 0; j < rooms.length; j++) {
        if (inTree.has(j)) continue;
        const [ax, ay] = centre(rooms[i]), [bx, by] = centre(rooms[j]), d = Math.abs(ax - bx) + Math.abs(ay - by);
        if (!best || d < best.d) best = { i, j, d };
      }
      if (!best) break; links.push([best.i, best.j]); inTree.add(best.j);
    }
    for (let k = 0; k < (opts.loops ?? 2) && rooms.length > 3; k++) { const i = R(0, rooms.length - 1), j = R(0, rooms.length - 1); if (i !== j) links.push([i, j]); }
    const cw = Math.max(1, opts.corridor || 1);
    const carve = (x, y) => { for (let a = 0; a < cw; a++) for (let b = 0; b < cw; b++) { const k = `${x + a},${y + b}`; if (x + a > 0 && y + b > 0 && x + a < cols - 1 && y + b < rows - 1) cells.add(k); } };
    for (const [i, j] of links) {
      let [x, y] = centre(rooms[i]); const [tx, ty] = centre(rooms[j]);
      const horizFirst = rng() < 0.5;
      const stepX = () => { while (x !== tx) { carve(x, y); x += Math.sign(tx - x); } };
      const stepY = () => { while (y !== ty) { carve(x, y); y += Math.sign(ty - y); } };
      if (horizFirst) { stepX(); stepY(); } else { stepY(); stepX(); }
      carve(x, y);
    }
    // doorways: where a corridor square meets a room square
    const doors = [], seen = new Set();
    rooms.forEach((r, i) => {
      for (const k of cells) {
        if (roomOf.get(k) !== i) continue;
        const [x, y] = k.split(',').map(Number);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nk = `${x + dx},${y + dy}`;
          if (!cells.has(nk) || roomOf.has(nk)) continue;           // only room → corridor
          // a corridor running along the room's side is not a doorway
          const side1 = `${x + dx + dy},${y + dy + dx}`, side2 = `${x + dx - dy},${y + dy - dx}`;
          if (cw === 1 && (cells.has(side1) || cells.has(side2))) continue;   // a doorway is a gap one square wide
          if (cw > 1 && (roomOf.get(side1) === i || roomOf.get(side2) === i)) continue;
          const ex = x + (dx > 0 ? 1 : 0), ey = y + (dy > 0 ? 1 : 0);   // the shared edge's start corner
          const dk = `${ex},${ey},${dx !== 0 ? 'v' : 'h'}`;
          if (seen.has(dk)) continue; seen.add(dk);
          doors.push({ room: i, x: dx !== 0 ? ex : x + 0.5, y: dy !== 0 ? ey : y + 0.5, vertical: dx !== 0, inside: [x, y], outside: [x + dx, y + dy] });
        }
      }
    });
    // wide corridors make several doorway squares side by side: keep one door per opening
    const kept = [];
    for (const d of doors) if (!kept.some((q) => q.room === d.room && q.vertical === d.vertical && Math.hypot(q.x - d.x, q.y - d.y) < cw + 0.1)) kept.push(d);
    return { rooms, cells: [...cells], doors: kept, roomOf };
  };

  // ---------------------------------------------------------------- town layout
  // Streets (as polylines), a market square and building lots along the streets.
  MT.townLayout = function (W, H, opts, rng) {
    const size = opts.size || 'village';
    const S = { hamlet: { side: 1, lots: 10 }, village: { side: 3, lots: 26 }, town: { side: 5, lots: 48 }, city: { side: 8, lots: 80 } }[size] || { side: 3, lots: 26 };
    const unit = Math.min(W, H);
    const cx = W * (0.42 + rng() * 0.16), cy = H * (0.42 + rng() * 0.16);
    const square = { x: cx, y: cy, r: unit * (size === 'hamlet' ? 0.05 : 0.07) };
    const streets = [];
    // main road crossing the whole map through the square, gently curved
    const a0 = rng() * Math.PI;
    const mk = (ang, len, from) => {
      const pts = [[from[0], from[1]]]; let x = from[0], y = from[1], a = ang;
      const step = unit * 0.06;
      for (let d = 0; d < len; d += step) { a += (rng() - 0.5) * 0.25; x += Math.cos(a) * step; y += Math.sin(a) * step; pts.push([x, y]); if (x < -step || y < -step || x > W + step || y > H + step) break; }
      return pts;
    };
    const far = Math.hypot(W, H);
    const main = mk(a0, far, [cx, cy]).reverse().concat(mk(a0 + Math.PI, far, [cx, cy]).slice(1));
    streets.push({ pts: main, w: unit * 0.035, main: true });
    for (let i = 0; i < S.side; i++) {
      const base = main[Math.floor(main.length * (0.25 + rng() * 0.5))];
      const ang = a0 + Math.PI / 2 + (rng() < 0.5 ? 0 : Math.PI) + (rng() - 0.5) * 0.6;
      const len = unit * (0.18 + rng() * 0.3) * (size === 'city' ? 1.4 : 1);
      streets.push({ pts: mk(ang, len, i === 0 ? [cx, cy] : base), w: unit * 0.024 });
    }
    // lots along both sides of every street
    const lots = [];
    const dist2seg = (px, py, ax, ay, bx, by) => { const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy || 1; const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / L)); return Math.hypot(px - ax - t * dx, py - ay - t * dy); };
    const nearStreet = (x, y, pad) => streets.concat(opts.avoid || []).some((s) => { for (let i = 1; i < s.pts.length; i++) if (dist2seg(x, y, ...s.pts[i - 1], ...s.pts[i]) < s.w / 2 + pad) return true; return false; });
    const bsize = unit * (opts.topdown ? 0.06 : 0.07);
    const reserve = opts.reserve || [];   // areas to keep clear (the title)
    for (const s of streets) {
      // walk along the street, dropping a lot every building-width on each side
      const samples = []; let carry = 0;
      for (let i = 1; i < s.pts.length; i++) {
        const [ax, ay] = s.pts[i - 1], [bx, by] = s.pts[i], L = Math.hypot(bx - ax, by - ay) || 1;
        let t = carry;
        for (; t < L; t += bsize * 1.12) samples.push([ax + (bx - ax) * t / L, ay + (by - ay) * t / L, -(by - ay) / L, (bx - ax) / L, Math.atan2(by - ay, bx - ax)]);
        carry = t - L;
      }
      for (const [px, py, nx, ny, ang] of samples) {
        if (lots.length >= S.lots) break;
        for (const side of [-1, 1]) {
          if (rng() < 0.12) continue;
          const off = s.w / 2 + bsize * 0.62;
          const x = px + nx * off * side, y = py + ny * off * side, angle = ang;
          if (reserve.some((r) => Math.abs(x - r.x) < r.w / 2 + bsize * 0.5 && Math.abs(y - r.y) < r.h / 2 + bsize * 0.5)) continue;
          if (x < bsize * 0.6 || y < bsize * 0.6 || x > W - bsize * 0.6 || y > H - bsize * 0.6) continue;
          if (Math.hypot(x - square.x, y - square.y) < square.r + bsize * 0.5) continue;
          if (nearStreet(x, y, bsize * 0.35)) continue;
          if (lots.some((q) => Math.hypot(q.x - x, q.y - y) < bsize * 1.05)) continue;
          lots.push({ x, y, angle, d: Math.hypot(x - cx, y - cy) });
        }
      }
    }
    lots.sort((a, b) => a.d - b.d);
    return { square, streets, lots, bsize, centre: [cx, cy] };
  };
})();
