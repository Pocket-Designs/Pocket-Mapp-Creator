// Pocket-Mapp-Creator — editor
// Copyright (c) 2026 Pocket-Designs <pocket-designs@proton.me> — MIT Licence
(function () {
  'use strict';
  const MT = window.MT;
  const MANIFEST = window.ASSET_MANIFEST;
  const BY_ID = Object.fromEntries(MANIFEST.map((a) => [a.id, a]));
  const api = window.mapp || null;
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const uid = () => Math.random().toString(36).slice(2, 10);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const rad = (d) => (d * Math.PI) / 180;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const KIND_BASE = { world: 0.8, town: 1, battle: 0.55, decor: 1.2 };
  const FONTS = ['IM Fell English', 'IM Fell English SC', 'Uncial Antiqua', 'Cinzel', 'Macondo', 'EB Garamond', 'Caveat', 'Orbitron', 'Georgia', 'Arial'];
  const INK = { parchment: '#3b2817', colour: '#2d2216', watercolour: '#4a3a2b', copperplate: '#1c2633', night: '#ecdfb8' };
  const PAPER = { parchment: '#f1e3bf', colour: '#f6efdc', watercolour: '#f7efdc', copperplate: '#f3eddb', night: '#1e2b45' };
  const STYLE_DESC = { parchment: 'Tolkien-style sepia ink on parchment', colour: 'Bold, saturated, game-ready', watercolour: 'Soft washes with bleeding edges', copperplate: 'Engraved atlas: fine dark ink, hatched seas', night: 'Cream ink and gold leaf on midnight-blue paper' };
  const MAP_TYPES = {
    world: { label: 'World / Region', desc: 'Continents, kingdoms, coastlines — side-view icons', kind: 'world', sizes: [[3000, 2000], [4000, 2800], [2400, 1800], [1920, 1080]] },
    town: { label: 'Town / City / Village', desc: '3/4 view buildings, walls, roads', kind: 'town', sizes: [[2400, 1800], [3000, 2000], [1920, 1080]] },
    battle: { label: 'Battle Map', desc: 'Top-down RPG encounter maps with a grid', kind: 'battle', sizes: [[1400, 1400], [2100, 1400], [2800, 2100], [1050, 1050]] }
  };
  const SHAPE_KINDS = { rect: 'Rectangle room', ellipse: 'Round room', poly: 'Polygon area' };
  const WALL_KINDS = { stone: 'Stone wall', wood: 'Wooden wall', ink: 'Ink outline', none: 'No wall' };
  const WALL_COL = { stone: { parchment: '#cbb488', colour: '#9a948a', watercolour: '#b9b3a8', copperplate: '#d6d0bf', night: '#45587f' }, wood: { parchment: '#bf9d66', colour: '#8a5a2e', watercolour: '#b08560', copperplate: '#c9bea2', night: '#4a5a80' } };
  const LINE_KINDS = { river: 'River', road: 'Road (dashed)', trail: 'Trail (dotted)', border: 'Border (dash-dot)', wall: 'Wall (solid)', ink: 'Ink line', realm: 'Realm (coloured area)' };
  const REALM_COLS = ['#b5523b', '#3f7fb0', '#5f9a3c', '#c99a2e', '#8a5aa8', '#3c9a8f', '#c7663f', '#6b7fb8', '#9a4f6e', '#7d8a2e'];
  // assets that give off light when the map's lighting is on (radius in map px at scale 1)
  const LIGHTS = { campfire: 300, 'wall-torch': 230, fireplace: 280, cauldron: 160, 'stone-lantern': 220, streetlight: 280, lighthouse: 420, reactor: 320, lava: 0, 'landing-pad': 0, altar: 140, 'treasure-pile': 120 };
  const LIGHT_COL = { campfire: '#ffb347', 'wall-torch': '#ffb347', fireplace: '#ffb347', cauldron: '#9dff8a', 'stone-lantern': '#ffd27a', streetlight: '#fff2c4', lighthouse: '#fff2c4', reactor: '#8fd8ff', altar: '#c7a8ff', 'treasure-pile': '#ffe08a' };

  // ------------------------------------------------------------------ state
  let doc = null;
  let filePath = null;
  let landMask, pathMask, maskScale = 1;
  let texMasks = {}, texScale = 0.5, texComp = null, lastTexSnap = {};   // texture brush: one soft mask per texture
  let base = null, baseDirty = true, baseBusy = false, landVer = 0;
  const view = { zoom: 1, ox: 0, oy: 0 };
  let tool = 'select';
  let stampKey = null;
  const selection = new Set();
  const ui = {
    brush: 60, brushMode: 'add', rough: true,
    fillMode: 'land', fillGap: 12, autoClose: true,
    scatter: false, spacing: 1, randScale: 0.15, randRot: 0, randFlip: true, stampScale: 1, depthSort: true,
    lineKind: 'river', lineWidth: 6,
    texType: 'grass', texSoft: 0.6, texStrength: 0.7, texOnlyLand: true, texErase: false,
    shapeKind: 'rect', shapeFill: 'stone', shapeWall: 'stone', shapeWallW: 14,
    textFont: 'IM Fell English', textSize: 60, textColor: null, textBold: false, textItalic: false,
    genre: 'fantasy', kind: 'all', search: '',
    activeLayer: 'land',
    dgMode: 'room', dgBrush: 1, autoRoute: true, realmLabel: true
  };
  let measure = null, dgDraft = null;   // Measure tool ruler; Dungeon tool room being dragged
  const mapStack = [];                  // linked maps: where to go back to
  const imgCache = new Map();
  let needsDraw = true;
  const history = []; let hIndex = -1;
  let lastLandSnap = null, lastPathSnap = null;

  const stage = $('#stage');
  const sctx = stage.getContext('2d');
  const measureCtx = document.createElement('canvas').getContext('2d');

  // ------------------------------------------------------------------ document
  function makeDoc(o = {}) {
    const type = o.type || 'world';
    return {
      app: 'Pocket-Mapp-Creator', version: 1,
      name: o.name || 'Untitled Map',
      type,
      width: o.width || MAP_TYPES[type].sizes[0][0],
      height: o.height || MAP_TYPES[type].sizes[0][1],
      style: o.style || 'parchment',
      seed: o.seed || Math.floor(Math.random() * 1e6),
      grid: { type: type === 'battle' ? 'square' : 'none', size: 70, color: '#000000', opacity: 0.25 },
      look: { bright: 100, contrast: 100, sat: 100, hue: 0, sepia: 0, vignette: 0 },
      coast: { rings: null, gap: null, width: null, sea: null, land: null },
      layers: { water: { visible: true, locked: false }, land: { visible: true, locked: false }, assets: { visible: true, locked: false }, text: { visible: true, locked: false } },
      dungeon: null,                                   // squares carved with the Dungeon tool
      scale: type === 'battle' ? { px: 70, units: 5, name: 'ft' } : { px: 100, units: 10, name: 'miles' },   // for the Measure tool
      light: { on: false, dark: 0.7, color: '#0a1022' },
      border: type !== 'battle',
      objects: [],
      custom: {}
    };
  }

  function allocMasks(w, h) {
    maskScale = Math.min(1, Math.sqrt(3.2e6 / (w * h)));
    const mw = Math.max(1, Math.round(w * maskScale)), mh = Math.max(1, Math.round(h * maskScale));
    landMask = document.createElement('canvas'); landMask.width = mw; landMask.height = mh;
    pathMask = document.createElement('canvas'); pathMask.width = mw; pathMask.height = mh;
    texScale = maskScale * 0.5; texMasks = {}; lastTexSnap = {};
    texComp = document.createElement('canvas'); texComp.width = mw; texComp.height = mh;
  }
  function fillMask(m, on) {
    const c = m.getContext('2d'); c.clearRect(0, 0, m.width, m.height);
    if (on) { c.fillStyle = '#fff'; c.fillRect(0, 0, m.width, m.height); }
  }

  function newMap(o) {
    landSel = null;
    doc = makeDoc(o);
    allocMasks(doc.width, doc.height);
    const start = o.start || 'sea'; // every new map starts as open ocean; the user paints the land
    if (start === 'generate' || start === 'example') MT.generateLand(landMask, doc.seed, 0.44);
    else if (start === 'land') fillMask(landMask, true);
    else fillMask(landMask, false);
    fillMask(pathMask, false);
    filePath = null;
    selection.clear();
    ui.kind = MAP_TYPES[doc.type].kind;
    ui.textSize = Math.round(Math.min(doc.width, doc.height) / 30); ui.textColor = null;
    syncTopbar(); buildLibrary();
    resetHistory();
    baseDirty = true;
    if (o.start === 'example') buildExample();
    zoomFit();
    refreshPanels();
  }

  // ------------------------------------------------------------------ images
  function assetSrc(key, style = doc.style) {
    if (key.startsWith('custom:')) return doc.custom[key.slice(7)]?.src;
    return `../assets/${style}/${key}.svg`;
  }
  function assetInfo(key) {
    if (key.startsWith('custom:')) {
      const c = doc.custom[key.slice(7)];
      return c ? { name: c.name, w: c.w, h: c.h, kind: 'custom', base: 1 } : null;
    }
    const a = BY_ID[key];
    return a ? { name: a.name, w: a.w, h: a.h, kind: a.kind, base: KIND_BASE[a.kind] || 1, genre: a.genre } : null;
  }
  function getImg(key, style = doc.style) {
    const k = key.startsWith('custom:') ? key : `${style}/${key}`;
    let im = imgCache.get(k);
    if (!im) {
      im = new Image();
      im.onload = () => { needsDraw = true; };
      im.src = assetSrc(key, style) || '';
      imgCache.set(k, im);
    }
    return im;
  }
  function whenImagesReady() {
    const keys = new Set(doc.objects.filter((o) => o.t === 'asset').map((o) => o.a));
    return Promise.all([...keys].map((k) => { const im = getImg(k); return im.complete ? im.decode().catch(() => {}) : new Promise((r) => { im.addEventListener('load', r, { once: true }); im.addEventListener('error', r, { once: true }); }); }));
  }

  // ------------------------------------------------------------------ base terrain
  function lookFilter() {
    const L = doc.look || {}; const f = [];
    if (L.bright && L.bright !== 100) f.push(`brightness(${L.bright}%)`); if (L.contrast && L.contrast !== 100) f.push(`contrast(${L.contrast}%)`);
    if (L.sat != null && L.sat !== 100) f.push(`saturate(${L.sat}%)`); if (L.hue) f.push(`hue-rotate(${L.hue}deg)`); if (L.sepia) f.push(`sepia(${L.sepia}%)`);
    return f.length ? f.join(' ') : 'none';
  }
  function rebuildBase(sync = false) {
    if (baseBusy) { baseDirty = true; return; }
    baseBusy = true;
    status('Inking coastlines…');
    const run = () => {
      try {
        base = MT.renderBase(baseOpts(maskScale)); landVer++; rebuildTexComposite();
      } finally {
        baseBusy = false; baseDirty = false; needsDraw = true; status('');
      }
    };
    if (sync) run(); else setTimeout(run, 16);
  }

  // ------------------------------------------------------------------ drawing objects
  function objSize(o) {
    if (o.t === 'asset') {
      const inf = assetInfo(o.a) || { w: 100, h: 100, base: 1 };
      return { w: inf.w * inf.base * o.s, h: inf.h * inf.base * o.s };
    }
    if (o.t === 'text') {
      const m = measureText(o);
      return { w: m.w * o.s, h: m.h * o.s };
    }
    if (o.t === 'shape') { const ww = o.wall === 'none' ? 0 : (o.wallW || 0); return { w: o.w * o.s + ww, h: o.h * o.s + ww }; }
    if (o.t === 'legend') { const L = legendLayout(o); return { w: L.w * o.s, h: L.h * o.s }; }
    return { w: 0, h: 0 };
  }
  function fontStr(o) { return `${o.italic ? 'italic ' : ''}${o.bold ? '700 ' : ''}${o.size}px "${o.font}"`; }
  function measureText(o) {
    measureCtx.font = fontStr(o);
    measureCtx.letterSpacing = `${o.spacing || 0}px`;
    const lines = textLines(o);
    let w = 0; for (const l of lines) w = Math.max(w, measureCtx.measureText(l).width);
    let h = lines.length * o.size * 1.15;
    if (o.curve) { const th = (Math.abs(o.curve) / 100) * Math.PI * 0.9; const R = w / th; h += R * (1 - Math.cos(th / 2)); w = Math.min(w, 2 * R * Math.sin(th / 2)) || w; }
    return { w: Math.max(w, 10), h: Math.max(h, 10) };
  }
  function textLines(o) { const t = o.upper ? o.text.toUpperCase() : o.text; return o.curve ? [t.replace(/\n/g, ' ')] : t.split('\n'); }

  // ---- object effects: drop shadow, glow, colour adjustments, tint (stored in o.ef)
  const tintCache = new Map();
  function tinted(key, im, color, amt) {
    const ck = `${key}|${doc.style}|${color}|${amt}`; let c = tintCache.get(ck);
    if (!c) {
      c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
      const x = c.getContext('2d'); x.drawImage(im, 0, 0); x.globalCompositeOperation = 'source-atop'; x.globalAlpha = amt; x.fillStyle = color; x.fillRect(0, 0, c.width, c.height);
      if (tintCache.size > 300) tintCache.clear(); tintCache.set(ck, c);
    }
    return c;
  }
  function fxFilter(e) {
    if (!e) return 'none'; const f = [];
    if (e.hue) f.push(`hue-rotate(${e.hue}deg)`); if (e.bright != null && e.bright !== 100) f.push(`brightness(${e.bright}%)`); if (e.sat != null && e.sat !== 100) f.push(`saturate(${e.sat}%)`);
    return f.length ? f.join(' ') : 'none';
  }
  const devScale = (ctx) => { const T = ctx.getTransform(); return Math.hypot(T.a, T.b) || 1; };
  // draw `paint` (a function that draws the object) with the object's shadow and glow
  function withFx(ctx, e, k, paint) {
    if (e && e.glow) { ctx.save(); ctx.shadowColor = e.glowColor || '#ffd84a'; ctx.shadowBlur = (e.glowSize || 16) * k; ctx.shadowOffsetX = ctx.shadowOffsetY = 0; paint(); paint(); ctx.restore(); }
    if (e && e.shadow) { ctx.save(); ctx.shadowColor = `rgba(0,0,0,${e.shadowStr ?? 0.5})`; ctx.shadowBlur = 12 * k; ctx.shadowOffsetX = 8 * k; ctx.shadowOffsetY = 10 * k; paint(); ctx.restore(); }
    else if (!(e && e.glow)) paint();
    else paint();
  }
  function drawAsset(ctx, o) {
    const inf = assetInfo(o.a); if (!inf) return;
    const im = getImg(o.a); if (!im.complete || !im.naturalWidth) return;
    const k = inf.base * o.s, dk = devScale(ctx), e = o.ef;
    ctx.save();
    ctx.translate(o.x, o.y); ctx.rotate(rad(o.r)); ctx.scale(o.fx ? -k : k, k);
    ctx.globalAlpha = o.o ?? 1;
    const img = e && e.tint && e.tintAmt > 0 ? tinted(o.a, im, e.tint, e.tintAmt) : im;
    if (e) ctx.filter = fxFilter(e);
    withFx(ctx, e, dk, () => ctx.drawImage(img, -inf.w / 2, -inf.h / 2, inf.w, inf.h));
    ctx.restore();
  }

  function drawText(ctx, o) {
    const dk = devScale(ctx), e = o.ef;
    if (e && (e.shadow || e.glow)) {   // effects: draw the label once more underneath with the shadow/glow
      const plain = { ...o, ef: null, halo: false };
      withFx(ctx, { ...e }, dk, () => drawText(ctx, plain));
    }
    ctx.save();
    ctx.translate(o.x, o.y); ctx.rotate(rad(o.r)); ctx.scale(o.s, o.s);
    ctx.globalAlpha = o.o ?? 1;
    ctx.font = fontStr(o);
    ctx.letterSpacing = `${o.spacing || 0}px`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    const halo = o.halo ? (o.haloColor || PAPER[doc.style]) : null;
    const lines = textLines(o);
    if (!o.curve) {
      const lh = o.size * 1.15, y0 = -((lines.length - 1) * lh) / 2;
      lines.forEach((l, i) => {
        if (halo) { ctx.strokeStyle = halo; ctx.lineWidth = o.size * 0.22; ctx.globalAlpha = (o.o ?? 1) * 0.85; ctx.strokeText(l, 0, y0 + i * lh); ctx.globalAlpha = o.o ?? 1; }
        ctx.fillStyle = o.color; ctx.fillText(l, 0, y0 + i * lh);
      });
    } else {
      const t = lines[0]; ctx.letterSpacing = '0px';
      const sp = o.spacing || 0;
      const widths = [...t].map((ch) => ctx.measureText(ch).width + sp);
      const W = widths.reduce((a, b) => a + b, 0) - sp;
      const th = (Math.abs(o.curve) / 100) * Math.PI * 0.9, R = W / th, sign = o.curve > 0 ? 1 : -1;
      const sag = R * (1 - Math.cos(th / 2));
      ctx.translate(0, sign * sag / 2);
      const pass = (stroke) => {
        let acc = 0;
        [...t].forEach((ch, i) => {
          const a = -th / 2 + (acc + widths[i] / 2) / R; acc += widths[i];
          ctx.save(); ctx.translate(0, sign * R); ctx.rotate(sign * a); ctx.translate(0, -sign * R);
          if (stroke) ctx.strokeText(ch, 0, 0); else ctx.fillText(ch, 0, 0);
          ctx.restore();
        });
      };
      if (halo) { ctx.strokeStyle = halo; ctx.lineWidth = o.size * 0.22; ctx.globalAlpha = (o.o ?? 1) * 0.85; pass(true); ctx.globalAlpha = o.o ?? 1; }
      ctx.fillStyle = o.color; pass(false);
    }
    ctx.restore();
  }

  function smoothPath(ctx, pts) {
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    if (pts.length === 2) { ctx.lineTo(pts[1][0], pts[1][1]); return; }
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
      ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
    }
    const l = pts[pts.length - 1]; ctx.lineTo(l[0], l[1]);
  }
  function lineColours(kind) {
    const L = MT.LOOK[doc.style]; const ink = INK[doc.style];
    const water = doc.style === 'parchment' ? '#dcc79a' : `rgb(${L.shallow ? L.shallow.join(',') : L.sea.join(',')})`;
    const st = doc.style;
    return { ink, water, border: st === 'parchment' ? '#8e4a2c' : st === 'night' ? '#d4a94a' : st === 'copperplate' ? '#7a3b2e' : '#a33a2a', wall: st === 'parchment' ? '#b99a68' : st === 'night' ? '#45587f' : st === 'copperplate' ? '#cfc8b4' : '#8a847a' };
  }
  function drawLine(ctx, o) {
    const pts = o.pts; if (!pts || pts.length < 2) return;
    if (o.kind === 'realm') { drawRealm(ctx, o); return; }
    const C = lineColours(o.kind); const w = o.w;
    ctx.save(); ctx.globalAlpha = o.o ?? 1; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (o.kind === 'river') {
      // tapered: thin at the source (first point), wide at the mouth
      const n = pts.length;
      const seg = (pass) => {
        for (let i = 1; i < n; i++) {
          const t = i / (n - 1), ww = w * (0.25 + 0.75 * t);
          ctx.beginPath(); ctx.moveTo(pts[i - 1][0], pts[i - 1][1]); ctx.lineTo(pts[i][0], pts[i][1]);
          ctx.lineWidth = pass ? Math.max(0.5, ww - 1.6) : ww + 1.6;
          ctx.strokeStyle = pass ? C.water : C.ink; ctx.stroke();
        }
      };
      seg(false); seg(true);
    } else {
      smoothPath(ctx, pts);
      if (o.kind === 'road') { ctx.setLineDash([w * 2.6, w * 1.6]); ctx.strokeStyle = C.ink; ctx.lineWidth = w * 0.6; }
      else if (o.kind === 'trail') { ctx.setLineDash([0.1, w * 1.8]); ctx.strokeStyle = C.ink; ctx.lineWidth = w * 0.8; }
      else if (o.kind === 'border') { ctx.setLineDash([w * 4, w * 1.5, w * 0.5, w * 1.5]); ctx.strokeStyle = C.border; ctx.lineWidth = w * 0.5; }
      else if (o.kind === 'wall') { ctx.strokeStyle = C.ink; ctx.lineWidth = w + 3; ctx.stroke(); smoothPath(ctx, pts); ctx.strokeStyle = C.wall; ctx.lineWidth = w; }
      else { ctx.strokeStyle = o.color || C.ink; ctx.lineWidth = w * 0.5; }
      ctx.stroke();
    }
    ctx.restore();
  }
  function snapPt(p, mode = 'corner') {
    const g = doc.grid; if (!g.snap || g.type !== 'square') return p;
    const z = g.size;
    if (mode === 'center') return { ...p, x: Math.floor(p.x / z) * z + z / 2, y: Math.floor(p.y / z) * z + z / 2 };
    return { ...p, x: Math.round(p.x / z) * z, y: Math.round(p.y / z) * z };
  }
  // realms sit at the bottom of the Assets layer, then rooms, then everything else
  const isRealm = (o) => o && o.t === 'line' && o.kind === 'realm';
  function objRank(o) { return isRealm(o) ? 0 : o.t === 'shape' ? 1 : 2; }
  function insertLow(o) {   // generated rivers, roads and walls go under the icons
    let i = 0; while (i < doc.objects.length && (objRank(doc.objects[i]) < 2 || doc.objects[i].t === 'line')) i++;
    doc.objects.splice(i, 0, o);
  }
  function insertObj(o) {
    const r = objRank(o); if (r === 2) { doc.objects.push(o); return; }
    let i = 0; while (i < doc.objects.length && objRank(doc.objects[i]) <= r) i++;
    doc.objects.splice(i, 0, o);
  }
  // ---- shapes: rooms and areas with a textured floor and a wall
  function shapePath(ctx, o) {
    ctx.beginPath();
    if (o.kind === 'ellipse') ctx.ellipse(0, 0, Math.max(0.5, o.w / 2), Math.max(0.5, o.h / 2), 0, 0, Math.PI * 2);
    else if (o.kind === 'poly' && o.pts && o.pts.length > 2) { o.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); }
    else ctx.rect(-o.w / 2, -o.h / 2, o.w, o.h);
  }
  function drawShape(ctx, o) {
    const ink = INK[doc.style], s = o.s || 1, W = (o.wallW || 0) / s, e = o.ef, dk = devScale(ctx);
    ctx.save(); ctx.globalAlpha = o.o ?? 1;
    if (e) ctx.filter = fxFilter(e);
    if (e && (e.shadow || e.glow)) {
      ctx.save(); ctx.translate(o.x, o.y); ctx.rotate(rad(o.r || 0)); ctx.scale(s, s);
      withFx(ctx, e, dk, () => { shapePath(ctx, o); if (o.fill && o.fill !== 'none') { ctx.fillStyle = ink; ctx.fill(); } ctx.strokeStyle = ink; ctx.lineWidth = Math.max(W, 2 / s); ctx.stroke(); });
      ctx.restore();
    }
    ctx.translate(o.x, o.y); ctx.rotate(rad(o.r || 0)); ctx.scale(s, s);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    if (o.fill && o.fill !== 'none') {
      shapePath(ctx, o);
      const pat = ctx.createPattern(MT.textureTile(o.fill, doc.style), 'repeat');
      pat.setTransform(new DOMMatrix().scale(1 / s));           // floor texture keeps its size when the room is resized
      ctx.fillStyle = pat; ctx.fill();
      // soft shadow inside the walls gives the room depth
      if (o.wall !== 'none') { ctx.save(); shapePath(ctx, o); ctx.clip(); ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = Math.max(4, W * 1.2) * s; ctx.strokeStyle = ink; ctx.lineWidth = W * 1.4; shapePath(ctx, o); ctx.stroke(); ctx.restore(); }
    }
    if (o.wall && o.wall !== 'none') {
      shapePath(ctx, o);
      if (o.wall === 'ink') { ctx.strokeStyle = ink; ctx.lineWidth = Math.max(1, W * 0.45); ctx.stroke(); }
      else {
        const col = (WALL_COL[o.wall] || WALL_COL.stone)[doc.style];
        ctx.strokeStyle = ink; ctx.lineWidth = W + 3 / s; ctx.stroke();
        shapePath(ctx, o); ctx.strokeStyle = col; ctx.lineWidth = W; ctx.stroke();
        shapePath(ctx, o); ctx.strokeStyle = ink; ctx.globalAlpha = (o.o ?? 1) * 0.45; ctx.lineWidth = Math.max(0.6, W * 0.12);
        ctx.setLineDash(o.wall === 'stone' ? [W * 1.6, W * 0.9] : []); ctx.stroke(); ctx.setLineDash([]);
      }
    }
    ctx.restore();
  }
  // ---- realms: coloured areas with a dashed border, kept to the land (like a political map)
  const realmCache = new Map();
  function realmPath(ctx, pts) { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); }
  function drawRealm(ctx, o) {
    const pts = o.pts; if (pts.length < 3) return;
    const b = lineBounds(o), bw = b.x1 - b.x0, bh = b.y1 - b.y0; if (bw < 1 || bh < 1) return;
    const sc = Math.min(devScale(ctx), 3000 / Math.max(bw, bh)), q = Math.round(sc * 8) / 8 || sc;
    const col = o.color || REALM_COLS[0], w = o.w || 6, clip = o.clip !== false && layerState('land').visible;
    const key = `${pts.length}|${pts[0]}|${pts[pts.length >> 1]}|${col}|${o.fill ?? 0.3}|${w}|${clip}|${q}|${clip ? landVer : 0}|${doc.style}`;
    let c = realmCache.get(o.id);
    if (!c || c._key !== key) {
      c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(bw * q)); c.height = Math.max(1, Math.ceil(bh * q)); c._key = key;
      const x = c.getContext('2d'); x.scale(q, q); x.translate(-b.x0, -b.y0);
      realmPath(x, pts); x.globalAlpha = o.fill ?? 0.3; x.fillStyle = col; x.fill();
      // a stronger wash just inside the border, as on painted atlas maps
      x.save(); realmPath(x, pts); x.clip(); x.globalAlpha = Math.min(1, (o.fill ?? 0.3) + 0.25); x.strokeStyle = col; x.lineWidth = w * 3.2; x.lineJoin = 'round'; realmPath(x, pts); x.stroke(); x.restore();
      x.globalAlpha = 1; x.strokeStyle = col; x.lineWidth = w * 0.55; x.lineJoin = 'round'; x.setLineDash([w * 2.2, w * 1.3]); realmPath(x, pts); x.stroke(); x.setLineDash([]);
      if (clip) { x.globalCompositeOperation = 'destination-in'; x.setTransform(1, 0, 0, 1, 0, 0); x.drawImage(landMask, b.x0 * maskScale, b.y0 * maskScale, bw * maskScale, bh * maskScale, 0, 0, c.width, c.height); }
      if (realmCache.size > 60) realmCache.clear();
      realmCache.set(o.id, c);
    }
    ctx.save(); ctx.globalAlpha = o.o ?? 1; ctx.drawImage(c, b.x0, b.y0, bw, bh); ctx.restore();
  }
  function pointInPoly(x, y, pts) {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi || 1e-9) + xi) inside = !inside; }
    return inside;
  }

  // ---- dungeon floor plan: grid squares carved out of solid rock (Dungeon tool)
  function dungeonData(create = true) {
    if (!doc.dungeon && create) doc.dungeon = { size: doc.grid.type === 'square' ? doc.grid.size : 70, cells: [], fill: 'stone', wall: 'stone', wallW: 12, v: 0 };
    return doc.dungeon;
  }
  const dgCache = { ref: null, v: -1, n: -1 };
  function dungeonPaths() {
    const D = doc.dungeon; if (!D || !D.cells.length) return null;
    if (dgCache.ref === D && dgCache.v === D.v && dgCache.n === D.cells.length) return dgCache;
    const z = D.size, set = new Set(D.cells), floor = new Path2D(), walls = new Path2D();
    const rows = new Map(), H = new Map(), V = new Map();
    const add = (m, line, a) => { if (!m.has(line)) m.set(line, new Set()); m.get(line).add(a); };
    for (const k of D.cells) {
      const [x, y] = k.split(',').map(Number);
      if (!rows.has(y)) rows.set(y, []); rows.get(y).push(x);
      if (!set.has(`${x},${y - 1}`)) add(H, y, x); if (!set.has(`${x},${y + 1}`)) add(H, y + 1, x);
      if (!set.has(`${x - 1},${y}`)) add(V, x, y); if (!set.has(`${x + 1},${y}`)) add(V, x + 1, y);
    }
    const runs = (arr, fn) => { const a = [...arr].sort((p, q) => p - q); let st = a[0], pr = a[0]; for (let i = 1; i <= a.length; i++) { if (i < a.length && a[i] === pr + 1) { pr = a[i]; continue; } fn(st, pr); if (i < a.length) st = pr = a[i]; } };
    for (const [y, xs] of rows) runs(xs, (a, b) => floor.rect(a * z, y * z, (b - a + 1) * z, z));
    for (const [y, xs] of H) runs(xs, (a, b) => { walls.moveTo(a * z, y * z); walls.lineTo((b + 1) * z, y * z); });
    for (const [x, ys] of V) runs(ys, (a, b) => { walls.moveTo(x * z, a * z); walls.lineTo(x * z, (b + 1) * z); });
    Object.assign(dgCache, { ref: D, v: D.v, n: D.cells.length, floor, walls });
    return dgCache;
  }
  function drawDungeon(ctx) {
    const P = dungeonPaths(); if (!P) return;
    const D = doc.dungeon, ink = INK[doc.style], W = D.wallW || 12, dk = devScale(ctx);
    ctx.save();
    if (D.fill && D.fill !== 'none') {
      const pat = ctx.createPattern(MT.textureTile(D.fill, doc.style), 'repeat'); ctx.fillStyle = pat; ctx.fill(P.floor);
      if (D.wall !== 'none') { ctx.save(); ctx.clip(P.floor); ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = Math.max(4, W * 1.3) * dk; ctx.strokeStyle = ink; ctx.lineWidth = W * 1.4; ctx.stroke(P.walls); ctx.restore(); }
    }
    if (D.wall && D.wall !== 'none') {
      ctx.lineCap = 'square'; ctx.lineJoin = 'miter';
      if (D.wall === 'ink') { ctx.strokeStyle = ink; ctx.lineWidth = Math.max(1, W * 0.45); ctx.stroke(P.walls); }
      else {
        ctx.strokeStyle = ink; ctx.lineWidth = W + 3; ctx.stroke(P.walls);
        ctx.strokeStyle = (WALL_COL[D.wall] || WALL_COL.stone)[doc.style] || WALL_COL.stone.parchment; ctx.lineWidth = W; ctx.stroke(P.walls);
        ctx.globalAlpha = 0.45; ctx.strokeStyle = ink; ctx.lineWidth = Math.max(0.6, W * 0.12); ctx.lineCap = 'butt';
        if (D.wall === 'stone') ctx.setLineDash([W * 1.6, W * 0.9]); ctx.stroke(P.walls); ctx.setLineDash([]);
      }
    }
    ctx.restore();
  }
  function dgCell(p) { const z = dungeonData().size; return [Math.floor(p.x / z), Math.floor(p.y / z)]; }
  function dgApply(keys, erase) {
    const D = dungeonData(), set = new Set(D.cells); let ch = false;
    for (const k of keys) { if (erase) { if (set.delete(k)) ch = true; } else if (!set.has(k)) { set.add(k); ch = true; } }
    if (ch) { D.cells = [...set]; D.v = (D.v || 0) + 1; needsDraw = true; }
    return ch;
  }
  function dgBrushKeys(c) { const n = ui.dgBrush || 1, o = Math.floor((n - 1) / 2), out = []; for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) out.push(`${c[0] - o + a},${c[1] - o + b}`); return out; }
  function dgRectKeys(a, b) { const out = []; for (let y = Math.min(a[1], b[1]); y <= Math.max(a[1], b[1]); y++) for (let x = Math.min(a[0], b[0]); x <= Math.max(a[0], b[0]); x++) out.push(`${x},${y}`); return out; }

  // ---- map key: lists the realms and, optionally, every place label with its grid square
  const COL_LETTERS = (i) => { let s = ''; i++; while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };
  function gridRef(x, y) {
    const z = doc.grid.type === 'square' ? doc.grid.size : Math.max(doc.width, doc.height) / 10;
    return `${COL_LETTERS(Math.floor(x / z))}${Math.floor(y / z) + 1}`;
  }
  function legendRows(o) {
    const rows = [];
    if (o.realms !== false) for (const r of doc.objects) if (isRealm(r) && !r.hidden) rows.push({ sw: r.color, text: r.name || 'Realm' });
    if (o.places) {
      const pl = doc.objects.filter((t) => t.t === 'text' && !t.hidden && !t.noIndex && !t.realmOf && t.text.trim()).map((t) => ({ text: t.text.replace(/\n/g, ' '), ref: gridRef(t.x, t.y) }));
      pl.sort((a, b) => a.text.localeCompare(b.text));
      if (pl.length && rows.length) rows.push({ gap: true });
      rows.push(...pl.slice(0, 40));
    }
    return rows;
  }
  function legendLayout(o) {
    const fs = o.size || 28, pad = fs * 0.8, rows = legendRows(o);
    measureCtx.font = `${fs}px "${o.font || 'IM Fell English'}"`; measureCtx.letterSpacing = '0px';
    let w = 0; for (const r of rows) if (!r.gap) w = Math.max(w, measureCtx.measureText(r.text).width + (r.sw ? fs * 1.5 : 0) + (r.ref ? measureCtx.measureText(' ' + r.ref).width + fs : 0));
    measureCtx.font = `700 ${fs * 1.25}px "${o.font || 'IM Fell English'}"`; w = Math.max(w, measureCtx.measureText(o.title || 'Key').width);
    const lh = fs * 1.35, h = pad * 2 + fs * 1.7 + rows.reduce((a, r) => a + (r.gap ? lh * 0.5 : lh), 0) + (rows.length ? 0 : lh);
    return { w: w + pad * 2, h, rows, fs, pad, lh };
  }
  function drawLegend(ctx, o) {
    const L = legendLayout(o), ink = INK[doc.style], font = o.font || 'IM Fell English';
    ctx.save(); ctx.translate(o.x, o.y); ctx.rotate(rad(o.r || 0)); ctx.scale(o.s, o.s); ctx.globalAlpha = o.o ?? 1;
    const x0 = -L.w / 2, y0 = -L.h / 2;
    withFx(ctx, o.ef, devScale(ctx), () => { ctx.fillStyle = PAPER[doc.style]; ctx.fillRect(x0, y0, L.w, L.h); });
    ctx.strokeStyle = ink; ctx.lineWidth = L.fs * 0.1; ctx.strokeRect(x0, y0, L.w, L.h);
    ctx.lineWidth = L.fs * 0.04; ctx.strokeRect(x0 + L.fs * 0.22, y0 + L.fs * 0.22, L.w - L.fs * 0.44, L.h - L.fs * 0.44);
    ctx.fillStyle = ink; ctx.textBaseline = 'middle';
    ctx.font = `700 ${L.fs * 1.25}px "${font}"`; ctx.textAlign = 'center'; ctx.fillText(o.title || 'Key', 0, y0 + L.pad + L.fs * 0.55);
    let y = y0 + L.pad + L.fs * 1.7 + L.lh / 2;
    ctx.font = `${L.fs}px "${font}"`;
    if (!L.rows.length) { ctx.globalAlpha *= 0.6; ctx.fillText('(add realms or labels)', 0, y); }
    for (const r of L.rows) {
      if (r.gap) { y += L.lh * 0.5; continue; }
      let x = x0 + L.pad;
      if (r.sw) { ctx.save(); ctx.globalAlpha *= 0.75; ctx.fillStyle = r.sw; ctx.fillRect(x, y - L.fs * 0.4, L.fs * 1.1, L.fs * 0.8); ctx.restore(); ctx.strokeRect(x, y - L.fs * 0.4, L.fs * 1.1, L.fs * 0.8); x += L.fs * 1.5; }
      ctx.textAlign = 'left'; ctx.fillStyle = ink; ctx.fillText(r.text, x, y);
      if (r.ref) { ctx.textAlign = 'right'; ctx.fillText(r.ref, x0 + L.w - L.pad, y); }
      y += L.lh;
    }
    ctx.restore();
  }

  // ---- lighting: darkness over the map with pools of light round torches, fires and lamps
  function lightOf(o) {
    if (o.t !== 'asset' || o.hidden) return null;
    if (o.light === false) return null;
    if (o.light && o.light.r) return { r: o.light.r, color: o.light.color || '#ffd27a' };
    const r = LIGHTS[o.a]; if (!r) return null;
    const inf = assetInfo(o.a); return { r: r * (inf ? inf.base / 0.55 : 1) * Math.sqrt(o.s), color: LIGHT_COL[o.a] || '#ffd27a' };
  }
  let darkCache = null;
  function drawLighting(ctx) {
    const L = doc.light; if (!L || !L.on) return;
    const lights = []; for (const o of doc.objects) { const l = lightOf(o); if (l) lights.push([o.x, o.y, l.r, l.color]); }
    const sc = Math.min(1, 1600 / Math.max(doc.width, doc.height));
    const key = JSON.stringify([lights, L.dark, L.color, doc.width, doc.height]);
    if (!darkCache || darkCache._key !== key) {
      const c = document.createElement('canvas'); c.width = Math.ceil(doc.width * sc); c.height = Math.ceil(doc.height * sc); c._key = key;
      const x = c.getContext('2d'); x.scale(sc, sc);
      x.fillStyle = L.color; x.globalAlpha = L.dark; x.fillRect(0, 0, doc.width, doc.height); x.globalAlpha = 1;
      x.globalCompositeOperation = 'destination-out';
      for (const [lx, ly, r] of lights) { const g = x.createRadialGradient(lx, ly, 0, lx, ly, r); g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.45, 'rgba(0,0,0,.85)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(lx - r, ly - r, r * 2, r * 2); }
      darkCache = c;
    }
    ctx.save(); ctx.drawImage(darkCache, 0, 0, doc.width, doc.height);
    ctx.globalCompositeOperation = 'screen';
    for (const [lx, ly, r, col] of lights) { const g = ctx.createRadialGradient(lx, ly, 0, lx, ly, r * 0.8); g.addColorStop(0, col + '66'); g.addColorStop(1, col + '00'); ctx.fillStyle = g; ctx.fillRect(lx - r, ly - r, r * 2, r * 2); }
    ctx.restore();
  }

  // ---- layer effects (like sheet effects): opacity, shadow and glow for a whole layer
  function layerFx(id) { const f = layerState(id).fx; return f && (f.shadow || f.glow || (f.opacity != null && f.opacity < 1)) ? f : null; }
  function drawLayer(ctx, id, paint) {
    const f = layerFx(id); if (!f) { paint(ctx); return; }
    const off = document.createElement('canvas'); off.width = ctx.canvas.width; off.height = ctx.canvas.height;
    const x = off.getContext('2d'); x.setTransform(ctx.getTransform()); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
    paint(x);
    const k = devScale(ctx);
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = f.opacity ?? 1;
    if (f.glow) { ctx.save(); ctx.shadowColor = f.glowColor || '#ffd84a'; ctx.shadowBlur = 18 * k; ctx.drawImage(off, 0, 0); ctx.restore(); }
    if (f.shadow) { ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = 10 * k; ctx.shadowOffsetX = 6 * k; ctx.shadowOffsetY = 8 * k; }
    ctx.drawImage(off, 0, 0); ctx.restore();
  }

  function drawObject(ctx, o) {
    if (o.hidden) return;
    if (o.t === 'legend') { drawLegend(ctx, o); return; }
    if (o.t === 'shape') { drawShape(ctx, o); return; }
    if (o.t === 'asset') drawAsset(ctx, o);
    else if (o.t === 'text') drawText(ctx, o);
    else if (o.t === 'line') drawLine(ctx, o);
  }

  function drawGrid(ctx) {
    const g = doc.grid; if (g.type === 'none') return;
    ctx.save(); ctx.strokeStyle = g.color; ctx.globalAlpha = g.opacity; ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (g.type === 'square') {
      for (let x = 0; x <= doc.width + 0.1; x += g.size) { ctx.moveTo(x, 0); ctx.lineTo(x, doc.height); }
      for (let y = 0; y <= doc.height + 0.1; y += g.size) { ctx.moveTo(0, y); ctx.lineTo(doc.width, y); }
    } else {
      const r = g.size / 2, hh = Math.sqrt(3) * r;
      for (let col = 0, x = r; x - r < doc.width; col++, x += r * 1.5) {
        for (let y = (col % 2 ? hh : hh / 2); y - hh / 2 < doc.height; y += hh) {
          for (let i = 0; i < 6; i++) { const a = (Math.PI / 3) * i, px = x + r * Math.cos(a), py = y + r * Math.sin(a); if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py); }
          ctx.closePath();
        }
      }
    }
    ctx.stroke(); ctx.restore();
  }
  function drawBorder(ctx) {
    if (!doc.border) return;
    const ink = INK[doc.style]; const m = Math.min(doc.width, doc.height);
    const t = Math.max(6, m * 0.008), g = t * 1.6;
    ctx.save(); ctx.strokeStyle = ink;
    ctx.lineWidth = t; ctx.strokeRect(t / 2, t / 2, doc.width - t, doc.height - t);
    ctx.lineWidth = t * 0.25; ctx.strokeRect(t + g, t + g, doc.width - 2 * (t + g), doc.height - 2 * (t + g));
    if (doc.style === 'parchment') {
      // tick marks like an old surveyed chart
      ctx.lineWidth = t * 0.2;
      const step = m / 24, a = t, b = t + g;
      for (let x = b + step; x < doc.width - b; x += step) { ctx.beginPath(); ctx.moveTo(x, a); ctx.lineTo(x, b); ctx.moveTo(x, doc.height - a); ctx.lineTo(x, doc.height - b); ctx.stroke(); }
      for (let y = b + step; y < doc.height - b; y += step) { ctx.beginPath(); ctx.moveTo(a, y); ctx.lineTo(b, y); ctx.moveTo(doc.width - a, y); ctx.lineTo(doc.width - b, y); ctx.stroke(); }
    }
    ctx.restore();
  }

  // Render the full map into a 2D context in map coordinates
  function renderMapContent(ctx, baseCanvas, opts = {}) {
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    if (baseCanvas) ctx.drawImage(baseCanvas, 0, 0, doc.width, doc.height);
    else { ctx.fillStyle = PAPER[doc.style]; ctx.fillRect(0, 0, doc.width, doc.height); }
    const texLayer = opts.texLayer !== undefined ? opts.texLayer : texComp;
    if (texLayer && Object.keys(texMasks).length && layerState('land').visible) ctx.drawImage(texLayer, 0, 0, doc.width, doc.height);
    if (opts.floatLand) drawFloatingLand(ctx);
    if (opts.grid !== false) drawGrid(ctx);
    // layer 3: assets & lines (the dungeon floor plan sits at the bottom of it)
    if (layerState('assets').visible) drawLayer(ctx, 'assets', (c) => { drawDungeon(c); for (const o of doc.objects) if (layerOf(o) === 'assets') drawObject(c, o); });
    drawLighting(ctx);
    drawBorder(ctx);
    // layer 4: text, always on top so nothing covers the labels
    if (layerState('text').visible) drawLayer(ctx, 'text', (c) => { for (const o of doc.objects) if (layerOf(o) === 'text') drawObject(c, o); });
    // vignette: darker, aged edges
    const v = doc.look && doc.look.vignette;
    if (v > 0) {
      const g = ctx.createRadialGradient(doc.width / 2, doc.height / 2, Math.min(doc.width, doc.height) * 0.3, doc.width / 2, doc.height / 2, Math.hypot(doc.width, doc.height) / 2);
      g.addColorStop(0, 'rgba(40,24,10,0)'); g.addColorStop(1, `rgba(40,24,10,${(v / 100) * 0.85})`);
      ctx.save(); ctx.fillStyle = g; ctx.fillRect(0, 0, doc.width, doc.height); ctx.restore();
    }
  }

  // ------------------------------------------------------------------ stage render loop
  function resizeStage() {
    const r = stage.parentElement.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    stage.width = Math.round(r.width * dpr); stage.height = Math.round(r.height * dpr);
    needsDraw = true;
  }
  let shapeDraft = null;
  let paintPreview = null; // canvas at mask res showing un-inked brush strokes
  let lineDraft = null, marquee = null, hoverPt = null;

  function shapeFromDraft(d) {
    if (d.kind === 'poly') {
      if (d.pts.length < 3) return null;
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const [x, y] of d.pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      return { t: 'shape', kind: 'poly', x: cx, y: cy, w: Math.max(1, x1 - x0), h: Math.max(1, y1 - y0), pts: d.pts.map(([x, y]) => [Math.round((x - cx) * 10) / 10, Math.round((y - cy) * 10) / 10]), s: 1, r: 0, o: 1, fill: d.fill, wall: d.wall, wallW: d.wallW };
    }
    let w = Math.abs(d.x1 - d.x0), h = Math.abs(d.y1 - d.y0);
    if (d.square) { w = h = Math.max(w, h); }
    const cx = d.x0 + Math.sign(d.x1 - d.x0 || 1) * w / 2, cy = d.y0 + Math.sign(d.y1 - d.y0 || 1) * h / 2;
    return { t: 'shape', kind: d.kind, x: cx, y: cy, w, h, s: 1, r: 0, o: 1, fill: d.fill, wall: d.wall, wallW: d.wallW };
  }
  function drawShapeDraft(ctx) {
    const d = shapeDraft;
    if (d.kind === 'poly') {
      const pts = hoverPt ? d.pts.concat([[hoverPt.x, hoverPt.y]]) : d.pts;
      if (pts.length >= 3) { const o = shapeFromDraft({ ...d, pts }); if (o) { o.o = 0.75; drawShape(ctx, o); } }
      ctx.save(); ctx.strokeStyle = '#4fa3e0'; ctx.lineWidth = 1.5 / view.zoom; ctx.setLineDash([6 / view.zoom, 4 / view.zoom]);
      ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke(); ctx.setLineDash([]);
      d.pts.forEach(([x, y], i) => { ctx.fillStyle = i === 0 ? '#e0a640' : '#fff'; ctx.beginPath(); ctx.arc(x, y, (i === 0 ? 7 : 4.5) / view.zoom, 0, 7); ctx.fill(); ctx.stroke(); });
      ctx.restore();
    } else if (d.x1 !== undefined) { const o = shapeFromDraft(d); o.o = 0.8; drawShape(ctx, o); }
  }
  // ---- tool overlays
  function drawDungeonCursor(ctx) {
    const z = dungeonData(false)?.size || (doc.grid.type === 'square' ? doc.grid.size : 70);
    ctx.save(); ctx.lineWidth = 2 / view.zoom;
    if (dgDraft) {
      const x0 = Math.min(dgDraft.a[0], dgDraft.b[0]) * z, y0 = Math.min(dgDraft.a[1], dgDraft.b[1]) * z;
      const w = (Math.abs(dgDraft.a[0] - dgDraft.b[0]) + 1) * z, h = (Math.abs(dgDraft.a[1] - dgDraft.b[1]) + 1) * z;
      ctx.fillStyle = dgDraft.erase ? 'rgba(200,60,40,.25)' : 'rgba(79,163,224,.25)'; ctx.fillRect(x0, y0, w, h);
      ctx.strokeStyle = '#4fa3e0'; ctx.strokeRect(x0, y0, w, h);
      ctx.fillStyle = '#fff'; ctx.font = `${14 / view.zoom}px sans-serif`; ctx.fillText(`${w / z} × ${h / z} squares`, x0 + 6 / view.zoom, y0 - 6 / view.zoom);
    } else if (hoverPt && !dragState) {
      const n = ui.dgMode === 'room' ? 1 : ui.dgBrush || 1, o = Math.floor((n - 1) / 2), c = [Math.floor(hoverPt.x / z), Math.floor(hoverPt.y / z)];
      ctx.strokeStyle = ui.dgMode === 'erase' ? '#e0614f' : '#4fa3e0'; ctx.strokeRect((c[0] - o) * z, (c[1] - o) * z, n * z, n * z);
    }
    ctx.restore();
  }
  function measureLabel(d) {
    const S = doc.scale || { px: 100, units: 10, name: 'miles' };
    const v = (d / S.px) * S.units, nice = v >= 100 ? Math.round(v) : v >= 10 ? Math.round(v * 10) / 10 : Math.round(v * 100) / 100;
    let t = `${nice} ${S.name}`;
    if (doc.grid.type === 'square') t += `  ·  ${Math.round((d / doc.grid.size) * 10) / 10} squares`;
    return t;
  }
  function drawMeasure(ctx) {
    const { a, b } = measure, z = view.zoom, d = Math.hypot(b.x - a.x, b.y - a.y);
    ctx.save(); ctx.lineCap = 'round';
    for (const [col, w] of [['rgba(0,0,0,.6)', 5], ['#ffd84a', 2.2]]) {
      ctx.strokeStyle = col; ctx.lineWidth = w / z; ctx.setLineDash(col === '#ffd84a' ? [10 / z, 6 / z] : []);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      ctx.setLineDash([]); for (const p of [a, b]) { ctx.beginPath(); ctx.arc(p.x, p.y, 5 / z, 0, 7); ctx.stroke(); }
    }
    if (d > 2) {
      const t = measureLabel(d); ctx.font = `600 ${15 / z}px sans-serif`;
      const tw = ctx.measureText(t).width, mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2 - 18 / z;
      ctx.fillStyle = 'rgba(20,16,10,.85)'; ctx.fillRect(mx - tw / 2 - 7 / z, my - 12 / z, tw + 14 / z, 24 / z);
      ctx.fillStyle = '#ffe9a8'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t, mx, my);
    }
    ctx.restore();
    if (!measure.live) status(`Distance: ${measureLabel(d)}`);
  }
  function drawLinkBadges(ctx) {
    if (!layerState('assets').visible) return;
    const z = view.zoom;
    for (const o of doc.objects) {
      if (o.t !== 'asset' || !o.link || o.hidden) continue;
      const { h } = objSize(o), x = o.x, y = o.y - h / 2 - 4 / z;
      ctx.save(); ctx.fillStyle = '#2f6fb0'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5 / z;
      ctx.beginPath(); ctx.arc(x, y, 9 / z, 0, 7); ctx.fill(); ctx.stroke();
      ctx.lineWidth = 1.6 / z; ctx.beginPath(); ctx.ellipse(x - 2.4 / z, y + 1.2 / z, 3.6 / z, 2 / z, -0.6, 0, 7); ctx.ellipse(x + 2.4 / z, y - 1.2 / z, 3.6 / z, 2 / z, -0.6, 0, 7); ctx.stroke();
      ctx.restore();
    }
  }

  // ---- roads that find their own way round water and mountains (A* over the land)
  function landGrid(g) {
    const gw = Math.ceil(doc.width / g), gh = Math.ceil(doc.height / g);
    const t = document.createElement('canvas'); t.width = gw; t.height = gh;
    const x = t.getContext('2d', { willReadFrequently: true }); x.drawImage(landMask, 0, 0, gw, gh);
    const d = x.getImageData(0, 0, gw, gh).data, land = new Uint8Array(gw * gh);
    for (let i = 0; i < land.length; i++) land[i] = d[i * 4 + 3] > 100 ? 1 : 0;
    return { gw, gh, land };
  }
  const ROUGH = /mountain|volcano|peak|real-mountain/, HILLY = /hill|dunes|forest|pine-forest/;
  function routeRoad(a, b, opts = {}) {
    const g = Math.max(6, Math.max(doc.width, doc.height) / 320);
    const { gw, gh, land } = opts.grid || landGrid(g);
    const cost = new Float32Array(gw * gh);
    for (let i = 0; i < cost.length; i++) cost[i] = land[i] ? 1 : Infinity;
    const bump = (cx, cy, r, add) => { const r2 = r / g; for (let yy = Math.max(0, Math.floor(cy / g - r2)); yy <= Math.min(gh - 1, Math.ceil(cy / g + r2)); yy++) for (let xx = Math.max(0, Math.floor(cx / g - r2)); xx <= Math.min(gw - 1, Math.ceil(cx / g + r2)); xx++) { const i = yy * gw + xx; if (isFinite(cost[i]) && Math.hypot(xx - cx / g, yy - cy / g) <= r2) cost[i] += add; } };
    for (const o of doc.objects) {
      if (o.hidden) continue;
      if (o.t === 'asset' && (ROUGH.test(o.a) || HILLY.test(o.a))) { const { w } = objSize(o); bump(o.x, o.y, w * 0.42, ROUGH.test(o.a) ? 14 : 2.5); }
      else if (o.t === 'line' && (o.kind === 'road' || o.kind === 'trail')) for (const [px, py] of o.pts) { const i = Math.floor(py / g) * gw + Math.floor(px / g); if (i >= 0 && i < cost.length && isFinite(cost[i])) cost[i] = Math.min(cost[i], 0.55); }   // join existing roads
    }
    const cl = (p) => [clamp(Math.floor(p[0] / g), 0, gw - 1), clamp(Math.floor(p[1] / g), 0, gh - 1)];
    const s = cl(a), e = cl(b);
    cost[s[1] * gw + s[0]] = Math.min(isFinite(cost[s[1] * gw + s[0]]) ? cost[s[1] * gw + s[0]] : 1, 1);
    const path = MT.astar(cost, gw, gh, s, e);
    if (!path) return null;
    let pts = path.map(([x, y]) => [(x + 0.5) * g, (y + 0.5) * g]); pts[0] = [a[0], a[1]]; pts[pts.length - 1] = [b[0], b[1]];
    pts = simplify(pts, g * 0.7);
    return MT.smoothLine(pts, 3).map(([x, y]) => [Math.round(x * 10) / 10, Math.round(y * 10) / 10]);
  }

  // ---- realms
  function realmCentre(pts, clear = 0) {
    // a point near the middle of the realm's land, kept clear of towns, labels and mountains where possible
    const b = lineBounds({ pts, w: 0 }), step = Math.max(8, Math.max(b.x1 - b.x0, b.y1 - b.y0) / 40), cand = [];
    for (let y = b.y0; y <= b.y1; y += step) for (let x = b.x0; x <= b.x1; x += step) if (pointInPoly(x, y, pts) && landAt(x, y)) cand.push([x, y]);
    if (!cand.length) for (let y = b.y0; y <= b.y1; y += step) for (let x = b.x0; x <= b.x1; x += step) if (pointInPoly(x, y, pts)) cand.push([x, y]);
    if (!cand.length) return [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2];
    const cx = cand.reduce((a, p) => a + p[0], 0) / cand.length, cy = cand.reduce((a, p) => a + p[1], 0) / cand.length;
    if (!clear) return [cx, cy];
    const things = doc.objects.filter((o) => (o.t === 'asset' || o.t === 'text') && !o.hidden);
    let best = null;
    for (const [x, y] of cand) {
      let pen = 0;
      for (const o of things) { const dx = Math.abs(o.x - x), dy = Math.abs(o.y - y); if (o.t === 'text' ? dx < clear * 2.2 && dy < clear * 0.8 : dx < clear * 1.6 && dy < clear * 0.9) pen += o.t === 'text' ? 6 : 1; }
      const sc = Math.hypot(x - cx, y - cy) + pen * clear * 1.5;
      if (!best || sc < best.sc) best = { sc, x, y };
    }
    return [best.x, best.y];
  }
  function finishRealm(o, opts = {}) {
    if (o.pts.length < 3) return null;
    const used = doc.objects.filter(isRealm).length;
    o.color = o.color || REALM_COLS[used % REALM_COLS.length]; o.fill = o.fill ?? 0.3; o.clip = o.clip ?? true;
    o.name = o.name || opts.name || `Realm ${used + 1}`;
    insertObj(o);
    if (opts.label ?? ui.realmLabel) {
      const k = Math.min(doc.width, doc.height) / 1400, [cx, cy] = realmCentre(o.pts, opts.clear || 0);
      const t = addText(cx, cy, { text: o.name, size: Math.round(opts.size || 40 * k), font: 'IM Fell English SC', spacing: 6, upper: false, color: INK[doc.style], halo: true, o: 0.85 });
      t.realmOf = o.id; o.labelId = t.id;
    }
    if (!opts.quiet) { selection.clear(); selection.add(o.id); commit(); refreshPanels(); status('Realm added. Name it and pick its colour in Properties; it only colours the land.'); }
    return o;
  }

  function finishPolygon() {
    const o = shapeFromDraft(shapeDraft); shapeDraft = null;
    if (o) { o.id = uid(); insertObj(o); selection.clear(); selection.add(o.id); commit(); refreshPanels(); }
    needsDraw = true;
  }
  function draw() {
    if (!doc) return;
    if (baseDirty && !baseBusy && !painting) rebuildBase();
    const dpr = window.devicePixelRatio || 1;
    const ctx = sctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, stage.width, stage.height);
    ctx.setTransform(dpr * view.zoom, 0, 0, dpr * view.zoom, dpr * view.ox, dpr * view.oy);
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = 30; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, doc.width, doc.height); ctx.restore();
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, doc.width, doc.height); ctx.clip();
    renderMapContent(ctx, base, { floatLand: true });
    if (leakFlash) ctx.drawImage(leakFlash, 0, 0, doc.width, doc.height);
    if (paintPreview) { ctx.globalAlpha = 0.85; ctx.drawImage(paintPreview, 0, 0, doc.width, doc.height); ctx.globalAlpha = 1; }
    if (lineDraft && lineDraft.pts.length > 1) drawLine(ctx, lineDraft);
    if (shapeDraft) drawShapeDraft(ctx);
    if (tool === 'dungeon') drawDungeonCursor(ctx);
    ctx.restore();
    if (measure) drawMeasure(ctx);
    drawLinkBadges(ctx);
    drawSelection(ctx); drawLandSelection(ctx);
    if (marquee) {
      ctx.save(); ctx.strokeStyle = '#4fa3e0'; ctx.fillStyle = 'rgba(79,163,224,.12)'; ctx.lineWidth = 1 / view.zoom; ctx.setLineDash([5 / view.zoom, 4 / view.zoom]);
      const x = Math.min(marquee.x0, marquee.x1), y = Math.min(marquee.y0, marquee.y1);
      ctx.fillRect(x, y, Math.abs(marquee.x1 - marquee.x0), Math.abs(marquee.y1 - marquee.y0)); ctx.strokeRect(x, y, Math.abs(marquee.x1 - marquee.x0), Math.abs(marquee.y1 - marquee.y0)); ctx.restore();
    }
    if (hoverPt && (isBrush() || tool === 'texture')) {
      ctx.save(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5 / view.zoom; ctx.beginPath(); ctx.arc(hoverPt.x, hoverPt.y, ui.brush / 2, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = '#000'; ctx.setLineDash([4 / view.zoom, 4 / view.zoom]); ctx.stroke(); ctx.restore();
    }
    if (hoverPt && tool === 'stamp' && stampKey && !dragState) {
      const ghost = { t: 'asset', a: stampKey, x: hoverPt.x, y: hoverPt.y, s: ui.stampScale, r: 0, o: 0.55 };
      drawAsset(ctx, ghost);
    }
    { const lf = lookFilter(); stage.style.filter = lf === 'none' ? '' : lf; }
    { const zi = $('#zoomInput'); if (zi && document.activeElement !== zi) zi.value = `${Math.round(view.zoom * 100)}%`; }
    updateScrollbars();
  }
  function loop() { if (needsDraw) { needsDraw = false; draw(); } requestAnimationFrame(loop); }

  // selection outline + handles
  function objCorners(o) {
    const { w, h } = objSize(o); const c = Math.cos(rad(o.r)), s = Math.sin(rad(o.r));
    return [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]].map(([x, y]) => [o.x + x * c - y * s, o.y + x * s + y * c]);
  }
  function lineBounds(o) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of o.pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    const p = o.w; return { x0: x0 - p, y0: y0 - p, x1: x1 + p, y1: y1 + p };
  }
  function handlePositions(o) {
    const cs = objCorners(o); const { h } = objSize(o);
    const c = Math.cos(rad(o.r)), s = Math.sin(rad(o.r)), off = h / 2 + 28 / view.zoom;
    return { corners: cs, rot: [o.x + off * s, o.y - off * c], top: [(cs[0][0] + cs[1][0]) / 2, (cs[0][1] + cs[1][1]) / 2] };
  }
  function drawSelection(ctx) {
    const z = view.zoom;
    for (const id of selection) {
      const o = findObj(id); if (!o) continue;
      ctx.save(); ctx.strokeStyle = '#4fa3e0'; ctx.lineWidth = 1.5 / z;
      if (o.t === 'line') {
        const b = lineBounds(o); ctx.setLineDash([6 / z, 4 / z]); ctx.strokeRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
        ctx.restore(); continue;
      }
      const cs = objCorners(o);
      ctx.beginPath(); cs.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.stroke();
      if (selection.size === 1) {
        const hp = handlePositions(o), hs = 9 / z;
        ctx.beginPath(); ctx.moveTo(hp.top[0], hp.top[1]); ctx.lineTo(hp.rot[0], hp.rot[1]); ctx.stroke();
        ctx.fillStyle = '#fff';
        for (const [x, y] of hp.corners) { ctx.fillRect(x - hs / 2, y - hs / 2, hs, hs); ctx.strokeRect(x - hs / 2, y - hs / 2, hs, hs); }
        ctx.beginPath(); ctx.arc(hp.rot[0], hp.rot[1], hs * 0.65, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
      ctx.restore();
    }
  }

  // ------------------------------------------------------------------ hit testing
  function findObj(id) { return doc.objects.find((o) => o.id === id); }
  function hitObj(o, x, y) {
    if (o.hidden || o.locked) return false;
    if (isRealm(o)) {   // realms are picked by their border (or anywhere inside once selected), so clicks inside still reach other things
      if (selection.has(o.id) && pointInPoly(x, y, o.pts)) return true;
      const tol = (o.w || 6) * 1.5 + 8 / view.zoom;
      for (let i = 0; i < o.pts.length; i++) { const [ax, ay] = o.pts[i], [bx, by] = o.pts[(i + 1) % o.pts.length]; const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy || 1; const t = clamp(((x - ax) * dx + (y - ay) * dy) / L, 0, 1); if (Math.hypot(x - (ax + t * dx), y - (ay + t * dy)) < tol) return true; }
      return false;
    }
    if (o.t === 'line') {
      const tol = o.w / 2 + 6 / view.zoom;
      for (let i = 1; i < o.pts.length; i++) {
        const [ax, ay] = o.pts[i - 1], [bx, by] = o.pts[i];
        const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy || 1;
        const t = clamp(((x - ax) * dx + (y - ay) * dy) / L, 0, 1);
        if (Math.hypot(x - (ax + t * dx), y - (ay + t * dy)) < tol) return true;
      }
      return false;
    }
    const { w, h } = objSize(o);
    const c = Math.cos(-rad(o.r)), s = Math.sin(-rad(o.r));
    const lx = (x - o.x) * c - (y - o.y) * s, ly = (x - o.x) * s + (y - o.y) * c;
    return Math.abs(lx) <= w / 2 && Math.abs(ly) <= h / 2;
  }
  function hitTest(x, y, layer = ui.activeLayer) {
    if (layer !== 'assets' && layer !== 'text') return null;
    if (!layerUsable(layer)) return null;
    for (let i = doc.objects.length - 1; i >= 0; i--) { const o = doc.objects[i]; if (layerOf(o) === layer && hitObj(o, x, y)) return o; }
    return null;
  }
  function hitHandle(x, y) {
    if (selection.size !== 1) return null;
    const o = findObj([...selection][0]); if (!o || o.t === 'line') return null;
    const hp = handlePositions(o), tol = 9 / view.zoom;
    if (Math.hypot(x - hp.rot[0], y - hp.rot[1]) < tol) return { type: 'rotate', o };
    for (const [cx, cy] of hp.corners) if (Math.hypot(x - cx, y - cy) < tol) return { type: 'scale', o };
    return null;
  }

  // ------------------------------------------------------------------ painting masks
  let painting = null;
  function dab(mask, x, y, size, erase, rough, rng) {
    const c = mask.getContext('2d');
    c.globalCompositeOperation = erase ? 'destination-out' : 'source-over';
    c.fillStyle = '#fff';
    const r = (size / 2) * maskScale, mx = x * maskScale, my = y * maskScale;
    c.beginPath();
    if (rough) {
      const n = 18;
      for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2, rr = r * (0.82 + rng() * 0.18); const px = mx + Math.cos(a) * rr, py = my + Math.sin(a) * rr; if (i) c.lineTo(px, py); else c.moveTo(px, py); }
      c.closePath();
    } else c.arc(mx, my, r, 0, Math.PI * 2);
    c.fill();
    c.globalCompositeOperation = 'source-over';
    if (mask === landMask && erase && Object.keys(texMasks).length) texDab(x, y, size, null, true, 0.15, 1, false);
    // preview
    const pc = paintPreview.getContext('2d');
    const L = MT.LOOK[doc.style];
    const target = mask === landMask ? (erase ? L.sea : (doc.type === 'world' ? L.land : L.ground)) : (erase ? (doc.type === 'world' ? L.land : L.ground) : L.path);
    pc.fillStyle = `rgb(${target.join(',')})`;
    pc.beginPath(); pc.arc(mx, my, r, 0, Math.PI * 2); pc.fill();
  }
  function startPaint(pt, kind, erase) {
    paintPreview = document.createElement('canvas'); paintPreview.width = landMask.width; paintPreview.height = landMask.height;
    painting = { mask: kind === 'land' ? landMask : pathMask, erase, last: pt, start: pt, len: 0, minX: pt.x, maxX: pt.x, minY: pt.y, maxY: pt.y, rng: MT.rng(Math.floor(Math.random() * 1e9)) };
    dab(painting.mask, pt.x, pt.y, ui.brush, erase, ui.rough, painting.rng);
  }
  function continuePaint(pt) {
    const p = painting; const d = Math.hypot(pt.x - p.last.x, pt.y - p.last.y); const step = Math.max(2, ui.brush * 0.18);
    for (let t = step; t <= d; t += step) dab(p.mask, p.last.x + ((pt.x - p.last.x) * t) / d, p.last.y + ((pt.y - p.last.y) * t) / d, ui.brush, p.erase, ui.rough, p.rng);
    if (d >= step) { p.len += d; p.last = pt; p.minX = Math.min(p.minX, pt.x); p.maxX = Math.max(p.maxX, pt.x); p.minY = Math.min(p.minY, pt.y); p.maxY = Math.max(p.maxY, pt.y); }
    needsDraw = true;
  }
  function endPaint() {
    const p = painting;
    // Land brush outlines: if the stroke loops round and finishes near where it began, join the ends
    if (p && p.mask === landMask && !p.erase && ui.autoClose) {
      const gap = Math.hypot(p.last.x - p.start.x, p.last.y - p.start.y);
      const span = Math.max(p.maxX - p.minX, p.maxY - p.minY);
      const reach = Math.max(80 / view.zoom, ui.brush * 3, span * 0.3);   // how far apart the ends may be
      if (p.len > ui.brush * 6 && span > ui.brush * 3 && gap > ui.brush * 0.4 && gap <= reach && gap < p.len * 0.35) {
        const n = Math.ceil(gap / Math.max(2, ui.brush * 0.18));
        for (let i = 1; i <= n; i++) dab(landMask, p.last.x + (p.start.x - p.last.x) * i / n, p.last.y + (p.start.y - p.last.y) * i / n, ui.brush, false, ui.rough, p.rng);
        status('Outline closed: the ends of your stroke were joined. Use the Fill bucket to fill it in.');
      }
    }
    painting = null;
    base = MT.renderBase(baseOpts(maskScale)); landVer++; rebuildTexComposite();
    baseDirty = false; paintPreview = null; needsDraw = true;
    commit();
  }

  // ------------------------------------------------------------------ landmass selection (move / resize / rotate land)
  // Land is a painted mask, so a "landmass" is one connected region of it. Selecting one lifts it
  // out of the mask into a floating piece; it is stamped back (transformed) when the selection ends.
  let landSel = null; let settling = false;
  function landAt(x, y) {
    const mx = Math.floor(x * maskScale), my = Math.floor(y * maskScale);
    if (mx < 0 || my < 0 || mx >= landMask.width || my >= landMask.height) return false;
    return landMask.getContext('2d', { willReadFrequently: true }).getImageData(mx, my, 1, 1).data[3] > 127;
  }
  function pickLand(x, y) {
    const mw = landMask.width, mh = landMask.height;
    const lctx = landMask.getContext('2d', { willReadFrequently: true });
    const pctx = pathMask.getContext('2d', { willReadFrequently: true });
    const limg = lctx.getImageData(0, 0, mw, mh), L = limg.data;
    const sx = Math.floor(x * maskScale), sy = Math.floor(y * maskScale);
    if (sx < 0 || sy < 0 || sx >= mw || sy >= mh || L[(sy * mw + sx) * 4 + 3] <= 127) return null;
    // flood fill the connected land
    const seen = new Uint8Array(mw * mh); const stack = new Int32Array(mw * mh); let sp = 0;
    let x0 = sx, x1 = sx, y0 = sy, y1 = sy;
    stack[sp++] = sy * mw + sx; seen[sy * mw + sx] = 1;
    while (sp) {
      const i = stack[--sp], px = i % mw, py = (i / mw) | 0;
      if (px < x0) x0 = px; if (px > x1) x1 = px; if (py < y0) y0 = py; if (py > y1) y1 = py;
      const nb = [px > 0 ? i - 1 : -1, px < mw - 1 ? i + 1 : -1, py > 0 ? i - mw : -1, py < mh - 1 ? i + mw : -1];
      for (const n of nb) if (n >= 0 && !seen[n] && L[n * 4 + 3] > 127) { seen[n] = 1; stack[sp++] = n; }
    }
    // include the soft anti-aliased edge pixels around it
    x0 = Math.max(0, x0 - 1); y0 = Math.max(0, y0 - 1); x1 = Math.min(mw - 1, x1 + 1); y1 = Math.min(mh - 1, y1 + 1);
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
    const inc = new Uint8Array(bw * bh);
    for (let yy = y0; yy <= y1; yy++) for (let xx = x0; xx <= x1; xx++) {
      const i = yy * mw + xx; let on = seen[i];
      if (!on && L[i * 4 + 3] > 0) on = (xx > 0 && seen[i - 1]) || (xx < mw - 1 && seen[i + 1]) || (yy > 0 && seen[i - mw]) || (yy < mh - 1 && seen[i + mw]);
      inc[(yy - y0) * bw + (xx - x0)] = on ? 1 : 0;
    }
    // lift the land (and any ground paint on it) out into floating canvases
    const pimg = pctx.getImageData(0, 0, mw, mh), Pd = pimg.data;
    const comp = document.createElement('canvas'); comp.width = bw; comp.height = bh;
    const pcomp = document.createElement('canvas'); pcomp.width = bw; pcomp.height = bh;
    const ci = comp.getContext('2d').createImageData(bw, bh), pi = pcomp.getContext('2d').createImageData(bw, bh);
    for (let yy = 0; yy < bh; yy++) for (let xx = 0; xx < bw; xx++) {
      const k = yy * bw + xx; if (!inc[k]) continue;
      const i = ((yy + y0) * mw + xx + x0) * 4;
      ci.data[k * 4] = ci.data[k * 4 + 1] = ci.data[k * 4 + 2] = 255; ci.data[k * 4 + 3] = L[i + 3];
      pi.data[k * 4] = pi.data[k * 4 + 1] = pi.data[k * 4 + 2] = 255; pi.data[k * 4 + 3] = Pd[i + 3];
      L[i + 3] = 0; Pd[i + 3] = 0;
    }
    comp.getContext('2d').putImageData(ci, 0, 0); pcomp.getContext('2d').putImageData(pi, 0, 0);
    // preview image: the land as currently rendered (coastline, ripples and all), cut out around it
    if (baseDirty || !base) rebuildBase(true);
    const m = Math.ceil(60 * maskScale);
    const pw = bw + 2 * m, ph = bh + 2 * m;
    const halo = document.createElement('canvas'); halo.width = pw; halo.height = ph;
    const hc = halo.getContext('2d');
    for (let a = 0; a < 16; a++) for (const rr of [m * 0.45, m * 0.9]) hc.drawImage(comp, m + Math.cos(a / 16 * 6.283) * rr, m + Math.sin(a / 16 * 6.283) * rr);
    const prev = document.createElement('canvas'); prev.width = pw; prev.height = ph;
    const pc = prev.getContext('2d');
    pc.drawImage(base, x0 - m, y0 - m, pw, ph, 0, 0, pw, ph);
    if (Object.keys(texMasks).length && texComp) pc.drawImage(texComp, x0 - m, y0 - m, pw, ph, 0, 0, pw, ph);
    pc.globalCompositeOperation = 'destination-in'; pc.filter = `blur(${Math.max(1, m * 0.15)}px)`; pc.drawImage(halo, 0, 0);
    lctx.putImageData(limg, 0, 0); pctx.putImageData(pimg, 0, 0);
    // lift the textures on this land too
    const tex = {}, k = texScale / maskScale;
    for (const [t, tm] of Object.entries(texMasks)) {
      const tw = Math.max(1, Math.round(bw * k)), th = Math.max(1, Math.round(bh * k));
      const tc = document.createElement('canvas'); tc.width = tw; tc.height = th; const tx = tc.getContext('2d');
      tx.drawImage(tm, x0 * k, y0 * k, bw * k, bh * k, 0, 0, tw, th);
      tx.globalCompositeOperation = 'destination-in'; tx.drawImage(comp, 0, 0, tw, th);
      const mc = tm.getContext('2d'); mc.globalCompositeOperation = 'destination-out'; mc.drawImage(comp, x0 * k, y0 * k, bw * k, bh * k); mc.globalCompositeOperation = 'source-over';
      tex[t] = tc;
    }
    // items standing on this land move with it
    const onIt = (px, py) => { const mx = Math.floor(px * maskScale) - x0, my = Math.floor(py * maskScale) - y0; return mx >= 0 && my >= 0 && mx < bw && my < bh && inc[my * bw + mx]; };
    const items = [];
    for (const o of doc.objects) {
      if (o.hidden || o.locked) continue;
      if (o.t === 'line') { const n = o.pts.filter(([px, py]) => onIt(px, py)).length; if (n > o.pts.length / 2) items.push({ o, pts: o.pts.map((q) => q.slice()), w: o.w }); }
      else if (onIt(o.x, o.y)) items.push({ o, x: o.x, y: o.y, s: o.s, r: o.r });
    }
    const ms = maskScale;
    rebuildTexComposite();
    landSel = { comp, pcomp, tex, prev, m, x0, y0, bw, bh, w0: bw / ms, h0: bh / ms, cx: (x0 + bw / 2) / ms, cy: (y0 + bh / 2) / ms, dx: 0, dy: 0, s: 1, r: 0, items, withItems: true, changed: false };
    baseDirty = true; needsDraw = true;
    return landSel;
  }
  function landPoint(px, py) { // apply the current land transform to a map point
    const L = landSel, c = Math.cos(rad(L.r)), s = Math.sin(rad(L.r));
    const x = (px - L.cx) * L.s, y = (py - L.cy) * L.s;
    return [L.cx + L.dx + x * c - y * s, L.cy + L.dy + x * s + y * c];
  }
  function applyLandItems() {
    const L = landSel; if (!L) return;
    for (const it of L.items) {
      const o = it.o;
      if (o.t === 'line') { o.pts = (L.withItems ? it.pts.map(([x, y]) => landPoint(x, y)) : it.pts.map((q) => q.slice())); o.w = L.withItems ? it.w * L.s : it.w; }
      else if (L.withItems) { [o.x, o.y] = landPoint(it.x, it.y); o.s = it.s * L.s; o.r = ((it.r + L.r + 540) % 360) - 180; }
      else { o.x = it.x; o.y = it.y; o.s = it.s; o.r = it.r; }
    }
    L.changed = L.dx !== 0 || L.dy !== 0 || L.s !== 1 || L.r !== 0;
    needsDraw = true;
  }
  function stampLand(mask, src, ms = maskScale) {
    const L = landSel, c = mask.getContext('2d');
    c.save(); c.setTransform(ms, 0, 0, ms, 0, 0);
    c.translate(L.cx + L.dx, L.cy + L.dy); c.rotate(rad(L.r)); c.scale(L.s, L.s);
    c.imageSmoothingEnabled = !(L.s === 1 && L.r === 0);
    c.drawImage(src, -L.w0 / 2, -L.h0 / 2, L.w0, L.h0);
    c.restore();
  }
  // Put the floating land back into the map. remove=true deletes it instead.
  function settleLand(remove = false) {
    if (!landSel || settling) return;
    settling = true;
    const L = landSel; const changed = L.changed || remove;
    if (!remove) {
      if (L.s === 1 && L.r === 0) { // exact pixel restore (no resampling) when only moved or untouched
        const ox = Math.round(L.dx * maskScale), oy = Math.round(L.dy * maskScale);
        landMask.getContext('2d').drawImage(L.comp, L.x0 + ox, L.y0 + oy); pathMask.getContext('2d').drawImage(L.pcomp, L.x0 + ox, L.y0 + oy);
      } else { stampLand(landMask, L.comp); stampLand(pathMask, L.pcomp); }
      for (const [t, tc] of Object.entries(L.tex || {})) stampLand(texMask(t, true), tc, texScale);
    }
    landSel = null;
    base = MT.renderBase(baseOpts(maskScale)); landVer++; rebuildTexComposite();
    baseDirty = false; needsDraw = true;
    if (changed) commit();
    settling = false;
    renderProps();
  }
  function landCorners() {
    const L = landSel; const w = L.w0 / 2, h = L.h0 / 2;
    return [[-w, -h], [w, -h], [w, h], [-w, h]].map(([x, y]) => landPoint(L.cx + x, L.cy + y));
  }
  function landRotHandle() {
    const L = landSel; const c = Math.cos(rad(L.r)), s = Math.sin(rad(L.r)), off = (L.h0 * L.s) / 2 + 28 / view.zoom;
    return [L.cx + L.dx + off * s, L.cy + L.dy - off * c];
  }
  function hitLandHandle(x, y) {
    if (!landSel) return null; const tol = 10 / view.zoom;
    const rh = landRotHandle(); if (Math.hypot(x - rh[0], y - rh[1]) < tol) return 'rotate';
    for (const [cx, cy] of landCorners()) if (Math.hypot(x - cx, y - cy) < tol) return 'scale';
    return null;
  }
  function insideLandBox(x, y) {
    if (!landSel) return false; const L = landSel;
    const c = Math.cos(-rad(L.r)), s = Math.sin(-rad(L.r));
    const lx = (x - L.cx - L.dx) * c - (y - L.cy - L.dy) * s, ly = (x - L.cx - L.dx) * s + (y - L.cy - L.dy) * c;
    return Math.abs(lx) <= (L.w0 * L.s) / 2 && Math.abs(ly) <= (L.h0 * L.s) / 2;
  }
  function drawFloatingLand(ctx) {
    const L = landSel; if (!L) return; const ms = maskScale;
    ctx.save(); ctx.translate(L.cx + L.dx, L.cy + L.dy); ctx.rotate(rad(L.r)); ctx.scale(L.s, L.s);
    ctx.drawImage(L.prev, -L.w0 / 2 - L.m / ms, -L.h0 / 2 - L.m / ms, L.prev.width / ms, L.prev.height / ms);
    ctx.restore();
  }
  function drawLandSelection(ctx) {
    if (!landSel) return; const z = view.zoom, cs = landCorners(), hs = 10 / z, rh = landRotHandle();
    ctx.save(); ctx.strokeStyle = '#e0a640'; ctx.lineWidth = 2 / z; ctx.setLineDash([8 / z, 5 / z]);
    ctx.beginPath(); cs.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.stroke();
    ctx.setLineDash([]);
    const top = [(cs[0][0] + cs[1][0]) / 2, (cs[0][1] + cs[1][1]) / 2];
    ctx.beginPath(); ctx.moveTo(top[0], top[1]); ctx.lineTo(rh[0], rh[1]); ctx.stroke();
    ctx.fillStyle = '#fff';
    for (const [x, y] of cs) { ctx.fillRect(x - hs / 2, y - hs / 2, hs, hs); ctx.strokeRect(x - hs / 2, y - hs / 2, hs, hs); }
    ctx.beginPath(); ctx.arc(rh[0], rh[1], hs * 0.65, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  function setLandScale(v) { if (!landSel) return; landSel.s = clamp(v, 0.05, 10); applyLandItems(); }
  function setLandRot(v) { if (!landSel) return; landSel.r = ((v + 540) % 360) - 180; applyLandItems(); }

  // ------------------------------------------------------------------ fill bucket (land layer)
  // Land mode: click inside an outline to fill that enclosed water with land.
  // Water mode: click a piece of land to turn all of it back into sea.
  function dilateMask(srcCanvas, r) { // grow the white area of a mask by ~r pixels
    const c = document.createElement('canvas'); c.width = srcCanvas.width; c.height = srcCanvas.height;
    const x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(srcCanvas, 0, 0);
    if (r > 0) for (let a = 0; a < 16; a++) for (const k of [0.5, 1]) x.drawImage(srcCanvas, Math.cos(a / 16 * 6.283) * r * k, Math.sin(a / 16 * 6.283) * r * k);
    return c;
  }
  function growSolid(srcCanvas, r) { // smooth, hole-free grow of a mask by ~r pixels (blur + threshold)
    const c = document.createElement('canvas'); c.width = srcCanvas.width; c.height = srcCanvas.height;
    const x = c.getContext('2d', { willReadFrequently: true });
    x.filter = `blur(${Math.max(0.5, r / 2.2)}px)`; x.drawImage(srcCanvas, 0, 0); x.filter = 'none';
    const img = x.getImageData(0, 0, c.width, c.height), d = img.data;
    for (let i = 3; i < d.length; i += 4) { const on = d[i] > 6; d[i - 3] = d[i - 2] = d[i - 1] = 255; d[i] = on ? 255 : 0; }
    x.putImageData(img, 0, 0);
    return c;
  }
  function floodRegion(alpha, mw, mh, sx, sy, inside, insideIdx) { // returns { seen, touchesEdge, count }
    if (insideIdx) { const ok = insideIdx; inside = null; alpha = null; return floodIdx(mw, mh, sx, sy, ok); }
    const seen = new Uint8Array(mw * mh), stack = new Int32Array(mw * mh); let sp = 0, count = 0, edge = false;
    const s0 = sy * mw + sx; if (!inside(alpha[s0 * 4 + 3])) return null;
    seen[s0] = 1; stack[sp++] = s0;
    while (sp) {
      const i = stack[--sp], px = i % mw, py = (i / mw) | 0; count++;
      if (px === 0 || py === 0 || px === mw - 1 || py === mh - 1) edge = true;
      if (px > 0 && !seen[i - 1] && inside(alpha[(i - 1) * 4 + 3])) { seen[i - 1] = 1; stack[sp++] = i - 1; }
      if (px < mw - 1 && !seen[i + 1] && inside(alpha[(i + 1) * 4 + 3])) { seen[i + 1] = 1; stack[sp++] = i + 1; }
      if (py > 0 && !seen[i - mw] && inside(alpha[(i - mw) * 4 + 3])) { seen[i - mw] = 1; stack[sp++] = i - mw; }
      if (py < mh - 1 && !seen[i + mw] && inside(alpha[(i + mw) * 4 + 3])) { seen[i + mw] = 1; stack[sp++] = i + mw; }
    }
    return { seen, touchesEdge: edge, count };
  }
  function fillAt(x, y) {
    const mw = landMask.width, mh = landMask.height;
    const sx = Math.floor(x * maskScale), sy = Math.floor(y * maskScale);
    if (sx < 0 || sy < 0 || sx >= mw || sy >= mh) return;
    const lctx = landMask.getContext('2d', { willReadFrequently: true });
    const limg = lctx.getImageData(0, 0, mw, mh), L = limg.data;
    const onLand = L[(sy * mw + sx) * 4 + 3] > 127;

    if (ui.fillMode === 'water') {
      if (!onLand) { toast('That spot is already water. In "Fill with water" mode, click on land to turn it into sea.', 'warn'); return; }
      const R = floodRegion(L, mw, mh, sx, sy, (a) => a > 0);
      for (let i = 0; i < mw * mh; i++) if (R.seen[i]) L[i * 4 + 3] = 0;
      lctx.putImageData(limg, 0, 0);
      const p = pathMask.getContext('2d', { willReadFrequently: true }), pimg = p.getImageData(0, 0, mw, mh);
      for (let i = 0; i < mw * mh; i++) if (R.seen[i]) pimg.data[i * 4 + 3] = 0;
      p.putImageData(pimg, 0, 0);
      if (Object.keys(texMasks).length) {
        const rc = document.createElement('canvas'); rc.width = mw; rc.height = mh; const rx = rc.getContext('2d'), ri = rx.createImageData(mw, mh);
        for (let i = 0; i < mw * mh; i++) if (R.seen[i]) ri.data[i * 4 + 3] = 255;
        rx.putImageData(ri, 0, 0);
        for (const m of Object.values(texMasks)) { const c = m.getContext('2d'); c.globalCompositeOperation = 'destination-out'; c.drawImage(rc, 0, 0, m.width, m.height); c.globalCompositeOperation = 'source-over'; }
      }
      afterFill('Land turned into sea.'); return;
    }

    if (onLand) { toast('That spot is already land. Click inside your outline, on the water, to fill it.', 'warn'); return; }
    // Distance from every water pixel to the nearest land. A fill with gap tolerance g floods only
    // through water that is more than g pixels from land, which seals any break in an outline up to 2g wide.
    const N0 = mw * mh, isLand = new Uint8Array(N0);
    for (let i = 0; i < N0; i++) isLand[i] = L[i * 4 + 3] > 127 ? 1 : 0;
    const dist = MT.distance(isLand, mw, mh);
    const here = dist[sy * mw + sx];
    const g0 = Math.max(0, (ui.fillGap / view.zoom) * maskScale);          // the slider is in screen pixels
    let R = null, gap = 0;
    for (const g of (g0 > 0 ? [g0, g0 * 2, g0 * 3.5] : [0])) {           // escalate: seals breaks up to ~7x the slider
      const gg = Math.min(g, here - 1.5);                                  // never seal off the spot that was clicked
      if (gg < 0) break;
      const r = floodRegion(null, mw, mh, sx, sy, null, (i) => dist[i] > gg);
      if (r && !r.touchesEdge) { R = r; gap = Math.ceil(gg); break; }
      if (gg < g) { R = r; break; }                                        // can't close any wider here
      R = r;
    }
    if (!R || R.touchesEdge) {
      toast('This outline isn\'t closed, so filling it would flood the open sea (shown in red). Join up the outline with the Land brush, or raise "Close gaps", then try again.', 'warn');
      if (R) flashLeak(R.seen, mw, mh);
      return;
    }
    // grow the region back out through the water, step by step, until it meets the coastline
    // (at most gap+2 pixels, so it fills right up to the shore but can't pour far through a gap)
    const N = mw * mh, fill = R.seen, depth = new Uint8Array(N), q = new Int32Array(N); let qh = 0, qt = 0;
    for (let i = 0; i < N; i++) if (fill[i]) q[qt++] = i;
    const maxD = gap + 2;
    while (qh < qt) {
      const i = q[qh++], d = depth[i]; if (d >= maxD) continue;
      const px = i % mw, py = (i / mw) | 0;
      for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
        if (!ox && !oy) continue; const nx = px + ox, ny = py + oy;
        if (nx < 0 || ny < 0 || nx >= mw || ny >= mh) continue;
        const n = ny * mw + nx; if (fill[n] || L[n * 4 + 3] >= 250) continue;
        fill[n] = 1; depth[n] = d + 1; q[qt++] = n;
      }
    }
    // clean-up: small pockets of water left in sharp corners of the outline (enclosed, touching the new
    // land, and much smaller than a lake) are filled too
    {
      const water = new Uint8Array(N); for (let i = 0; i < N; i++) water[i] = !fill[i] && L[i * 4 + 3] <= 127 ? 1 : 0;
      const outside = new Uint8Array(N); let h = 0, t = 0;
      for (let x = 0; x < mw; x++) for (const y of [0, mh - 1]) { const i = y * mw + x; if (water[i] && !outside[i]) { outside[i] = 1; q[t++] = i; } }
      for (let y = 0; y < mh; y++) for (const x of [0, mw - 1]) { const i = y * mw + x; if (water[i] && !outside[i]) { outside[i] = 1; q[t++] = i; } }
      while (h < t) { const i = q[h++], px = i % mw; for (const n of [px > 0 ? i - 1 : -1, px < mw - 1 ? i + 1 : -1, i - mw, i + mw]) if (n >= 0 && n < N && water[n] && !outside[n]) { outside[n] = 1; q[t++] = n; } }
      const limit = 14 * (gap + 3) * (gap + 3) + 150, done = new Uint8Array(N);
      for (let i0 = 0; i0 < N; i0++) {
        if (!water[i0] || outside[i0] || done[i0]) continue;
        let qh2 = 0, qt2 = 0, touches = false; q[qt2++] = i0; done[i0] = 1;
        while (qh2 < qt2) { const i = q[qh2++], px = i % mw; for (const n of [px > 0 ? i - 1 : -1, px < mw - 1 ? i + 1 : -1, i - mw, i + mw]) { if (n < 0 || n >= N) continue; if (fill[n]) touches = true; if (water[n] && !done[n]) { done[n] = 1; q[qt2++] = n; } } }
        if (touches && qt2 <= limit) for (let k = 0; k < qt2; k++) fill[q[k]] = 1;
      }
    }
    for (let i = 0; i < N; i++) if (fill[i]) { L[i * 4] = L[i * 4 + 1] = L[i * 4 + 2] = 255; L[i * 4 + 3] = 255; }
    lctx.putImageData(limg, 0, 0);
    afterFill(gap > 2 && gap > g0 + 1 ? `Filled with land (closed a gap of about ${Math.round(gap * 2 / maskScale * view.zoom)} screen pixels in your outline).` : 'Filled with land.');
  }
  function floodIdx(mw, mh, sx, sy, ok) {
    const seen = new Uint8Array(mw * mh), stack = new Int32Array(mw * mh); let sp = 0, count = 0, edge = false;
    const s0 = sy * mw + sx; if (!ok(s0)) return null;
    seen[s0] = 1; stack[sp++] = s0;
    while (sp) {
      const i = stack[--sp], px = i % mw, py = (i / mw) | 0; count++;
      if (px === 0 || py === 0 || px === mw - 1 || py === mh - 1) edge = true;
      if (px > 0 && !seen[i - 1] && ok(i - 1)) { seen[i - 1] = 1; stack[sp++] = i - 1; }
      if (px < mw - 1 && !seen[i + 1] && ok(i + 1)) { seen[i + 1] = 1; stack[sp++] = i + 1; }
      if (py > 0 && !seen[i - mw] && ok(i - mw)) { seen[i - mw] = 1; stack[sp++] = i - mw; }
      if (py < mh - 1 && !seen[i + mw] && ok(i + mw)) { seen[i + mw] = 1; stack[sp++] = i + mw; }
    }
    return { seen, touchesEdge: edge, count };
  }
  function afterFill(msg) {
    base = MT.renderBase(baseOpts(maskScale)); landVer++; rebuildTexComposite(); baseDirty = false; needsDraw = true;
    commit(); toast(msg, 'ok');
  }
  let leakFlash = null;
  function flashLeak(seen, mw, mh) { // briefly tint the water the fill would have flooded
    const c = document.createElement('canvas'); c.width = mw; c.height = mh;
    const x = c.getContext('2d'), img = x.createImageData(mw, mh);
    for (let i = 0; i < mw * mh; i++) if (seen[i]) { img.data[i * 4] = 210; img.data[i * 4 + 1] = 70; img.data[i * 4 + 2] = 50; img.data[i * 4 + 3] = 90; }
    x.putImageData(img, 0, 0); leakFlash = c; needsDraw = true;
    setTimeout(() => { leakFlash = null; needsDraw = true; }, 1400);
  }

  // ------------------------------------------------------------------ texture brush (land layer)
  // Each texture keeps its own soft alpha mask (half the land mask's resolution); the visible
  // texture layer is drawn from those masks in the current style, so textures re-colour with the style.
  function texMask(type, create) {
    let m = texMasks[type];
    if (!m && create) { m = texMasks[type] = document.createElement('canvas'); m.width = Math.max(1, Math.round(doc.width * texScale)); m.height = Math.max(1, Math.round(doc.height * texScale)); }
    return m;
  }
  // draw the textures for one map rectangle into `target` (whose pixels are `scale` per map unit)
  function compositeRegion(target, scale, rx, ry, rw, rh) {
    const tc = target.getContext('2d');
    const x0 = Math.max(0, Math.floor(rx * scale)), y0 = Math.max(0, Math.floor(ry * scale));
    const x1 = Math.min(target.width, Math.ceil((rx + rw) * scale)), y1 = Math.min(target.height, Math.ceil((ry + rh) * scale));
    const w = x1 - x0, h = y1 - y0; if (w <= 0 || h <= 0) return;
    tc.clearRect(x0, y0, w, h);
    const tmp = document.createElement('canvas'); tmp.width = w; tmp.height = h; const t = tmp.getContext('2d');
    for (const [type, m] of Object.entries(texMasks)) {
      t.globalCompositeOperation = 'source-over'; t.clearRect(0, 0, w, h);
      const pat = t.createPattern(MT.textureTile(type, doc.style), 'repeat');
      pat.setTransform(new DOMMatrix().translate(-x0, -y0).scale(scale));
      t.fillStyle = pat; t.fillRect(0, 0, w, h);
      t.globalCompositeOperation = 'destination-in';
      const k = texScale / scale;
      t.drawImage(m, x0 * k, y0 * k, w * k, h * k, 0, 0, w, h);
      tc.drawImage(tmp, x0, y0);
    }
  }
  function rebuildTexComposite() {
    if (!texComp) return;
    const tc = texComp.getContext('2d'); tc.clearRect(0, 0, texComp.width, texComp.height);
    if (Object.keys(texMasks).length) compositeRegion(texComp, maskScale, 0, 0, doc.width, doc.height);
  }
  function renderTextures(scale) {           // a fresh texture layer at any resolution (for exports)
    const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(doc.width * scale)); c.height = Math.max(1, Math.round(doc.height * scale));
    if (Object.keys(texMasks).length) compositeRegion(c, scale, 0, 0, doc.width, doc.height);
    return c;
  }
  function texDab(x, y, size, type, erase, soft, strength, onlyLand) {
    const ts = texScale, r = Math.max(1, (size / 2) * ts), d = Math.ceil(r * 2) + 2, ox = x * ts - d / 2, oy = y * ts - d / 2;
    const A = document.createElement('canvas'); A.width = A.height = d; const a = A.getContext('2d');
    const g = a.createRadialGradient(d / 2, d / 2, r * (1 - soft) * 0.98, d / 2, d / 2, r);
    g.addColorStop(0, `rgba(0,0,0,${strength})`); g.addColorStop(1, 'rgba(0,0,0,0)');
    a.fillStyle = g; a.fillRect(0, 0, d, d);
    if (!erase && onlyLand) { const k = maskScale / ts; a.globalCompositeOperation = 'destination-in'; a.drawImage(landMask, ox * k, oy * k, d * k, d * k, 0, 0, d, d); }
    for (const [t, m] of Object.entries(texMasks)) if (erase || t !== type) { const c = m.getContext('2d'); c.globalCompositeOperation = 'destination-out'; c.drawImage(A, ox, oy); c.globalCompositeOperation = 'source-over'; }
    if (!erase) texMask(type, true).getContext('2d').drawImage(A, ox, oy);
    compositeRegion(texComp, maskScale, x - size / 2 - 2, y - size / 2 - 2, size + 4, size + 4);
    needsDraw = true;
  }
  let texPainting = null;
  function startTexPaint(p, erase) {
    texPainting = { last: p, erase };
    texDab(p.x, p.y, ui.brush, ui.texType, erase, ui.texSoft, ui.texStrength, ui.texOnlyLand);
  }
  function continueTexPaint(p) {
    const T = texPainting, d = Math.hypot(p.x - T.last.x, p.y - T.last.y), step = Math.max(2, ui.brush * 0.2);
    for (let t = step; t <= d; t += step) texDab(T.last.x + ((p.x - T.last.x) * t) / d, T.last.y + ((p.y - T.last.y) * t) / d, ui.brush, ui.texType, T.erase, ui.texSoft, ui.texStrength, ui.texOnlyLand);
    if (d >= step) T.last = p;
  }
  function endTexPaint() { texPainting = null; commit(); }

  // ------------------------------------------------------------------ objects: create / edit
  function addAsset(key, x, y, opts = {}) {
    const o = { id: uid(), t: 'asset', a: key, x, y, s: opts.s ?? ui.stampScale, r: opts.r ?? 0, fx: !!opts.fx, o: 1 };
    if (ui.depthSort && (assetInfo(key)?.kind === 'world' || assetInfo(key)?.kind === 'town')) {
      // keep side-view / 3/4 icons layered so lower ones overlap higher ones
      let idx = doc.objects.length;
      for (let i = 0; i < doc.objects.length; i++) {
        const q = doc.objects[i];
        if (q.t === 'asset' && (assetInfo(q.a)?.kind === 'world' || assetInfo(q.a)?.kind === 'town') && q.y > y) { idx = i; break; }
      }
      // never slip beneath decor/text added later than the last terrain icon
      doc.objects.splice(idx, 0, o);
    } else doc.objects.push(o);
    return o;
  }
  function addText(x, y, props = {}) {
    const o = Object.assign({ id: uid(), t: 'text', text: 'New Label', x, y, s: 1, r: 0, o: 1, font: ui.textFont, size: ui.textSize || Math.round(Math.min(doc.width, doc.height) / 30), color: ui.textColor || INK[doc.style], halo: true, bold: ui.textBold, italic: ui.textItalic, upper: false, spacing: 2, curve: 0 }, props);
    doc.objects.push(o); return o;
  }
  function deleteIds(ids) {
    const s = new Set(ids);
    doc.objects = doc.objects.filter((o) => !s.has(o.id));
    for (const id of ids) selection.delete(id);
  }
  function duplicateSelection() {
    const created = [];
    for (const id of selection) {
      const o = findObj(id); if (!o) continue;
      const c = JSON.parse(JSON.stringify(o)); c.id = uid();
      if (c.t === 'line') c.pts = c.pts.map(([x, y]) => [x + 30, y + 30]); else { c.x += 30; c.y += 30; }
      doc.objects.push(c); created.push(c.id);
    }
    selection.clear(); created.forEach((id) => selection.add(id));
    commit(); refreshPanels();
  }
  // ---- clipboard: copy / cut / paste keep size, rotation, flip and opacity exactly
  let clipboard = null, pasteSeq = 0, lastPasteAt = null;
  function objCentre(o) { if (o.t === 'line') { const b = lineBounds(o); return [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2]; } return [o.x, o.y]; }
  function copySelection(cut = false) {
    if (landSel) { status('Copying land isn\'t supported. Select assets or text to copy.'); return; }
    const sel = doc.objects.filter((o) => selection.has(o.id));   // keeps their stacking order
    if (!sel.length) { status('Select something to copy first.'); return; }
    const custom = {};
    for (const o of sel) if (o.t === 'asset' && o.a.startsWith('custom:')) { const k = o.a.slice(7); if (doc.custom[k]) custom[k] = doc.custom[k]; }
    let cx = 0, cy = 0; for (const o of sel) { const [x, y] = objCentre(o); cx += x; cy += y; }
    clipboard = { objs: JSON.parse(JSON.stringify(sel)), custom, cx: cx / sel.length, cy: cy / sel.length };
    pasteSeq = 0; lastPasteAt = null;
    if (cut) { deleteIds(sel.map((o) => o.id)); commit(); refreshPanels(); needsDraw = true; }
    status(`${cut ? 'Cut' : 'Copied'} ${sel.length} item${sel.length === 1 ? '' : 's'}. Press Ctrl+V to paste where your mouse is.`);
    renderProps();
  }
  function pasteClipboard() {
    if (!clipboard) { status('Nothing to paste yet. Select something and press Ctrl+C first.'); return; }
    settleLand();
    const layer = clipboard.objs.some((o) => o.t !== 'text') ? 'assets' : 'text';
    const blocked = layerBlocked(layer); if (blocked) { status(blocked); return; }
    // paste centred on the mouse when it's over the map, otherwise just beside the originals
    let tx, ty;
    const over = hoverPt && hoverPt.x >= 0 && hoverPt.y >= 0 && hoverPt.x <= doc.width && hoverPt.y <= doc.height;
    if (over) {
      const same = lastPasteAt && Math.hypot(hoverPt.x - lastPasteAt[0], hoverPt.y - lastPasteAt[1]) < 1;
      pasteSeq = same ? pasteSeq + 1 : 0; lastPasteAt = [hoverPt.x, hoverPt.y];
      tx = hoverPt.x + pasteSeq * 24; ty = hoverPt.y + pasteSeq * 24;
    } else {
      pasteSeq++; lastPasteAt = null;
      tx = clipboard.cx + pasteSeq * 30; ty = clipboard.cy + pasteSeq * 30;
    }
    const dx = tx - clipboard.cx, dy = ty - clipboard.cy;
    for (const [k, c] of Object.entries(clipboard.custom)) if (!doc.custom[k]) doc.custom[k] = c;
    const ids = [];
    for (const src of clipboard.objs) {
      const o = JSON.parse(JSON.stringify(src)); o.id = uid(); delete o.hidden;
      moveObj(o, dx, dy); insertObj(o); ids.push(o.id);
    }
    if (Object.keys(clipboard.custom).length) buildLibrary();
    setActiveLayer(layer, true);
    selection.clear(); ids.forEach((id) => selection.add(id));
    if (tool !== 'select') setTool('select');
    commit(); refreshPanels(); needsDraw = true;
    status(`Pasted ${ids.length} item${ids.length === 1 ? '' : 's'}.`);
  }
  function moveObj(o, dx, dy) { if (o.t === 'line') o.pts = o.pts.map(([x, y]) => [x + dx, y + dy]); else { o.x += dx; o.y += dy; } }
  function reorder(dir) {
    const ids = [...selection]; if (!ids.length) return;
    const sel = doc.objects.filter((o) => selection.has(o.id)), rest = doc.objects.filter((o) => !selection.has(o.id));
    if (dir === 'front') doc.objects = rest.concat(sel);
    else if (dir === 'back') doc.objects = sel.concat(rest);
    else {
      const arr = doc.objects;
      const order = dir === 'up' ? [...arr.keys()].reverse() : [...arr.keys()];
      for (const i of order) {
        const j = dir === 'up' ? i + 1 : i - 1;
        if (selection.has(arr[i].id) && j >= 0 && j < arr.length && !selection.has(arr[j].id)) [arr[i], arr[j]] = [arr[j], arr[i]];
      }
    }
    commit(); needsDraw = true;
  }

  // ------------------------------------------------------------------ history
  function snapshot() {
    const lc = landMask.getContext('2d', { willReadFrequently: true }), pc = pathMask.getContext('2d', { willReadFrequently: true });
    const land = lc.getImageData(0, 0, landMask.width, landMask.height), path = pathMask.getContext('2d').getImageData(0, 0, pathMask.width, pathMask.height);
    // share identical mask data with the previous state to save memory
    const same = (a, b) => { if (!a || a.data.length !== b.data.length) return false; const x = new Uint32Array(a.data.buffer), y = new Uint32Array(b.data.buffer); for (let i = 0; i < x.length; i += 7) if (x[i] !== y[i]) return false; for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return false; return true; };
    if (!same(lastLandSnap, land)) lastLandSnap = land;
    if (!same(lastPathSnap, path)) lastPathSnap = path;
    void pc;
    const tex = {};
    for (const [t, m] of Object.entries(texMasks)) { const d = m.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, m.width, m.height); tex[t] = same(lastTexSnap[t], d) ? lastTexSnap[t] : d; }
    lastTexSnap = tex;
    const { objects, custom, ...settings } = doc;
    return { json: JSON.stringify({ objects, settings }), custom, land: lastLandSnap, path: lastPathSnap, tex, mw: landMask.width, mh: landMask.height };
  }
  function resetHistory() { history.length = 0; hIndex = -1; lastLandSnap = lastPathSnap = null; lastTexSnap = {}; commit(true); }
  function commit(initial = false) {
    if (landSel && !settling) { const ch = landSel.changed; settleLand(); if (ch) return; /* settling already saved this step */ }
    history.length = hIndex + 1;
    history.push(snapshot()); if (history.length > 60) history.shift();
    hIndex = history.length - 1;
    if (!initial) markDirty();
    scheduleUsedList();
  }
  function restore(st) {
    const prevSize = [doc.width, doc.height], prevStyle = doc.style, prevType = doc.type;
    const { objects, settings } = JSON.parse(st.json);
    const keepLayers = doc.layers;
    Object.assign(doc, settings); doc.objects = objects; doc.custom = st.custom; doc.layers = keepLayers;
    if (landMask.width !== st.mw || landMask.height !== st.mh) { landMask.width = pathMask.width = st.mw; landMask.height = pathMask.height = st.mh; maskScale = st.mw / doc.width; }
    landMask.getContext('2d').putImageData(st.land, 0, 0); pathMask.getContext('2d').putImageData(st.path, 0, 0);
    lastLandSnap = st.land; lastPathSnap = st.path;
    texMasks = {}; texScale = maskScale * 0.5;
    for (const [t, d] of Object.entries(st.tex || {})) { const m = texMask(t, true); if (m.width !== d.width || m.height !== d.height) { m.width = d.width; m.height = d.height; } m.getContext('2d').putImageData(d, 0, 0); }
    lastTexSnap = { ...(st.tex || {}) };
    for (const id of [...selection]) if (!findObj(id)) selection.delete(id);
    baseDirty = true;
    if (prevStyle !== doc.style || prevType !== doc.type) buildLibrary();
    if (prevSize[0] !== doc.width || prevSize[1] !== doc.height) zoomFit();
    syncTopbar(); refreshPanels(); needsDraw = true;
  }
  function undo() { if (landSel) { const ch = landSel.changed; settleLand(); if (ch) { hIndex--; restore(history[hIndex]); markDirty(); return; } } if (hIndex > 0) { hIndex--; restore(history[hIndex]); markDirty(); } }
  function redo() { settleLand(); if (hIndex < history.length - 1) { hIndex++; restore(history[hIndex]); markDirty(); } }
  let dirtyFlag = false;
  function markDirty() { dirtyFlag = true; document.title = `Pocket-Mapp-Creator — ${doc.name}*`; }

  // ------------------------------------------------------------------ view
  // ---- scroll bars
  // The scrollable area is the map plus half a screen of margin on every side, so any part
  // of the map (corners included) can be brought to the middle of the view.
  const SB = 14;
  function scrollInfo(axis) {
    const r = stage.parentElement.getBoundingClientRect();
    const vp = axis === 'x' ? r.width - SB : r.height - SB;            // visible size (px)
    const content = (axis === 'x' ? doc.width : doc.height) * view.zoom; // map size on screen
    const range = content;                                              // scroll distance
    const pos = vp / 2 - (axis === 'x' ? view.ox : view.oy);            // 0 = map's left/top edge in the middle
    return { vp, range, pos, total: content + vp };
  }
  function updateScrollbars() {
    if (!doc) return;
    for (const axis of ['x', 'y']) {
      const bar = axis === 'x' ? $('#hScroll') : $('#vScroll'), th = bar.firstElementChild;
      const I = scrollInfo(axis), track = axis === 'x' ? bar.clientWidth : bar.clientHeight;
      const len = Math.max(28, track * I.vp / I.total);
      const t = I.range > 0 ? clamp(I.pos / I.range, 0, 1) : 0.5;
      const at = (track - len) * t;
      if (axis === 'x') { th.style.width = `${len}px`; th.style.left = `${at}px`; }
      else { th.style.height = `${len}px`; th.style.top = `${at}px`; }
    }
  }
  function setScroll(axis, pos) {
    const I = scrollInfo(axis); pos = clamp(pos, 0, I.range);
    if (axis === 'x') view.ox = I.vp / 2 - pos; else view.oy = I.vp / 2 - pos;
    needsDraw = true;
  }
  for (const axis of ['x', 'y']) {
    const bar = axis === 'x' ? $('#hScroll') : $('#vScroll'), th = bar.firstElementChild;
    const coord = (e) => (axis === 'x' ? e.clientX : e.clientY);
    th.addEventListener('pointerdown', (e) => {
      e.stopPropagation(); e.preventDefault(); th.setPointerCapture(e.pointerId); th.classList.add('drag');
      const I = scrollInfo(axis), track = axis === 'x' ? bar.clientWidth : bar.clientHeight;
      const len = axis === 'x' ? th.offsetWidth : th.offsetHeight;
      const start = coord(e), startPos = clamp(I.pos, 0, I.range), per = I.range / Math.max(1, track - len);
      const move = (ev) => setScroll(axis, startPos + (coord(ev) - start) * per);
      const up = () => { th.classList.remove('drag'); th.removeEventListener('pointermove', move); th.removeEventListener('pointerup', up); th.removeEventListener('pointercancel', up); };
      th.addEventListener('pointermove', move); th.addEventListener('pointerup', up); th.addEventListener('pointercancel', up);
    });
    // click the track to jump a page towards the click
    bar.addEventListener('pointerdown', (e) => {
      if (e.target !== bar) return;
      const r = th.getBoundingClientRect(), I = scrollInfo(axis);
      const before = axis === 'x' ? e.clientX < r.left : e.clientY < r.top;
      setScroll(axis, clamp(I.pos, 0, I.range) + (before ? -1 : 1) * I.vp * 0.8);
    });
    bar.addEventListener('wheel', (e) => { e.preventDefault(); e.stopPropagation(); const I = scrollInfo(axis); setScroll(axis, clamp(I.pos, 0, I.range) + (e.deltaY || e.deltaX)); }, { passive: false });
  }
  // ---- zoom controls: − / + step through these levels; the box takes any %
  const ZOOM_STEPS = [5, 10, 15, 20, 25, 33, 50, 67, 75, 100, 125, 150, 200, 300, 400, 600, 800];
  function setZoom(z) {
    const r = stage.getBoundingClientRect();
    zoomAt(clamp(z, 0.03, 8) / view.zoom, r.width / 2, r.height / 2);
  }
  function zoomStep(dir) {
    const cur = view.zoom * 100;
    const next = dir > 0 ? ZOOM_STEPS.find((v) => v > cur + 0.5) : [...ZOOM_STEPS].reverse().find((v) => v < cur - 0.5);
    setZoom((next ?? (dir > 0 ? 800 : 5)) / 100);
  }
  function zoomFit() {
    const r = stage.parentElement.getBoundingClientRect();
    view.zoom = Math.min((r.width - 80) / doc.width, (r.height - 80) / doc.height);
    view.ox = (r.width - doc.width * view.zoom) / 2; view.oy = (r.height - doc.height * view.zoom) / 2;
    needsDraw = true;
  }
  function zoomAt(f, sx, sy) {
    const nz = clamp(view.zoom * f, 0.03, 8);
    view.ox = sx - ((sx - view.ox) * nz) / view.zoom; view.oy = sy - ((sy - view.oy) * nz) / view.zoom;
    view.zoom = nz; needsDraw = true;
  }
  function toMap(e) { const r = stage.getBoundingClientRect(); return { x: (e.clientX - r.left - view.ox) / view.zoom, y: (e.clientY - r.top - view.oy) / view.zoom, sx: e.clientX - r.left, sy: e.clientY - r.top }; }

  // ------------------------------------------------------------------ pointer interaction
  let dragState = null; let spaceDown = false;
  stage.addEventListener('wheel', (e) => {
    e.preventDefault();
    const p = toMap(e);
    // wheel = zoom · Shift+wheel = scroll sideways · Alt+wheel = scroll up/down · touchpad sideways swipe scrolls
    if (e.altKey) { view.oy -= e.deltaY; needsDraw = true; }
    else if (e.shiftKey && !e.ctrlKey && !e.metaKey) { view.ox -= e.deltaY || e.deltaX; needsDraw = true; }
    else if (!e.ctrlKey && Math.abs(e.deltaX) > Math.abs(e.deltaY)) { view.ox -= e.deltaX; needsDraw = true; }
    else zoomAt(Math.exp(-e.deltaY * 0.0015), p.sx, p.sy);
  }, { passive: false });

  stage.addEventListener('pointerdown', (e) => {
    try { stage.setPointerCapture(e.pointerId); } catch (_) { /* synthetic events */ }
    const p = toMap(e);
    if (e.button === 1 || e.button === 2 && tool !== 'select' || spaceDown || tool === 'pan') { dragState = { type: 'pan', sx: p.sx, sy: p.sy, ox: view.ox, oy: view.oy }; return; }
    if (e.button !== 0) return;
    if (isBrush()) {
      const msg = layerBlocked('land'); if (msg) { status(msg); return; }
      // Land brush adds land, Ocean brush turns land back into sea; Alt swaps them
      const erase = tool === 'ocean' ? !e.altKey : tool === 'land' ? e.altKey : (ui.brushMode === 'erase' || e.altKey);
      startPaint(p, tool === 'path' ? 'path' : 'land', erase); dragState = { type: 'paint' }; return;
    }
    if (tool === 'texture') {
      const msg = layerBlocked('land'); if (msg) { status(msg); return; }
      if (landSel) settleLand();
      startTexPaint(p, ui.texErase || e.altKey); dragState = { type: 'tex' }; return;
    }
    if (tool === 'fill') {
      const msg = layerBlocked('land'); if (msg) { status(msg); return; }
      if (landSel) settleLand();
      fillAt(p.x, p.y); return;
    }
    if (tool === 'measure') { measure = { a: p, b: p, live: true }; dragState = { type: 'measure' }; needsDraw = true; return; }
    if ((tool === 'stamp' || tool === 'line' || tool === 'dungeon') && layerBlocked('assets')) { status(layerBlocked('assets')); return; }
    if (tool === 'dungeon') {
      const c = dgCell(p), erase = ui.dgMode === 'erase' || e.altKey;
      if (ui.dgMode === 'room') { dgDraft = { a: c, b: c, erase: e.altKey }; dragState = { type: 'dgRoom' }; needsDraw = true; return; }
      dgApply(dgBrushKeys(c), erase); dragState = { type: 'dg', erase, last: p }; return;
    }
    if (tool === 'text' && layerBlocked('text')) { status(layerBlocked('text')); return; }
    if (tool === 'stamp') {
      if (!stampKey) { status('Choose an asset from the library first'); return; }
      const o = placeStamp(p.x, p.y);
      dragState = { type: 'stamp', last: p, placed: [o.id] };
      needsDraw = true; return;
    }
    if (tool === 'shape') {
      const q = snapPt(p);
      if (ui.shapeKind === 'poly') {
        if (!shapeDraft) shapeDraft = { kind: 'poly', pts: [], fill: ui.shapeFill, wall: ui.shapeWall, wallW: ui.shapeWallW };
        const first = shapeDraft.pts[0];
        if (first && shapeDraft.pts.length >= 3 && Math.hypot(q.x - first[0], q.y - first[1]) < 12 / view.zoom) { finishPolygon(); return; }
        if (e.detail >= 2 && shapeDraft.pts.length >= 3) { finishPolygon(); return; }   // double-click finishes
        shapeDraft.pts.push([q.x, q.y]); needsDraw = true;
        status('Click to add corners. Click the first (orange) point, double-click or press Enter to finish; Esc cancels.');
        return;
      }
      shapeDraft = { kind: ui.shapeKind, x0: q.x, y0: q.y, fill: ui.shapeFill, wall: ui.shapeWall, wallW: ui.shapeWallW };
      dragState = { type: 'shape' }; return;
    }
    if (tool === 'line') {
      const routed = ui.autoRoute && !['river', 'realm'].includes(ui.lineKind);
      lineDraft = { t: 'line', kind: ui.lineKind, w: ui.lineWidth, o: 1, pts: [[p.x, p.y]] };
      if (routed) lineDraft.pts.push([p.x, p.y]);
      dragState = { type: 'line', routed }; return;
    }
    if (tool === 'text') {
      const hit = hitTest(p.x, p.y);
      if (hit && hit.t === 'text') {
        // click a label to pick it up and drag it to a new location
        selection.clear(); selection.add(hit.id);
        dragState = { type: 'move', last: p, moved: false };
        refreshPanels(); needsDraw = true;
        return;
      }
      const t = addText(p.x, p.y); selection.clear(); selection.add(t.id); commit();
      refreshPanels(); needsDraw = true;
      setTimeout(() => { const ta = $('#toText'); if (ta) { ta.focus(); ta.select(); } }, 30);
      return;
    }
    // select tool
    const lh = hitLandHandle(p.x, p.y);
    if (lh) {
      const L = landSel, cx = L.cx + L.dx, cy = L.cy + L.dy;
      dragState = lh === 'rotate'
        ? { type: 'landRotate', start: Math.atan2(p.y - cy, p.x - cx), r0: L.r }
        : { type: 'landScale', d0: Math.hypot(p.x - cx, p.y - cy), s0: L.s };
      return;
    }
    const h = hitHandle(p.x, p.y);
    if (h) {
      const o = h.o;
      dragState = h.type === 'rotate'
        ? { type: 'rotate', o, start: Math.atan2(p.y - o.y, p.x - o.x), r0: o.r }
        : { type: 'scale', o, d0: Math.hypot(p.x - o.x, p.y - o.y), s0: o.s };
      return;
    }
    if (ui.activeLayer === 'land') {
      // Land layer: click land to select a whole landmass; drag inside the box to move it
      if (landSel && insideLandBox(p.x, p.y)) { dragState = { type: 'landMove', last: p }; return; }
      if (landSel) settleLand();
      const msg = layerBlocked('land');
      if (msg) { status(msg); return; }
      selection.clear();
      if (landAt(p.x, p.y)) { pickLand(p.x, p.y); dragState = { type: 'landMove', last: p }; }
      else status('That is water. Click on land to select a landmass.');
      refreshPanels(); needsDraw = true; return;
    }
    if (landSel) settleLand();
    const blocked = layerBlocked(ui.activeLayer);
    if (blocked) { status(blocked); return; }
    const hit = hitTest(p.x, p.y);
    if (hit) {
      if (e.shiftKey || e.ctrlKey || e.metaKey) { if (selection.has(hit.id)) selection.delete(hit.id); else selection.add(hit.id); }
      else if (!selection.has(hit.id)) { selection.clear(); selection.add(hit.id); }
      if (e.altKey) { duplicateSelectionInPlace(); }
      dragState = { type: 'move', last: p, start: p, moved: false, orig: new Map([...selection].map((id) => { const q = findObj(id); return [id, q.t === 'line' ? null : { x: q.x, y: q.y }]; })) };
    } else {
      if (!e.shiftKey) selection.clear();
      if (layerUsable('land') && landAt(p.x, p.y)) status(`Nothing on the ${ui.activeLayer === 'text' ? 'Text' : 'Assets'} layer here. To select the land, click Land in the Layers panel (or press 1).`);
      marquee = { x0: p.x, y0: p.y, x1: p.x, y1: p.y, add: e.shiftKey };
      dragState = { type: 'marquee' };
    }
    refreshPanels(); needsDraw = true;
  });
  function duplicateSelectionInPlace() {
    const ids = [];
    for (const id of selection) { const o = findObj(id); const c = JSON.parse(JSON.stringify(o)); c.id = uid(); doc.objects.push(c); ids.push(c.id); }
    selection.clear(); ids.forEach((i) => selection.add(i));
  }
  function placeStamp(x, y) {
    if (!ui.scatter) ({ x, y } = snapPt({ x, y }, 'center'));
    const sc = ui.stampScale * (1 + (Math.random() * 2 - 1) * (ui.scatter ? ui.randScale : 0));
    const rr = ui.scatter && ui.randRot ? (Math.random() * 2 - 1) * ui.randRot : 0;
    const fx = ui.scatter && ui.randFlip ? Math.random() < 0.5 : false;
    return addAsset(stampKey, x, y, { s: sc, r: rr, fx });
  }

  stage.addEventListener('pointermove', (e) => {
    const p = toMap(e); hoverPt = p;
    if (isBrush() || tool === 'texture' || tool === 'stamp' || tool === 'dungeon' || (tool === 'shape' && shapeDraft)) needsDraw = true;
    status(`${Math.round(p.x)}, ${Math.round(p.y)}${doc.grid.type === 'square' ? `  ·  square ${Math.floor(p.x / doc.grid.size) + 1}, ${Math.floor(p.y / doc.grid.size) + 1}` : ''}`, true);
    if (!dragState) { updateCursor(p); return; }
    const d = dragState;
    if (d.type === 'pan') { view.ox = d.ox + (p.sx - d.sx); view.oy = d.oy + (p.sy - d.sy); needsDraw = true; }
    else if (d.type === 'paint') continuePaint(p);
    else if (d.type === 'tex') continueTexPaint(p);
    else if (d.type === 'stamp' && ui.scatter) {
      const inf = assetInfo(stampKey); const gap = Math.max(8, Math.max(inf.w, inf.h) * inf.base * ui.stampScale * 0.55 * ui.spacing);
      if (Math.hypot(p.x - d.last.x, p.y - d.last.y) >= gap) {
        const jx = (Math.random() - 0.5) * gap * 0.5, jy = (Math.random() - 0.5) * gap * 0.5;
        d.placed.push(placeStamp(p.x + jx, p.y + jy).id); d.last = p; needsDraw = true;
      }
    } else if (d.type === 'shape' && shapeDraft) {
      const q = snapPt(p); shapeDraft.x1 = q.x; shapeDraft.y1 = q.y; shapeDraft.square = e.shiftKey; needsDraw = true;
    } else if (d.type === 'measure') { measure.b = p; needsDraw = true;
    } else if (d.type === 'dg') {
      const z = dungeonData().size, n = Math.max(1, Math.ceil(Math.hypot(p.x - d.last.x, p.y - d.last.y) / (z / 3))), keys = [];
      for (let i = 1; i <= n; i++) keys.push(...dgBrushKeys(dgCell({ x: d.last.x + (p.x - d.last.x) * i / n, y: d.last.y + (p.y - d.last.y) * i / n })));
      dgApply(keys, d.erase); d.last = p;
    } else if (d.type === 'dgRoom') { dgDraft.b = dgCell(p); needsDraw = true;
    } else if (d.type === 'line' && d.routed) { lineDraft.pts[1] = [p.x, p.y]; needsDraw = true;
    } else if (d.type === 'line') {
      const l = lineDraft.pts[lineDraft.pts.length - 1];
      if (Math.hypot(p.x - l[0], p.y - l[1]) > 4 / view.zoom) { lineDraft.pts.push([p.x, p.y]); needsDraw = true; }
    } else if (d.type === 'move') {
      const dx = p.x - d.last.x, dy = p.y - d.last.y; d.last = p; d.moved = true;
      if (doc.grid.snap && doc.grid.type === 'square' && d.orig) {
        for (const id of selection) {
          const o = findObj(id), O = d.orig.get(id); if (!O || !o) { moveObj(o, dx, dy); continue; }
          const tx = O.x + (p.x - d.start.x), ty = O.y + (p.y - d.start.y);
          if (o.t === 'shape') { const { w, h } = objSize(o); const ww = w - (o.wall === 'none' ? 0 : o.wallW || 0), hh = h - (o.wall === 'none' ? 0 : o.wallW || 0); const q = snapPt({ x: tx - ww / 2, y: ty - hh / 2 }); o.x = q.x + ww / 2; o.y = q.y + hh / 2; }
          else if (o.t === 'asset') { const q = snapPt({ x: tx, y: ty }, 'center'); o.x = q.x; o.y = q.y; }
          else { o.x = tx; o.y = ty; }
        }
      } else for (const id of selection) moveObj(findObj(id), dx, dy);
      needsDraw = true; refreshPropsValues();
    } else if (d.type === 'rotate') {
      let r = d.r0 + ((Math.atan2(p.y - d.o.y, p.x - d.o.x) - d.start) * 180) / Math.PI;
      if (e.shiftKey) r = Math.round(r / 15) * 15;
      d.o.r = ((r + 540) % 360) - 180; needsDraw = true; refreshPropsValues();
    } else if (d.type === 'scale') {
      d.o.s = clamp((d.s0 * Math.hypot(p.x - d.o.x, p.y - d.o.y)) / Math.max(1, d.d0), 0.05, 20); needsDraw = true; refreshPropsValues();
    } else if (d.type === 'marquee') { marquee.x1 = p.x; marquee.y1 = p.y; needsDraw = true; }
    else if (d.type === 'landMove' && landSel) { landSel.dx += p.x - d.last.x; landSel.dy += p.y - d.last.y; d.last = p; applyLandItems(); refreshLandProps(); }
    else if (d.type === 'landScale' && landSel) { const cx = landSel.cx + landSel.dx, cy = landSel.cy + landSel.dy; setLandScale(d.s0 * Math.hypot(p.x - cx, p.y - cy) / Math.max(1, d.d0)); refreshLandProps(); }
    else if (d.type === 'landRotate' && landSel) { const cx = landSel.cx + landSel.dx, cy = landSel.cy + landSel.dy; let r = d.r0 + ((Math.atan2(p.y - cy, p.x - cx) - d.start) * 180) / Math.PI; if (e.shiftKey) r = Math.round(r / 15) * 15; setLandRot(r); refreshLandProps(); }
  });
  function finishPointer() {
    const d = dragState; dragState = null; if (!d) return;
    if (d.type === 'paint') endPaint();
    else if (d.type === 'tex') endTexPaint();
    else if (d.type === 'stamp') { commit(); }
    else if (d.type === 'shape') {
      const o = shapeDraft && shapeDraft.x1 !== undefined ? shapeFromDraft(shapeDraft) : null; shapeDraft = null;
      if (o && o.w > 4 && o.h > 4) { o.id = uid(); insertObj(o); selection.clear(); selection.add(o.id); commit(); refreshPanels(); }
      else status('Drag to draw a room: from one corner to the opposite corner.');
    }
    else if (d.type === 'measure') { measure.live = false; }
    else if (d.type === 'dg') commit();
    else if (d.type === 'dgRoom') { if (dgDraft) { dgApply(dgRectKeys(dgDraft.a, dgDraft.b), dgDraft.erase); dgDraft = null; commit(); } }
    else if (d.type === 'line') {
      const L = lineDraft; lineDraft = null;
      if (d.routed) {
        const [a, b] = L.pts;
        if (Math.hypot(b[0] - a[0], b[1] - a[1]) > 10 / view.zoom) {
          const pts = routeRoad(a, b);
          if (pts) { doc.objects.push({ id: uid(), ...L, pts }); commit(); status('Road routed round the water and mountains. Untick Auto-route to draw roads by hand.'); }
          else { doc.objects.push({ id: uid(), ...L }); commit(); toast('No route over land between those points, so a straight road was drawn.', 'warn'); }
        }
      } else if (L.pts.length > 1) {
        const o = { id: uid(), ...L, pts: simplify(L.pts, 1.5 / view.zoom) };
        if (L.kind === 'realm') finishRealm(o); else { doc.objects.push(o); commit(); }
      }
    } else if (d.type === 'move' && d.moved) commit();
    else if (d.type === 'rotate' || d.type === 'scale') commit();
    else if (d.type === 'marquee') {
      const x0 = Math.min(marquee.x0, marquee.x1), x1 = Math.max(marquee.x0, marquee.x1), y0 = Math.min(marquee.y0, marquee.y1), y1 = Math.max(marquee.y0, marquee.y1);
      if (x1 - x0 > 2 || y1 - y0 > 2) for (const o of doc.objects) {
        if (o.hidden || o.locked) continue;
        let cx, cy; if (o.t === 'line') { const b = lineBounds(o); cx = (b.x0 + b.x1) / 2; cy = (b.y0 + b.y1) / 2; } else { cx = o.x; cy = o.y; }
        if (layerOf(o) === ui.activeLayer && cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1) selection.add(o.id);
      }
      marquee = null;
    }
    refreshPanels(); needsDraw = true;
  }
  stage.addEventListener('pointerup', finishPointer);
  stage.addEventListener('pointercancel', finishPointer);
  stage.addEventListener('pointerleave', () => { hoverPt = null; needsDraw = true; });
  stage.addEventListener('contextmenu', (e) => e.preventDefault());
  stage.addEventListener('dblclick', (e) => {
    const p = toMap(e);
    if (tool === 'select') { const a = hitTest(p.x, p.y, 'assets'); if (a && a.link) { openLinkedMap(a); return; } }
    const hit = hitTest(p.x, p.y, 'text');
    if (hit && hit.t === 'text') { setActiveLayer('text', true); selection.clear(); selection.add(hit.id); refreshPanels(); setTimeout(() => { $('#propText')?.focus(); $('#propText')?.select(); }, 20); }
  });
  function updateCursor(p) {
    let c = 'default';
    if (tool === 'pan' || spaceDown) c = 'grab';
    else if (isBrush() || tool === 'texture') c = 'none';
    else if (tool === 'stamp' || tool === 'line' || tool === 'shape' || tool === 'dungeon' || tool === 'measure') c = 'crosshair';
    else if (tool === 'fill') c = 'cell';
    else if (tool === 'text') c = 'text';
    else { const lh = hitLandHandle(p.x, p.y), h = lh ? null : hitHandle(p.x, p.y); if (lh) c = lh === 'rotate' ? 'alias' : 'nwse-resize'; else if (h) c = h.type === 'rotate' ? 'alias' : 'nwse-resize'; else if (hitTest(p.x, p.y) || (landSel && insideLandBox(p.x, p.y))) { c = 'move'; const hh = hitTest(p.x, p.y); if (hh && hh.link) status(`Double-click to open the linked map “${hh.link.name}”`); } else if (ui.activeLayer === 'land' && landAt(p.x, p.y)) c = 'pointer'; }
    stage.style.cursor = c;
  }
  // Ramer–Douglas–Peucker
  function simplify(pts, tol) {
    if (pts.length < 3) return pts;
    const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
    const stack = [[0, pts.length - 1]];
    while (stack.length) {
      const [a, b] = stack.pop(); let md = 0, mi = -1;
      const [ax, ay] = pts[a], [bx, by] = pts[b], L = Math.hypot(bx - ax, by - ay) || 1;
      for (let i = a + 1; i < b; i++) { const d = Math.abs((bx - ax) * (ay - pts[i][1]) - (ax - pts[i][0]) * (by - ay)) / L; if (d > md) { md = d; mi = i; } }
      if (md > tol) { keep[mi] = 1; stack.push([a, mi], [mi, b]); }
    }
    return pts.filter((_, i) => keep[i]).map(([x, y]) => [Math.round(x * 10) / 10, Math.round(y * 10) / 10]);
  }

  // drag & drop from the library
  const wrap = $('#stageWrap');
  wrap.addEventListener('dragover', (e) => e.preventDefault());
  wrap.addEventListener('drop', (e) => {
    e.preventDefault(); const key = e.dataTransfer.getData('text/mapp-asset'); if (!key) return;
    const p = snapPt(toMap(e), 'center'); const o = addAsset(key, p.x, p.y, { s: ui.stampScale });
    selection.clear(); selection.add(o.id); commit(); refreshPanels(); needsDraw = true;
  });

  // ------------------------------------------------------------------ keyboard
  window.addEventListener('keydown', (e) => {
    const typing = typingNow() || document.activeElement?.tagName === 'SELECT';   // drop-downs use the arrow keys themselves
    if ((e.ctrlKey || e.metaKey) && !typing) {
      const k = e.key.toLowerCase();
      if (k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return; }
      if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); redo(); return; }
      if (k === 'd') { e.preventDefault(); duplicateSelection(); return; }
      if (k === 'a') { e.preventDefault(); selectAll(); return; }
      if (k === 'c') { e.preventDefault(); copySelection(); return; }
      if (k === 'x') { e.preventDefault(); copySelection(true); return; }
      if (k === 'v') { e.preventDefault(); pasteClipboard(); return; }
    }
    if (typing && (e.ctrlKey || e.metaKey) && api && api.isMac) {
      // macOS: clipboard keys in text boxes are normally provided by the app menu
      const k = e.key.toLowerCase(), act = { c: 'copy', x: 'cut', v: 'paste', a: 'selectAll', z: e.shiftKey ? 'redo' : 'undo' }[k];
      if (act) { e.preventDefault(); api.nativeEdit(act); return; }
    }
    if (e.key === 'F1') { e.preventDefault(); openGuide(); return; }
    if (typing) return;
    if (e.key === ' ') { spaceDown = true; stage.style.cursor = 'grab'; e.preventDefault(); return; }
    if ((e.key === 'Delete' || e.key === 'Backspace') && landSel) { settleLand(true); return; }
    if (e.key === 'Escape' && landSel) { settleLand(); return; }
    if ((e.key === '[' || e.key === ']') && landSel) { setLandScale(landSel.s * (e.key === ']' ? 1.1 : 0.9)); refreshLandProps(); return; }
    if ((e.key === 'r' || e.key === 'R') && landSel) { setLandRot(landSel.r + (e.shiftKey ? -15 : 15)); refreshLandProps(); return; }
    if (e.key === 'Delete' || e.key === 'Backspace') { if (selection.size) { deleteIds([...selection]); commit(); refreshPanels(); needsDraw = true; } return; }
    if (e.key === 'Enter' && shapeDraft && shapeDraft.kind === 'poly') { finishPolygon(); return; }
    if (e.key === 'Escape' && shapeDraft) { shapeDraft = null; needsDraw = true; return; }
    if ((e.key === 'Backspace') && shapeDraft && shapeDraft.kind === 'poly' && shapeDraft.pts.length) { shapeDraft.pts.pop(); needsDraw = true; return; }
    if (e.key === 'Escape' && (measure || dgDraft)) { measure = null; dgDraft = null; needsDraw = true; return; }
    if (e.key === 'Escape') { selection.clear(); lineDraft = null; refreshPanels(); needsDraw = true; return; }
    const arrows = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (arrows[e.key] && selection.size) { const m = e.shiftKey ? 10 : 1; for (const id of selection) moveObj(findObj(id), arrows[e.key][0] * m, arrows[e.key][1] * m); commit(); refreshPropsValues(); needsDraw = true; e.preventDefault(); return; }
    if (e.key === '[' || e.key === ']') {
      const dir = e.key === ']' ? 1 : -1;
      if (isBrush() || tool === 'texture') { ui.brush = clamp(ui.brush + dir * 10, 4, 600); renderToolOptions(); needsDraw = true; }
      else if (selection.size) { for (const id of selection) { const o = findObj(id); if (o.t !== 'line') o.s = clamp(o.s * (dir > 0 ? 1.1 : 0.9), 0.05, 20); } commit(); refreshPropsValues(); needsDraw = true; }
      return;
    }
    if ((e.key === 'r' || e.key === 'R') && selection.size) { for (const id of selection) { const o = findObj(id); if (o.t !== 'line') o.r = ((o.r + (e.shiftKey ? -15 : 15) + 540) % 360) - 180; } commit(); refreshPropsValues(); needsDraw = true; return; }
    if ((e.key === 'f' || e.key === 'F') && selection.size) { for (const id of selection) { const o = findObj(id); if (o.t === 'asset') o.fx = !o.fx; } commit(); needsDraw = true; return; }
    if (e.key === '1') { setActiveLayer('land'); return; }
    if (e.key === '2') { setActiveLayer('assets'); return; }
    if (e.key === '3') { setActiveLayer('text'); return; }
    const map = { v: 'select', s: 'stamp', b: 'land', e: 'ocean', g: 'fill', x: 'texture', p: 'path', l: 'line', u: 'shape', d: 'dungeon', m: 'measure', t: 'text', h: 'pan' };
    if (map[e.key.toLowerCase()]) setTool(map[e.key.toLowerCase()]);
  });
  window.addEventListener('keyup', (e) => { if (e.key === ' ') { spaceDown = false; stage.style.cursor = ''; } });
  function selectAll() { settleLand(); selection.clear(); if (ui.activeLayer === 'land' || !layerUsable(ui.activeLayer)) return; doc.objects.forEach((o) => !o.locked && !o.hidden && layerOf(o) === ui.activeLayer && selection.add(o.id)); refreshPanels(); needsDraw = true; }

  // ------------------------------------------------------------------ layers
  // 1 Water (base) · 2 Land · 3 Assets (incl. rivers/roads/lines) · 4 Text
  const LAYERS = [
    { id: 'text', name: 'Text', n: 4 },
    { id: 'assets', name: 'Assets', n: 3, sub: 'mountains, towns, ships, lines' },
    { id: 'land', name: 'Land', n: 2, sub: 'landmasses & ground paint' },
    { id: 'water', name: 'Water', n: 1, sub: 'base layer' }
  ];
  function layerOf(o) { return o.t === 'text' || o.t === 'legend' ? 'text' : 'assets'; }
  function layerState(id) { return (doc.layers && doc.layers[id]) || { visible: true, locked: false }; }
  function layerUsable(id) { const L = layerState(id); return L.visible && !L.locked; }
  function baseOpts(scale) {
    return { landMask, pathMask, mapW: doc.width, mapH: doc.height, scale, style: doc.style, mapType: doc.type, seed: doc.seed, hideLand: !layerState('land').visible, hideWater: !layerState('water').visible, coast: doc.coast };
  }
  function layerBlocked(id) { // returns a message when a layer can't be edited, else ''
    const L = layerState(id), nm = LAYERS.find((x) => x.id === id).name;
    if (!L.visible) return `The ${nm} layer is hidden. Show it in the Layers panel to edit it.`;
    if (L.locked) return `The ${nm} layer is locked. Unlock it in the Layers panel to edit it.`;
    return '';
  }
  function setActiveLayer(id, quiet = false) {
    if (id === 'water' || ui.activeLayer === id) { renderLayers(); return; }
    if (landSel) settleLand();
    ui.activeLayer = id;
    for (const sid of [...selection]) { const o = findObj(sid); if (!o || layerOf(o) !== id) selection.delete(sid); }
    renderLayers(); if (!quiet) refreshPanels(); needsDraw = true;
  }
  const ICON = {
    eye: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>',
    eyeOff: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" opacity=".35"/><path d="M3 3l18 18"/></svg>',
    lock: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>',
    unlock: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" opacity=".45"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.5-2"/></svg>'
  };
  function renderLayers() {
    const el = $('#layers'); if (!el || !doc) return;
    el.innerHTML = LAYERS.map((L) => {
      const st = layerState(L.id), active = ui.activeLayer === L.id;
      const count = L.id === 'text' ? doc.objects.filter((o) => o.t === 'text').length : L.id === 'assets' ? doc.objects.filter((o) => o.t !== 'text').length : null;
      return `<div class="layer-row${active ? ' active' : ''}${st.visible ? '' : ' off'}${L.id === 'water' ? ' base' : ''}" data-layer="${L.id}" title="${L.id === 'water' ? 'Base layer' : 'Click to make this the active layer'}">
        <button class="icon-btn" data-eye="${L.id}" title="${st.visible ? 'Hide' : 'Show'} layer">${st.visible ? ICON.eye : ICON.eyeOff}</button>
        ${L.id === 'water' ? '<span class="icon-sp"></span>' : `<button class="icon-btn" data-lock="${L.id}" title="${st.locked ? 'Unlock' : 'Lock'} layer">${st.locked ? ICON.lock : ICON.unlock}</button>`}
        <span class="ln">${L.n}</span><span class="nm">${L.name}<small>${L.sub ? ' · ' + L.sub : ''}</small></span>
        ${count !== null ? `<span class="badge">${count}</span>` : ''}
      </div>`;
    }).join('');
    el.querySelectorAll('[data-layer]').forEach((r) => r.onclick = () => setActiveLayer(r.dataset.layer));
    el.querySelectorAll('[data-eye]').forEach((b) => b.onclick = (e) => {
      e.stopPropagation(); const id = b.dataset.eye; const st = doc.layers[id]; st.visible = !st.visible;
      if (landSel && (id === 'land' || id === 'water')) settleLand();
      if (!st.visible) for (const sid of [...selection]) { const o = findObj(sid); if (o && layerOf(o) === id) selection.delete(sid); }
      if (id === 'land' || id === 'water') baseDirty = true;
      markDirty(); renderLayers(); refreshPanels(); needsDraw = true;
    });
    el.querySelectorAll('[data-lock]').forEach((b) => b.onclick = (e) => {
      e.stopPropagation(); const id = b.dataset.lock; const st = doc.layers[id]; st.locked = !st.locked;
      if (st.locked) { if (id === 'land' && landSel) settleLand(); for (const sid of [...selection]) { const o = findObj(sid); if (o && layerOf(o) === id) selection.delete(sid); } }
      markDirty(); renderLayers(); refreshPanels(); needsDraw = true;
    });
  }

  // ------------------------------------------------------------------ tools UI
  function isBrush() { return tool === 'land' || tool === 'ocean' || tool === 'path'; }
  function setTool(t) {
    if (t !== 'shape') shapeDraft = null;
    if (t !== 'select') settleLand();
    tool = t;
    if (t !== 'measure') measure = null;
    dgDraft = null;
    const want = { land: 'land', ocean: 'land', path: 'land', fill: 'land', texture: 'land', stamp: 'assets', line: 'assets', shape: 'assets', dungeon: 'assets', text: 'text' }[t];
    if (want && doc) setActiveLayer(want, true);
    $$('.tool').forEach((b) => b.classList.toggle('active', b.dataset.tool === t));
    renderToolOptions(); needsDraw = true;
  }
  $$('.tool').forEach((b) => b.addEventListener('click', () => setTool(b.dataset.tool)));

  function renderToolOptions() {
    const el = $('#toolOptions');
    if (isBrush()) {
      const title = tool === 'land' ? 'Land brush — paint land' : tool === 'ocean' ? 'Ocean brush — turn land into sea' : 'Ground / path brush';
      el.innerHTML = `
        <b>${title}</b>
        ${tool === 'path' ? `<div class="seg"><button data-bm="add" class="${ui.brushMode === 'add' ? 'on' : ''}">Paint</button><button data-bm="erase" class="${ui.brushMode === 'erase' ? 'on' : ''}">Erase</button></div>` : ''}
        <label>Size <input type="range" id="toBrush" min="4" max="600" value="${ui.brush}"> <span id="toBrushV">${ui.brush}</span></label>
        <label class="chk"><input type="checkbox" id="toRough" ${ui.rough ? 'checked' : ''}> Rough edge</label>
        ${tool === 'land' ? `<label class="chk" title="When a stroke finishes near where it started, join the ends so the outline is closed and ready to fill"><input type="checkbox" id="toClose" ${ui.autoClose ? 'checked' : ''}> Auto-close outlines</label>` : ''}
        <span class="muted">${tool === 'land' ? 'Alt = ocean' : tool === 'ocean' ? 'Alt = land' : 'Alt = erase'} · [ ] size</span>`;
      el.querySelectorAll('[data-bm]').forEach((b) => b.onclick = () => { ui.brushMode = b.dataset.bm; renderToolOptions(); });
      $('#toBrush').oninput = (e) => { ui.brush = +e.target.value; $('#toBrushV').textContent = ui.brush; };
      $('#toRough').onchange = (e) => { ui.rough = e.target.checked; };
      if ($('#toClose')) $('#toClose').onchange = (e) => { ui.autoClose = e.target.checked; };
    } else if (tool === 'texture') {
      el.innerHTML = `
        <b>Texture brush</b>
        <select id="toTex">${Object.entries(MT.TEXTURES).map(([k, v]) => `<option value="${k}" ${k === ui.texType ? 'selected' : ''}>${v}</option>`).join('')}</select>
        <div class="seg"><button data-tm="paint" class="${!ui.texErase ? 'on' : ''}">Paint</button><button data-tm="erase" class="${ui.texErase ? 'on' : ''}">Erase</button></div>
        <label>Size <input type="range" id="toBrush" min="4" max="600" value="${ui.brush}"> <span id="toBrushV">${ui.brush}</span></label>
        <label>Soft <input type="range" id="toSoft" min="0" max="1" step="0.05" value="${ui.texSoft}"></label>
        <label>Strength <input type="range" id="toStr" min="0.1" max="1" step="0.05" value="${ui.texStrength}"></label>
        <label class="chk" title="Keep the texture on land only"><input type="checkbox" id="toOnly" ${ui.texOnlyLand ? 'checked' : ''}> Land only</label>`;
      $('#toTex').onchange = (e) => { ui.texType = e.target.value; };
      el.querySelectorAll('[data-tm]').forEach((b) => b.onclick = () => { ui.texErase = b.dataset.tm === 'erase'; renderToolOptions(); });
      $('#toBrush').oninput = (e) => { ui.brush = +e.target.value; $('#toBrushV').textContent = ui.brush; };
      $('#toSoft').oninput = (e) => { ui.texSoft = +e.target.value; };
      $('#toStr').oninput = (e) => { ui.texStrength = +e.target.value; };
      $('#toOnly').onchange = (e) => { ui.texOnlyLand = e.target.checked; };
    } else if (tool === 'fill') {
      el.innerHTML = `
        <b>Fill bucket</b>
        <div class="seg"><button data-fm="land" class="${ui.fillMode === 'land' ? 'on' : ''}">Fill with land</button><button data-fm="water" class="${ui.fillMode === 'water' ? 'on' : ''}">Fill with water</button></div>
        ${ui.fillMode === 'land' ? `<label title="Seals small breaks in a hand-drawn outline (measured in screen pixels) so the fill doesn't leak out to sea">Close gaps <input type="range" id="toGap" min="0" max="60" value="${ui.fillGap}"> <span id="toGapV">${ui.fillGap}</span>px</label>` : ''}
        <span class="muted">${ui.fillMode === 'land' ? 'Click inside an outline' : 'Click a piece of land'}</span>`;
      el.querySelectorAll('[data-fm]').forEach((b) => b.onclick = () => { ui.fillMode = b.dataset.fm; renderToolOptions(); });
      if ($('#toGap')) $('#toGap').oninput = (e) => { ui.fillGap = +e.target.value; $('#toGapV').textContent = ui.fillGap; };
    } else if (tool === 'stamp') {
      const inf = stampKey ? assetInfo(stampKey) : null;
      el.innerHTML = `
        <b>${inf ? esc(inf.name) : 'Pick an asset'}</b>
        <label>Scale <input type="range" id="toScale" min="0.1" max="4" step="0.05" value="${ui.stampScale}"> <span id="toScaleV">${ui.stampScale.toFixed(2)}</span></label>
        <label class="chk"><input type="checkbox" id="toScatter" ${ui.scatter ? 'checked' : ''}> Scatter brush</label>
        ${ui.scatter ? `<label>Spacing <input type="range" id="toSpacing" min="0.3" max="3" step="0.1" value="${ui.spacing}"></label>
        <label>Size ± <input type="range" id="toRandS" min="0" max="0.6" step="0.05" value="${ui.randScale}"></label>
        <label>Rotate ± <input type="range" id="toRandR" min="0" max="180" step="5" value="${ui.randRot}"></label>
        <label class="chk"><input type="checkbox" id="toFlip" ${ui.randFlip ? 'checked' : ''}> Random flip</label>` : ''}
        <label class="chk" title="Lower icons overlap higher ones (best for mountains, forests, buildings)"><input type="checkbox" id="toDepth" ${ui.depthSort ? 'checked' : ''}> Depth sort</label>`;
      $('#toScale').oninput = (e) => { ui.stampScale = +e.target.value; $('#toScaleV').textContent = ui.stampScale.toFixed(2); needsDraw = true; };
      $('#toScatter').onchange = (e) => { ui.scatter = e.target.checked; renderToolOptions(); };
      $('#toDepth').onchange = (e) => { ui.depthSort = e.target.checked; };
      if (ui.scatter) {
        $('#toSpacing').oninput = (e) => { ui.spacing = +e.target.value; };
        $('#toRandS').oninput = (e) => { ui.randScale = +e.target.value; };
        $('#toRandR').oninput = (e) => { ui.randRot = +e.target.value; };
        $('#toFlip').onchange = (e) => { ui.randFlip = e.target.checked; };
      }
    } else if (tool === 'shape') {
      const opt = (obj, cur) => Object.entries(obj).map(([k, v]) => `<option value="${k}" ${k === cur ? 'selected' : ''}>${v}</option>`).join('');
      el.innerHTML = `<b>Shapes</b>
        <div class="seg">${Object.entries({ rect: '▭ Rectangle', ellipse: '◯ Round', poly: '⬠ Polygon' }).map(([k, v]) => `<button data-sk="${k}" class="${ui.shapeKind === k ? 'on' : ''}">${v}</button>`).join('')}</div>
        <label>Floor <select id="toFill">${opt({ ...MT.TEXTURES, none: 'None (walls only)' }, ui.shapeFill)}</select></label>
        <label>Wall <select id="toWall">${opt(WALL_KINDS, ui.shapeWall)}</select></label>
        <label>Width <input type="range" id="toWW" min="2" max="40" value="${ui.shapeWallW}"> <span id="toWWV">${ui.shapeWallW}</span></label>
        <span class="muted">${ui.shapeKind === 'poly' ? 'Click corners; click the first point to finish' : 'Drag corner to corner (Shift = square)'}</span>`;
      el.querySelectorAll('[data-sk]').forEach((b) => b.onclick = () => { ui.shapeKind = b.dataset.sk; shapeDraft = null; renderToolOptions(); });
      $('#toFill').onchange = (e) => { ui.shapeFill = e.target.value; };
      $('#toWall').onchange = (e) => { ui.shapeWall = e.target.value; };
      $('#toWW').oninput = (e) => { ui.shapeWallW = +e.target.value; $('#toWWV').textContent = ui.shapeWallW; };
    } else if (tool === 'line') {
      const k = ui.lineKind, routable = !['river', 'realm'].includes(k);
      el.innerHTML = `<b>Lines</b>
        <select id="toKind">${Object.entries(LINE_KINDS).map(([kk, v]) => `<option value="${kk}" ${kk === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
        <label>Width <input type="range" id="toLW" min="1" max="40" value="${ui.lineWidth}"> <span id="toLWV">${ui.lineWidth}</span></label>
        ${routable ? `<label class="chk" title="Drag from one place to another; the road finds its own way round seas, lakes and mountains"><input type="checkbox" id="toRoute" ${ui.autoRoute ? 'checked' : ''}> Auto-route</label>` : ''}
        ${k === 'realm' ? `<label class="chk"><input type="checkbox" id="toRLabel" ${ui.realmLabel ? 'checked' : ''}> Add name label</label>` : ''}
        <span class="muted">${k === 'river' ? 'Rivers: draw from source to sea' : k === 'realm' ? 'Draw round the realm’s border; it closes itself and only colours land' : ui.autoRoute ? 'Drag from start to finish' : 'Drag to draw'}</span>`;
      $('#toKind').onchange = (e) => { ui.lineKind = e.target.value; renderToolOptions(); };
      $('#toLW').oninput = (e) => { ui.lineWidth = +e.target.value; $('#toLWV').textContent = ui.lineWidth; };
      if ($('#toRoute')) $('#toRoute').onchange = (e) => { ui.autoRoute = e.target.checked; renderToolOptions(); };
      if ($('#toRLabel')) $('#toRLabel').onchange = (e) => { ui.realmLabel = e.target.checked; };
    } else if (tool === 'dungeon') {
      const D = dungeonData(false) || { fill: 'stone', wall: 'stone', wallW: 12 };
      const opt = (obj, cur) => Object.entries(obj).map(([kk, v]) => `<option value="${kk}" ${kk === cur ? 'selected' : ''}>${v}</option>`).join('');
      el.innerHTML = `<b>Dungeon</b>
        <div class="seg"><button data-dm="room" class="${ui.dgMode === 'room' ? 'on' : ''}" title="Drag a rectangle of squares">Carve room</button><button data-dm="cell" class="${ui.dgMode === 'cell' ? 'on' : ''}" title="Drag to carve corridors square by square">Carve squares</button><button data-dm="erase" class="${ui.dgMode === 'erase' ? 'on' : ''}" title="Fill squares back in with rock">Fill in</button></div>
        ${ui.dgMode !== 'room' ? `<label>Brush <select id="toDgB">${[1, 2, 3].map((n) => `<option value="${n}" ${n === ui.dgBrush ? 'selected' : ''}>${n} × ${n}</option>`).join('')}</select></label>` : ''}
        <label>Floor <select id="toDgF">${opt({ ...MT.TEXTURES, none: 'None' }, D.fill)}</select></label>
        <label>Wall <select id="toDgW">${opt(WALL_KINDS, D.wall)}</select></label>
        <label>Width <input type="range" id="toDgWW" min="2" max="40" value="${D.wallW}"></label>
        <button class="mini" id="toDgGen">Random dungeon…</button><button class="mini" id="toDgClear">Clear</button>
        <span class="muted">Alt = fill in</span>`;
      el.querySelectorAll('[data-dm]').forEach((b) => b.onclick = () => { ui.dgMode = b.dataset.dm; renderToolOptions(); });
      if ($('#toDgB')) $('#toDgB').onchange = (e) => { ui.dgBrush = +e.target.value; };
      const setD = (key, v) => { const DD = dungeonData(); DD[key] = v; DD.v = (DD.v || 0) + 1; needsDraw = true; };
      $('#toDgF').onchange = (e) => { setD('fill', e.target.value); commit(); };
      $('#toDgW').onchange = (e) => { setD('wall', e.target.value); commit(); };
      $('#toDgWW').oninput = (e) => setD('wallW', +e.target.value); $('#toDgWW').onchange = () => commit();
      $('#toDgGen').onclick = () => generateDialog('dungeon');
      $('#toDgClear').onclick = async () => { if (doc.dungeon && doc.dungeon.cells.length && await confirmBox('Clear the dungeon floor plan?', 'Every carved square is filled back in. Items and labels stay. You can undo this.')) { doc.dungeon.cells = []; doc.dungeon.v++; commit(); needsDraw = true; } };
    } else if (tool === 'measure') {
      const S = doc.scale;
      el.innerHTML = `<b>Measure</b>
        <label><input type="number" id="toMpx" min="1" value="${S.px}" style="width:64px"> px =</label>
        <label><input type="number" id="toMu" min="0.01" step="any" value="${S.units}" style="width:64px"></label>
        <input type="text" id="toMn" value="${esc(S.name)}" style="width:70px" title="Unit name (miles, km, ft, leagues…)">
        ${doc.grid.type === 'square' ? '<button class="mini" id="toMgrid">1 square = 5 ft</button>' : ''}
        <span class="muted">Drag to measure a distance</span>`;
      const upd = () => { doc.scale = { px: Math.max(1, +$('#toMpx').value || 100), units: Math.max(0.0001, +$('#toMu').value || 1), name: $('#toMn').value.trim() || 'units' }; markDirty(); needsDraw = true; };
      ['#toMpx', '#toMu', '#toMn'].forEach((id) => { $(id).onchange = upd; });
      if ($('#toMgrid')) $('#toMgrid').onclick = () => { doc.scale = { px: doc.grid.size, units: 5, name: 'ft' }; markDirty(); renderToolOptions(); needsDraw = true; };
    } else if (tool === 'text') {
      const sel = selection.size === 1 ? findObj([...selection][0]) : null;
      const t = sel && sel.t === 'text' ? sel : null;
      const font = t ? t.font : ui.textFont;
      const size = t ? Math.round(t.size * t.s) : (ui.textSize || 60);
      const color = t ? t.color : (ui.textColor || INK[doc.style]);
      const bold = t ? t.bold : ui.textBold, italic = t ? t.italic : ui.textItalic;
      el.innerHTML = `
        <b>${t ? 'Edit label' : 'Text'}</b>
        ${t ? `<input type="text" id="toText" value="${esc(t.text)}" style="width:170px">` : ''}
        <select id="toFont">${FONTS.map((f) => `<option ${f === font ? 'selected' : ''}>${f}</option>`).join('')}</select>
        <label>Size <input type="range" id="toTSize" min="8" max="400" value="${size}"><input type="number" id="toTSizeN" min="6" max="600" value="${size}" style="width:62px"></label>
        <input type="color" id="toTColor" value="${color}" title="Colour">
        <label class="chk"><input type="checkbox" id="toTBold" ${bold ? 'checked' : ''}> B</label>
        <label class="chk"><input type="checkbox" id="toTItal" ${italic ? 'checked' : ''}> <i>I</i></label>
        <span class="muted">${t ? 'Drag the label to move it' : 'Pick a font and size, then click the map'}</span>
        <button class="mini" id="toKey" title="A key listing the realms and the places on the map">+ Map key</button>`;
      $('#toKey').onclick = addLegend;
      const apply = (fn, done) => { fn(); if (t) { needsDraw = true; if (done) { commit(); renderProps(); } } };
      const setSize = (v) => { v = clamp(+v || 12, 6, 600); ui.textSize = v; if (t) { t.size = v; t.s = 1; } $('#toTSize').value = v; $('#toTSizeN').value = v; };
      $('#toFont').onchange = (e) => apply(() => { ui.textFont = e.target.value; if (t) t.font = e.target.value; }, true);
      $('#toTSize').oninput = (e) => apply(() => setSize(e.target.value));
      $('#toTSize').onchange = () => apply(() => {}, true);
      $('#toTSizeN').onchange = (e) => apply(() => setSize(e.target.value), true);
      $('#toTColor').oninput = (e) => apply(() => { ui.textColor = e.target.value; if (t) t.color = e.target.value; });
      $('#toTColor').onchange = () => apply(() => {}, true);
      $('#toTBold').onchange = (e) => apply(() => { ui.textBold = e.target.checked; if (t) t.bold = e.target.checked; }, true);
      $('#toTItal').onchange = (e) => apply(() => { ui.textItalic = e.target.checked; if (t) t.italic = e.target.checked; }, true);
      if (t) {
        $('#toText').oninput = (e) => { t.text = e.target.value; needsDraw = true; };
        $('#toText').onchange = () => { commit(); renderProps(); };
        $('#toText').onkeydown = (e) => { if (e.key === 'Enter') e.target.blur(); };
      }
    } else el.innerHTML = '';
  }

  // ------------------------------------------------------------------ library
  function buildLibrary() {
    const grid = $('#assetGrid'); grid.innerHTML = '';
    $$('#genreSeg button').forEach((b) => b.classList.toggle('on', b.dataset.genre === ui.genre));
    $$('#kindSeg button').forEach((b) => b.classList.toggle('on', b.dataset.kind === ui.kind));
    const q = ui.search.trim().toLowerCase();
    const list = MANIFEST.filter((a) => (ui.genre === 'all' || a.genre === ui.genre) && (ui.kind === 'all' || a.kind === ui.kind || (a.kind === 'decor' && ui.kind !== 'decor' && false)) && (!q || a.name.toLowerCase().includes(q) || a.id.includes(q)));
    if (!list.length) grid.innerHTML = '<p class="muted" style="grid-column:1/-1">No assets match. Try another genre or “All”.</p>';
    for (const a of list) grid.appendChild(assetTile(a.id, a.name));
    const cg = $('#customGrid'); cg.innerHTML = '';
    const customs = Object.entries(doc.custom);
    if (!customs.length) cg.innerHTML = '<p class="muted" style="grid-column:1/-1;margin:0">Import your own PNG/SVG assets — they are saved inside the map file.</p>';
    for (const [k, c] of customs) cg.appendChild(assetTile(`custom:${k}`, c.name));
  }
  function assetTile(key, name) {
    const d = document.createElement('div');
    d.className = `asset style-${doc.style}${stampKey === key ? ' on' : ''}`; d.title = name; d.draggable = true;
    d.innerHTML = `<img src="${esc(assetSrc(key))}" alt=""><div class="nm">${esc(name)}</div>`;
    d.onclick = () => { stampKey = key; $$('.asset').forEach((x) => x.classList.remove('on')); d.classList.add('on'); setTool('stamp'); };
    d.ondragstart = (e) => { e.dataTransfer.setData('text/mapp-asset', key); };
    return d;
  }
  $$('#genreSeg button').forEach((b) => b.onclick = () => { ui.genre = b.dataset.genre; buildLibrary(); });
  $$('#kindSeg button').forEach((b) => b.onclick = () => { ui.kind = b.dataset.kind; buildLibrary(); });
  $('#assetSearch').oninput = (e) => { ui.search = e.target.value; buildLibrary(); };

  async function importAssets() {
    let files = [];
    if (api) files = await api.importAssets();
    else files = await browserPickImages();
    for (const f of files) {
      const im = new Image(); im.src = f.dataUrl; await im.decode().catch(() => {});
      const k = uid(); const m = Math.max(im.naturalWidth, im.naturalHeight) || 160; const sc = 160 / m;
      doc.custom[k] = { name: f.name, src: f.dataUrl, w: Math.round((im.naturalWidth || 160) * sc), h: Math.round((im.naturalHeight || 160) * sc) };
    }
    if (files.length) { buildLibrary(); commit(); }
  }

  // ------------------------------------------------------------------ properties panel
  function refreshPanels() { renderProps(); scheduleUsedList(); renderLayers(); if (tool === 'text' && document.activeElement?.id !== 'toText') renderToolOptions(); }
  function propRow(label, html) { return `<div class="row"><label>${label}</label>${html}</div>`; }
  function refreshLandProps() {
    if (!landSel) return; const set = (sel_, v) => { const n = $(sel_); if (n && document.activeElement !== n) n.value = v; };
    set('#lS', Math.round(landSel.s * 100)); set('#lSn', Math.round(landSel.s * 100)); set('#lR', Math.round(landSel.r)); set('#lRn', Math.round(landSel.r));
  }
  function coastVal(key) {
    const L = MT.LOOK[doc.style], C = doc.coast || {}, world = doc.type === 'world';
    const toHex = (a) => '#' + a.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
    if (key === 'rings') return C.rings != null ? C.rings : (world ? L.rings : Math.min(1, L.rings));
    if (key === 'gap') return C.gap != null ? C.gap : L.ringGap;
    if (key === 'width') return C.width != null ? C.width : L.coastW;
    if (key === 'sea') return C.sea || toHex(L.sea);
    if (key === 'land') return C.land || toHex(world ? L.land : L.ground);
  }
  function renderProps() {
    const el = $('#props');
    if (landSel) {
      const L = landSel;
      el.innerHTML = `<div class="row"><b style="flex:1">Landmass</b><span class="muted">${L.items.length} item${L.items.length === 1 ? '' : 's'} on it</span></div>
        <p class="muted" style="margin:0">Drag to move · drag a corner to resize · round handle to rotate</p>
        ${propRow('Size %', `<input type="range" id="lS" min="10" max="400" value="${Math.round(L.s * 100)}"><input type="number" id="lSn" min="5" max="1000" value="${Math.round(L.s * 100)}" style="width:66px">`)}
        ${propRow('Rotation', `<input type="range" id="lR" min="-180" max="180" value="${Math.round(L.r)}"><input type="number" id="lRn" value="${Math.round(L.r)}" style="width:66px">`)}
        <label class="chk"><input type="checkbox" id="lItems" ${L.withItems ? 'checked' : ''}> Move items on this land with it</label>
        <div class="btnrow"><button id="lSmaller">Smaller</button><button id="lBigger">Bigger</button><button id="lReset">Reset</button></div>
        <div class="btnrow"><button class="primary" id="lDone">Done</button><button class="danger" id="lDel">Delete land</button></div>`;
      $('#lS').oninput = (e) => { setLandScale(+e.target.value / 100); refreshLandProps(); };
      $('#lSn').onchange = (e) => { setLandScale((+e.target.value || 100) / 100); refreshLandProps(); };
      $('#lR').oninput = (e) => { setLandRot(+e.target.value); refreshLandProps(); };
      $('#lRn').onchange = (e) => { setLandRot(+e.target.value || 0); refreshLandProps(); };
      $('#lItems').onchange = (e) => { L.withItems = e.target.checked; applyLandItems(); };
      $('#lSmaller').onclick = () => { setLandScale(L.s * 0.9); refreshLandProps(); };
      $('#lBigger').onclick = () => { setLandScale(L.s * 1.1); refreshLandProps(); };
      $('#lReset').onclick = () => { L.s = 1; L.r = 0; L.dx = 0; L.dy = 0; applyLandItems(); refreshLandProps(); };
      $('#lDone').onclick = () => settleLand();
      $('#lDel').onclick = () => settleLand(true);
      return;
    }
    const sel = [...selection].map(findObj).filter(Boolean);
    if (!sel.length) {
      const g = doc.grid;
      el.innerHTML = `
        ${propRow('Name', `<input type="text" id="pName" value="${esc(doc.name)}">`)}
        ${propRow('Type', `<select id="pType">${Object.entries(MAP_TYPES).map(([k, v]) => `<option value="${k}" ${k === doc.type ? 'selected' : ''}>${v.label}</option>`).join('')}</select>`)}
        <div class="row"><label>Size</label><span>${doc.width} × ${doc.height}px</span><button class="mini" data-cmd="resize">Change…</button></div>
        <div class="btnrow"><button class="mini primary" data-cmd="generate" title="Roll a random world, town or dungeon">🎲 Generate random map…</button><button class="mini" id="pKey">Add map key</button></div>
        <div class="btnrow"><button class="mini" id="pAllLand">Fill with land</button><button class="mini" id="pAllSea">Clear all land</button><button class="mini" id="pClearPaths">Clear ground paint</button></div>
        ${clipboard ? `<div class="btnrow"><button class="mini" id="pPasteMap">Paste ${clipboard.objs.length} copied item${clipboard.objs.length === 1 ? '' : 's'}</button></div>` : ''}
        <div class="panel-sub muted">Grid</div>
        ${propRow('Grid', `<select id="pGrid"><option value="none">None</option><option value="square" ${g.type === 'square' ? 'selected' : ''}>Square</option><option value="hex" ${g.type === 'hex' ? 'selected' : ''}>Hex</option></select>`)}
        ${propRow('Cell size', `<input type="number" id="pGridSize" min="10" max="500" value="${g.size}"> px`)}
        ${propRow('Colour', `<input type="color" id="pGridCol" value="${g.color}"><input type="range" id="pGridOp" min="0.05" max="1" step="0.05" value="${g.opacity}">`)}
        <details class="fxbox"><summary>Coastline &amp; colours</summary>
        ${propRow('Ripples', `<input type="range" id="cRings" min="0" max="8" value="${coastVal('rings')}"><span id="cRingsV">${coastVal('rings')}</span>`)}
        ${propRow('Spacing', `<input type="range" id="cGap" min="3" max="24" value="${coastVal('gap')}">`)}
        ${propRow('Coast line', `<input type="range" id="cWidth" min="0" max="7" step="0.1" value="${coastVal('width')}">`)}
        ${propRow('Sea colour', `<input type="color" id="cSea" value="${coastVal('sea')}"><button class="mini" id="cSeaR">Default</button>`)}
        ${propRow('Land colour', `<input type="color" id="cLand" value="${coastVal('land')}"><button class="mini" id="cLandR">Default</button>`)}
        </details>
        <details class="fxbox"><summary>Map look (filters)</summary>
        ${propRow('Brightness', `<input type="range" id="lkBright" min="50" max="150" value="${doc.look.bright}">`)}
        ${propRow('Contrast', `<input type="range" id="lkContrast" min="50" max="150" value="${doc.look.contrast}">`)}
        ${propRow('Saturation', `<input type="range" id="lkSat" min="0" max="200" value="${doc.look.sat}">`)}
        ${propRow('Hue', `<input type="range" id="lkHue" min="-180" max="180" value="${doc.look.hue}">`)}
        ${propRow('Sepia', `<input type="range" id="lkSepia" min="0" max="100" value="${doc.look.sepia}">`)}
        ${propRow('Vignette', `<input type="range" id="lkVig" min="0" max="100" value="${doc.look.vignette}">`)}
        <div class="btnrow"><button class="mini" id="lkReset">Reset look</button></div>
        </details>
        <details class="fxbox" ${doc.light.on ? 'open' : ''}><summary>Lighting</summary>
        <label class="chk"><input type="checkbox" id="ltOn" ${doc.light.on ? 'checked' : ''}> Darkness with light sources</label>
        ${propRow('Darkness', `<input type="range" id="ltDark" min="0.1" max="0.95" step="0.05" value="${doc.light.dark}">`)}
        ${propRow('Night colour', `<input type="color" id="ltCol" value="${doc.light.color}">`)}
        <p class="muted" style="margin:2px 0 0">Campfires, torches, fireplaces, lanterns, street lights and lighthouses glow by themselves. Any item can be made a light in its Effects.</p>
        </details>
        <details class="fxbox"><summary>Layer effects</summary>
        ${['assets', 'text'].map((id) => { const f = layerState(id).fx || {}; return `<div class="panel-sub muted">${id === 'assets' ? 'Assets layer' : 'Text layer'}</div>
          ${propRow('Opacity', `<input type="range" data-lfx="${id}:opacity" min="0.1" max="1" step="0.05" value="${f.opacity ?? 1}">`)}
          <div class="btnrow"><label class="chk"><input type="checkbox" data-lfx="${id}:shadow" ${f.shadow ? 'checked' : ''}> Drop shadow</label><label class="chk"><input type="checkbox" data-lfx="${id}:glow" ${f.glow ? 'checked' : ''}> Glow</label><input type="color" data-lfx="${id}:glowColor" value="${f.glowColor || '#ffd84a'}"></div>`; }).join('')}
        </details>
        <p class="muted">Suggested order: paint land with the <b>Land</b> and <b>Ocean</b> brushes, add mountains, forests and towns, then finish with <b>Text</b>. Labels always sit on top of everything else.<br>To resize land: make <b>Land</b> the active layer, choose <b>Select</b>, click the land and drag its corners.</p>`;
      $('#pName').onchange = (e) => { doc.name = e.target.value || 'Untitled Map'; commit(); };
      $('#pType').onchange = (e) => { doc.type = e.target.value; ui.kind = MAP_TYPES[doc.type].kind; baseDirty = true; buildLibrary(); commit(); needsDraw = true; };
      $('#pAllLand').onclick = () => { fillMask(landMask, true); baseDirty = true; commit(); needsDraw = true; };
      $('#pAllSea').onclick = () => { fillMask(landMask, false); baseDirty = true; commit(); needsDraw = true; };
      $('#pPasteMap') && ($('#pPasteMap').onclick = pasteClipboard);
      $('#pClearPaths').onclick = () => { fillMask(pathMask, false); baseDirty = true; commit(); needsDraw = true; };
      $('#pGrid').onchange = (e) => { doc.grid.type = e.target.value; $('#gridToggle').checked = doc.grid.type !== 'none'; commit(); needsDraw = true; };
      $('#pGridSize').onchange = (e) => { doc.grid.size = clamp(+e.target.value || 70, 10, 500); commit(); needsDraw = true; };
      $('#pGridCol').oninput = (e) => { doc.grid.color = e.target.value; needsDraw = true; };
      $('#pGridCol').onchange = () => commit();
      $('#pGridOp').oninput = (e) => { doc.grid.opacity = +e.target.value; needsDraw = true; };
      $('#pGridOp').onchange = () => commit();
      // coastline & colours
      let coastT;
      const coastSet = (key, val) => { doc.coast[key] = val; clearTimeout(coastT); coastT = setTimeout(() => { baseDirty = true; needsDraw = true; }, 120); };
      $('#cRings').oninput = (e) => { coastSet('rings', +e.target.value); $('#cRingsV').textContent = e.target.value; };
      $('#cGap').oninput = (e) => coastSet('gap', +e.target.value);
      $('#cWidth').oninput = (e) => coastSet('width', +e.target.value);
      $('#cSea').oninput = (e) => coastSet('sea', e.target.value);
      $('#cLand').oninput = (e) => coastSet('land', e.target.value);
      for (const id of ['#cRings', '#cGap', '#cWidth', '#cSea', '#cLand']) $(id).onchange = () => commit();
      $('#cSeaR').onclick = () => { doc.coast.sea = null; baseDirty = true; commit(); renderProps(); };
      $('#cLandR').onclick = () => { doc.coast.land = null; baseDirty = true; commit(); renderProps(); };
      // map look
      const lk = (id, key) => { $(id).oninput = (e) => { doc.look[key] = +e.target.value; needsDraw = true; }; $(id).onchange = () => commit(); };
      lk('#lkBright', 'bright'); lk('#lkContrast', 'contrast'); lk('#lkSat', 'sat'); lk('#lkHue', 'hue'); lk('#lkSepia', 'sepia'); lk('#lkVig', 'vignette');
      $('#pKey').onclick = addLegend;
      $('#ltOn').onchange = (e) => { doc.light.on = e.target.checked; commit(); needsDraw = true; };
      $('#ltDark').oninput = (e) => { doc.light.dark = +e.target.value; needsDraw = true; }; $('#ltDark').onchange = () => commit();
      $('#ltCol').oninput = (e) => { doc.light.color = e.target.value; needsDraw = true; }; $('#ltCol').onchange = () => commit();
      el.querySelectorAll('[data-lfx]').forEach((n) => {
        const [id, key] = n.dataset.lfx.split(':');
        n.oninput = () => { const L = doc.layers[id]; L.fx = L.fx || {}; L.fx[key] = n.type === 'checkbox' ? n.checked : n.type === 'range' ? +n.value : n.value; needsDraw = true; };
        n.onchange = () => { n.oninput(); markDirty(); };
      });
      $('#lkReset').onclick = () => { doc.look = { bright: 100, contrast: 100, sat: 100, hue: 0, sepia: 0, vignette: 0 }; commit(); renderProps(); needsDraw = true; };
      bindCmdButtons(el);
      return;
    }
    if (sel.length > 1) {
      el.innerHTML = `<p><b>${sel.length}</b> objects selected</p>
        <div class="btnrow"><button id="mScaleDn">Smaller</button><button id="mScaleUp">Larger</button><button id="mFlip">Flip</button><button id="mRandRot">Random tilt</button></div>
        <div class="btnrow"><button id="mFront">To front</button><button id="mBack">To back</button><button id="mDup">Duplicate</button><button class="danger" id="mDel">Delete ${sel.length}</button></div>
        <div class="btnrow"><button id="mCopy">Copy</button><button id="mCut">Cut</button><button id="mPaste" ${clipboard ? '' : 'disabled'}>Paste</button></div>
        <div class="btnrow"><button id="mShadow">Add drop shadow</button><button id="mNoFx">Remove effects</button></div>`;
      const each = (fn) => { sel.forEach(fn); commit(); needsDraw = true; };
      $('#mScaleDn').onclick = () => each((o) => { if (o.t !== 'line') o.s = clamp(o.s * 0.9, 0.05, 20); });
      $('#mScaleUp').onclick = () => each((o) => { if (o.t !== 'line') o.s = clamp(o.s * 1.1, 0.05, 20); });
      $('#mFlip').onclick = () => each((o) => { if (o.t === 'asset') o.fx = !o.fx; });
      $('#mRandRot').onclick = () => each((o) => { if (o.t !== 'line') o.r = Math.round((Math.random() * 2 - 1) * 12); });
      $('#mFront').onclick = () => reorder('front'); $('#mBack').onclick = () => reorder('back');
      $('#mDup').onclick = duplicateSelection;
      $('#mShadow').onclick = () => each((o) => { if (o.t !== 'line') { o.ef = o.ef || {}; o.ef.shadow = true; } });
      $('#mNoFx').onclick = () => each((o) => { delete o.ef; });
      $('#mCopy').onclick = () => copySelection(); $('#mCut').onclick = () => copySelection(true); $('#mPaste').onclick = pasteClipboard;
      $('#mDel').onclick = () => { deleteIds(sel.map((o) => o.id)); commit(); refreshPanels(); needsDraw = true; };
      return;
    }
    const o = sel[0];
    let h = '';
    if (o.t === 'asset') {
      const inf = assetInfo(o.a) || { name: '?' };
      h += `<div class="row"><b style="flex:1">${esc(inf.name)}</b><button class="mini" id="pSelSame">Select all like this</button></div>`;
    }
    if (o.t === 'text') {
      h += `<textarea id="propText" rows="2">${esc(o.text)}</textarea>`;
      h += propRow('Font', `<select id="pFont">${FONTS.map((f) => `<option ${f === o.font ? 'selected' : ''} style="font-family:'${f}'">${f}</option>`).join('')}</select>`);
      h += propRow('Size', `<input type="number" id="pSize" min="6" max="600" value="${o.size}"><input type="color" id="pColor" value="${o.color}">`);
      h += `<div class="btnrow"><label class="chk"><input type="checkbox" id="pBold" ${o.bold ? 'checked' : ''}> Bold</label><label class="chk"><input type="checkbox" id="pItal" ${o.italic ? 'checked' : ''}> Italic</label><label class="chk"><input type="checkbox" id="pUpper" ${o.upper ? 'checked' : ''}> CAPS</label><label class="chk"><input type="checkbox" id="pHalo" ${o.halo ? 'checked' : ''}> Halo</label></div>`;
      h += propRow('Spacing', `<input type="range" id="pSpacing" min="-2" max="40" value="${o.spacing}">`);
      h += propRow('Curve', `<input type="range" id="pCurve" min="-100" max="100" value="${o.curve}">`);
    }
    if (o.t === 'legend') {
      h += `<div class="row"><b style="flex:1">Map key</b></div>`;
      h += propRow('Title', `<input type="text" id="pKTitle" value="${esc(o.title || 'Key')}">`);
      h += propRow('Font', `<select id="pFont">${FONTS.map((f) => `<option ${f === (o.font || 'IM Fell English') ? 'selected' : ''}>${f}</option>`).join('')}</select>`);
      h += `<div class="btnrow"><label class="chk"><input type="checkbox" id="pKRealms" ${o.realms !== false ? 'checked' : ''}> Realms</label><label class="chk" title="Every label with its grid square (turn the grid on for square references)"><input type="checkbox" id="pKPlaces" ${o.places ? 'checked' : ''}> Index of places</label></div>`;
    }
    if (o.t === 'asset') {
      const lt = lightOf(o);
      h += `<details class="fxbox" ${o.link ? 'open' : ''}><summary>Linked map</summary>
        <p class="muted" style="margin:0 0 4px">${o.link ? `Opens <b>${esc(o.link.name)}</b> when you double-click this item.` : 'Link this item to another map, e.g. a town to its town map. Double-click the item to open it.'}</p>
        <div class="btnrow"><button class="mini" id="pLink">${o.link ? 'Change…' : 'Choose map…'}</button>${o.link ? '<button class="mini" id="pLinkGo">Open</button><button class="mini" id="pUnlink">Remove link</button>' : ''}</div></details>`;
      h += `<details class="fxbox" ${o.light ? 'open' : ''}><summary>Light</summary>
        <label class="chk"><input type="checkbox" id="pLt" ${lt ? 'checked' : ''}> Gives off light${doc.light.on ? '' : ' <span class="muted">(turn Lighting on in the map settings)</span>'}</label>
        ${propRow('Radius', `<input type="range" id="pLtR" min="40" max="1200" step="10" value="${Math.round(lt ? lt.r : 250)}">`)}
        ${propRow('Colour', `<input type="color" id="pLtC" value="${lt ? lt.color : '#ffd27a'}">`)}</details>`;
    }
    if (o.t === 'shape') {
      const opt = (obj, cur) => Object.entries(obj).map(([k, v]) => `<option value="${k}" ${k === cur ? 'selected' : ''}>${v}</option>`).join('');
      h += `<div class="row"><b style="flex:1">${SHAPE_KINDS[o.kind] || 'Shape'}</b></div>`;
      h += propRow('Floor', `<select id="pSFill">${opt({ ...MT.TEXTURES, none: 'None (walls only)' }, o.fill)}</select>`);
      h += propRow('Wall', `<select id="pSWall">${opt(WALL_KINDS, o.wall)}</select>`);
      h += propRow('Wall width', `<input type="range" id="pSWW" min="2" max="40" value="${o.wallW}">`);
    }
    if (isRealm(o)) {
      h += `<div class="row"><b style="flex:1">Realm</b></div>`;
      h += propRow('Name', `<input type="text" id="pRName" value="${esc(o.name || '')}">`);
      h += propRow('Colour', `<input type="color" id="pRCol" value="${o.color || REALM_COLS[0]}"><input type="range" id="pRFill" min="0.05" max="0.8" step="0.05" value="${o.fill ?? 0.3}" title="Colour strength">`);
      h += propRow('Border', `<input type="range" id="pLW" min="1" max="40" value="${o.w}">`);
      h += `<label class="chk"><input type="checkbox" id="pRClip" ${o.clip !== false ? 'checked' : ''}> Only colour the land</label>`;
    } else if (o.t === 'line') {
      h += propRow('Kind', `<select id="pLKind">${Object.entries(LINE_KINDS).filter(([k]) => k !== 'realm').map(([k, v]) => `<option value="${k}" ${k === o.kind ? 'selected' : ''}>${v}</option>`).join('')}</select>`);
      h += propRow('Width', `<input type="range" id="pLW" min="1" max="40" value="${o.w}">`);
    } else {
      h += propRow('X / Y', `<input type="number" id="pX" value="${Math.round(o.x)}"><input type="number" id="pY" value="${Math.round(o.y)}">`);
      h += propRow('Scale', `<input type="range" id="pS" min="0.05" max="6" step="0.01" value="${o.s}"><input type="number" id="pSn" step="0.05" value="${o.s.toFixed(2)}" style="width:62px">`);
      h += propRow('Rotation', `<input type="range" id="pR" min="-180" max="180" value="${Math.round(o.r)}"><input type="number" id="pRn" value="${Math.round(o.r)}" style="width:62px">`);
    }
    h += propRow('Opacity', `<input type="range" id="pO" min="0.05" max="1" step="0.05" value="${o.o ?? 1}">`);
    if (o.t !== 'line') {
      const e = o.ef || {};
      h += `<details class="fxbox" ${o.ef ? 'open' : ''}><summary>Effects</summary>
        <div class="btnrow"><label class="chk"><input type="checkbox" id="fxShadow" ${e.shadow ? 'checked' : ''}> Drop shadow</label>
        <label class="chk"><input type="checkbox" id="fxGlow" ${e.glow ? 'checked' : ''}> Glow</label><input type="color" id="fxGlowCol" value="${e.glowColor || '#ffd84a'}" title="Glow colour"></div>
        ${o.t !== 'text' ? `${propRow('Hue', `<input type="range" id="fxHue" min="-180" max="180" value="${e.hue || 0}">`)}
        ${propRow('Brightness', `<input type="range" id="fxBright" min="40" max="160" value="${e.bright ?? 100}">`)}
        ${propRow('Saturation', `<input type="range" id="fxSat" min="0" max="200" value="${e.sat ?? 100}">`)}
        ${propRow('Tint', `<input type="color" id="fxTint" value="${e.tint || '#c4553f'}"><input type="range" id="fxTintAmt" min="0" max="0.9" step="0.05" value="${e.tintAmt || 0}">`)}` : ''}
        <div class="btnrow"><button class="mini" id="fxReset">Reset effects</button></div></details>`;
    }
    h += `<div class="btnrow">${o.t === 'asset' ? '<button id="pFlip">Flip ⇋</button>' : ''}<button id="pFront">Front</button><button id="pUp">▲</button><button id="pDown">▼</button><button id="pBack">Back</button></div>`;
    h += `<div class="btnrow"><button id="pCopy" title="Ctrl+C">Copy</button><button id="pCut" title="Ctrl+X">Cut</button><button id="pPaste" title="Ctrl+V" ${clipboard ? '' : 'disabled'}>Paste</button></div>`;
    h += `<div class="btnrow"><button id="pDup">Duplicate</button><button class="danger" id="pDel">Delete</button></div>`;
    el.innerHTML = h;

    const live = (sel_, prop, conv = (v) => v, after) => {
      const n = $(sel_); if (!n) return;
      n.oninput = (e) => { o[prop] = conv(e.target.type === 'checkbox' ? e.target.checked : e.target.value); after && after(); needsDraw = true; };
      n.onchange = () => { commit(); };
    };
    live('#propText', 'text'); live('#pFont', 'font'); live('#pSize', 'size', (v) => clamp(+v || 12, 6, 600)); live('#pColor', 'color');
    live('#pBold', 'bold'); live('#pItal', 'italic'); live('#pUpper', 'upper'); live('#pHalo', 'halo');
    live('#pSpacing', 'spacing', Number); live('#pCurve', 'curve', Number);
    live('#pLKind', 'kind'); live('#pLW', 'w', Number);
    live('#pRCol', 'color'); live('#pRFill', 'fill', Number); live('#pRClip', 'clip');
    if ($('#pRName')) { $('#pRName').oninput = (e) => { o.name = e.target.value; const t = o.labelId && findObj(o.labelId); if (t) t.text = e.target.value; needsDraw = true; }; $('#pRName').onchange = () => commit(); }
    live('#pKTitle', 'title');
    for (const [id, key] of [['#pKRealms', 'realms'], ['#pKPlaces', 'places']]) if ($(id)) $(id).onchange = (e) => {
      // keep the key's edge nearest the map's edge where it is as the list grows or shrinks
      const h0 = objSize(o).h; o[key] = e.target.checked; const h1 = objSize(o).h;
      o.y += (o.y > doc.height / 2 ? -1 : 1) * (h1 - h0) / 2; commit(); needsDraw = true; refreshPropsValues();
    };
    if ($('#pLink')) {
      $('#pLink').onclick = async () => { if (!api) { toast('Linking maps needs the desktop app.', 'warn'); return; } const r = await api.pickMap(filePath); if (r) { o.link = r; commit(); renderProps(); needsDraw = true; } };
      $('#pLinkGo') && ($('#pLinkGo').onclick = () => openLinkedMap(o));
      $('#pUnlink') && ($('#pUnlink').onclick = () => { delete o.link; commit(); renderProps(); needsDraw = true; });
      const setLt = () => { if ($('#pLt').checked) o.light = { r: +$('#pLtR').value, color: $('#pLtC').value }; else o.light = false; needsDraw = true; };
      $('#pLt').onchange = () => { setLt(); commit(); }; $('#pLtR').oninput = () => { $('#pLt').checked = true; setLt(); }; $('#pLtR').onchange = () => commit();
      $('#pLtC').oninput = () => { $('#pLt').checked = true; setLt(); }; $('#pLtC').onchange = () => commit();
    }
    const fx = (id, key, conv = (v) => v) => { const n = $(id); if (!n) return;
      n.oninput = (ev) => { o.ef = o.ef || {}; o.ef[key] = conv(ev.target.type === 'checkbox' ? ev.target.checked : ev.target.value); needsDraw = true; };
      n.onchange = (ev) => { n.oninput(ev); commit(); }; };
    fx('#fxShadow', 'shadow'); fx('#fxGlow', 'glow'); fx('#fxGlowCol', 'glowColor'); fx('#fxHue', 'hue', Number); fx('#fxBright', 'bright', Number); fx('#fxSat', 'sat', Number); fx('#fxTint', 'tint'); fx('#fxTintAmt', 'tintAmt', Number);
    $('#fxReset') && ($('#fxReset').onclick = () => { delete o.ef; commit(); renderProps(); needsDraw = true; });
    live('#pSFill', 'fill'); live('#pSWall', 'wall'); live('#pSWW', 'wallW', Number);
    live('#pX', 'x', Number); live('#pY', 'y', Number);
    live('#pS', 's', Number, () => { $('#pSn').value = o.s.toFixed(2); }); live('#pSn', 's', (v) => clamp(+v || 1, 0.05, 20), () => { $('#pS').value = o.s; });
    live('#pR', 'r', Number, () => { $('#pRn').value = o.r; }); live('#pRn', 'r', (v) => clamp(+v || 0, -180, 180), () => { $('#pR').value = o.r; });
    live('#pO', 'o', Number);
    $('#pFlip') && ($('#pFlip').onclick = () => { o.fx = !o.fx; commit(); needsDraw = true; });
    $('#pFront').onclick = () => reorder('front'); $('#pBack').onclick = () => reorder('back');
    $('#pUp').onclick = () => reorder('up'); $('#pDown').onclick = () => reorder('down');
    $('#pDup').onclick = duplicateSelection;
    $('#pCopy').onclick = () => copySelection(); $('#pCut').onclick = () => copySelection(true); $('#pPaste').onclick = pasteClipboard;
    $('#pDel').onclick = () => { deleteIds([o.id]); commit(); refreshPanels(); needsDraw = true; };
    $('#pSelSame') && ($('#pSelSame').onclick = () => { selection.clear(); doc.objects.forEach((q) => q.t === 'asset' && q.a === o.a && selection.add(q.id)); refreshPanels(); needsDraw = true; });
  }
  function refreshPropsValues() {
    if (selection.size !== 1) return;
    const o = findObj([...selection][0]); if (!o || o.t === 'line') return;
    const set = (s, v) => { const n = $(s); if (n && document.activeElement !== n) n.value = v; };
    set('#pX', Math.round(o.x)); set('#pY', Math.round(o.y)); set('#pS', o.s); set('#pSn', o.s.toFixed(2)); set('#pR', Math.round(o.r)); set('#pRn', Math.round(o.r));
  }

  // ------------------------------------------------------------------ assets-used list
  let usedTimer = null; const openGroups = new Set();
  function scheduleUsedList() { clearTimeout(usedTimer); usedTimer = setTimeout(renderUsedList, 60); }
  function renderUsedList() {
    const el = $('#usedList');
    const groups = new Map();
    for (const o of doc.objects) {
      const key = o.t === 'asset' ? `a:${o.a}` : o.t === 'text' ? 't:text' : o.t === 'shape' ? `s:${o.kind}` : o.t === 'legend' ? 'k:legend' : `l:${o.kind}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(o);
    }
    $('#usedCount').textContent = doc.objects.length;
    if (!groups.size) { el.innerHTML = '<p class="muted">Nothing placed yet. Every asset, label and line you add is listed here so you can select or delete all copies at once.</p>'; return; }
    const sorted = [...groups.entries()].sort((a, b) => b[1].length - a[1].length);
    el.innerHTML = sorted.map(([key, items]) => {
      let name, thumb = '';
      if (key.startsWith('a:')) { const k = key.slice(2); name = assetInfo(k)?.name || 'Missing asset'; thumb = `<img src="${esc(assetSrc(k) || '')}" alt="">`; }
      else if (key === 't:text') { name = 'Text labels'; thumb = '<span class="glyph" style="font-family:\'IM Fell English\'">A</span>'; }
      else if (key.startsWith('s:')) { name = SHAPE_KINDS[key.slice(2)] || 'Shape'; thumb = '<span class="glyph">▭</span>'; }
      else if (key === 'k:legend') { name = 'Map key'; thumb = '<span class="glyph">☰</span>'; }
      else if (key === 'l:realm') { name = 'Realms'; thumb = '<span class="glyph">⬢</span>'; }
      else { name = `${LINE_KINDS[key.slice(2)] || 'Line'}`; thumb = '<span class="glyph">〰</span>'; }
      const allSel = items.every((o) => selection.has(o.id));
      const open = openGroups.has(key);
      return `<div class="used" data-key="${esc(key)}">
        <div class="used-head">${thumb}<span class="nm" title="${esc(name)}">${esc(name)}</span><span class="ct">×${items.length}</span>
          <button data-act="toggle" title="Show each copy">${open ? '▾' : '▸'}</button></div>
        <div class="used-acts">
          <button data-act="sel" title="Select all copies"${allSel ? ' style="border-color:#4fa3e0"' : ''}>Select</button>
          <button data-act="hide" title="Hide/show all copies">${items.every((o) => o.hidden) ? 'Show' : 'Hide'}</button>
          <button data-act="del" class="danger" title="Delete all copies">Delete</button></div>
        ${open ? `<div class="used-items">${items.map((o, i) => `<button data-id="${o.id}" class="${selection.has(o.id) ? 'sel' : ''}">${o.t === 'text' ? esc(o.text.slice(0, 14)) : `#${i + 1}`}</button>`).join('')}</div>` : ''}
      </div>`;
    }).join('');
    el.querySelectorAll('.used').forEach((g) => {
      const key = g.dataset.key; const items = groups.get(key);
      g.querySelectorAll('[data-act]').forEach((b) => b.onclick = async () => {
        const act = b.dataset.act;
        if (act === 'toggle') { if (openGroups.has(key)) openGroups.delete(key); else openGroups.add(key); renderUsedList(); }
        if (act === 'sel') { setActiveLayer(layerOf(items[0]), true); selection.clear(); items.forEach((o) => selection.add(o.id)); refreshPanels(); needsDraw = true; }
        if (act === 'hide') { const hide = !items.every((o) => o.hidden); items.forEach((o) => { o.hidden = hide; if (hide) selection.delete(o.id); }); commit(); refreshPanels(); needsDraw = true; }
        if (act === 'del') {
          const ok = await confirmBox(`Delete all ${items.length} × “${g.querySelector('.nm').textContent}”?`, 'You can undo this with Ctrl+Z.');
          if (ok) { deleteIds(items.map((o) => o.id)); commit(); refreshPanels(); needsDraw = true; }
        }
      });
      g.querySelectorAll('[data-id]').forEach((b) => b.onclick = (e) => {
        const o = findObj(b.dataset.id); if (!o) return;
        if (!e.shiftKey) selection.clear(); selection.add(o.id);
        if (o.t !== 'line') { const r = stage.getBoundingClientRect(); view.ox = r.width / 2 - o.x * view.zoom; view.oy = r.height / 2 - o.y * view.zoom; }
        refreshPanels(); needsDraw = true;
      });
    });
  }

  // ------------------------------------------------------------------ dialogs
  function openDialog(html, onMount) {
    $('#dialog').innerHTML = html; $('#modal').classList.remove('hidden');
    onMount && onMount($('#dialog'));
  }
  function closeDialog() { $('#modal').classList.add('hidden'); $('#dialog').innerHTML = ''; }
  $('#modal').addEventListener('mousedown', (e) => { if (e.target.id === 'modal' && doc) closeDialog(); });
  async function confirmBox(message, detail) {
    if (api) return api.confirm(message, detail);
    return window.confirm(`${message}\n${detail || ''}`);
  }

  let recovery = null;
  function newMapDialog(first = false) {
    let type = 'world', style = doc?.style || 'parchment';
    const render = () => {
      const T = MAP_TYPES[type];
      openDialog(`
        <h2>${first ? 'Welcome to Pocket-Mapp-Creator' : 'New Map'}</h2>
        <h3>Map type</h3>
        <div class="cards">${Object.entries(MAP_TYPES).map(([k, v]) => `<div class="card ${k === type ? 'on' : ''}" data-type="${k}"><b>${v.label}</b><small>${v.desc}</small></div>`).join('')}</div>
        <h3>Style</h3>
        <div class="cards">${Object.entries(window.ASSET_STYLES).map(([k, v]) => `<div class="card ${k === style ? 'on' : ''}" data-style="${k}"><b>${v.label}</b><small>${STYLE_DESC[k] || ''}</small></div>`).join('')}</div>
        <h3>Size</h3>
        <div class="row"><label>Preset</label><select id="nPreset">${T.sizes.map(([w, h]) => `<option value="${w}x${h}">${w} × ${h}${type === 'battle' ? ` (${w / 70} × ${h / 70} squares)` : ''}</option>`).join('')}<option value="custom">Custom…</option></select></div>
        <div class="row"><label>Width × Height</label><input type="number" id="nW" value="${T.sizes[0][0]}" min="200" max="8000"> × <input type="number" id="nH" value="${T.sizes[0][1]}" min="200" max="8000"> px</div>
        <div class="row"><label>Name</label><input type="text" id="nName" value="${type === 'battle' ? 'Battle Map' : type === 'town' ? 'Town Map' : 'The Known World'}"></div>
        <p class="muted">Your map starts as open ocean. Use the <b>Land</b> brush to paint land in any shape, and the <b>Ocean</b> brush to carve it back into sea.</p>
        <div class="actions">${first ? `<button class="linkbtn" data-cmd="guide">New here? Read the User Guide</button><button class="linkbtn" id="nExample" style="margin-right:auto">Explore an example map</button>${recovery ? `<button id="nRecover" title="Saved automatically ${esc(recovery.when)}">Recover unsaved map</button>` : ''}<button data-cmd="open">Open existing…</button>` : '<button id="nCancel">Cancel</button>'}<button id="nGen" title="Create the map, then roll a random world, town or dungeon on it">🎲 Random map…</button><button class="primary" id="nCreate">Create map</button></div>`, (d) => {
        d.querySelectorAll('[data-type]').forEach((c) => c.onclick = () => { type = c.dataset.type; render(); });
        d.querySelectorAll('[data-style]').forEach((c) => c.onclick = () => { style = c.dataset.style; d.querySelectorAll('[data-style]').forEach((x) => x.classList.toggle('on', x === c)); });
        d.querySelector('#nPreset').onchange = (e) => { if (e.target.value !== 'custom') { const [w, h] = e.target.value.split('x'); d.querySelector('#nW').value = w; d.querySelector('#nH').value = h; } };
        const c = d.querySelector('#nCancel'); if (c) c.onclick = closeDialog;
        const ex = d.querySelector('#nExample'); if (ex) ex.onclick = () => { closeDialog(); newMap({ type: 'world', style, start: 'example', name: 'The Known World', seed: 7 }); };
        const rc = d.querySelector('#nRecover'); if (rc) rc.onclick = async () => { closeDialog(); try { await deserialize(recovery.data); markDirty(); toast('Recovered the map that was saved automatically. Save it to keep it.', 'ok'); } catch (err) { toast('Could not recover the autosaved map: ' + err.message, 'warn'); } };
        bindCmdButtons(d);
        d.querySelector('#nGen').onclick = () => {
          const w = clamp(+d.querySelector('#nW').value || 2000, 200, 8000), h = clamp(+d.querySelector('#nH').value || 1400, 200, 8000);
          const name = d.querySelector('#nName').value;
          closeDialog(); newMap({ type, style, width: w, height: h, name, start: 'sea' }); generateDialog();
        };
        d.querySelector('#nCreate').onclick = () => {
          const w = clamp(+d.querySelector('#nW').value || 2000, 200, 8000), h = clamp(+d.querySelector('#nH').value || 1400, 200, 8000);
          const name = d.querySelector('#nName').value; // read before the dialog is cleared
          closeDialog();
          newMap({ type, style, width: w, height: h, name, start: 'sea' });
        };
      });
    };
    render();
  }

  function resizeDialog() {
    openDialog(`<h2>Map size</h2>
      <div class="row"><label>Width × Height</label><input type="number" id="rW" value="${doc.width}" min="200" max="8000"> × <input type="number" id="rH" value="${doc.height}" min="200" max="8000"> px</div>
      <div class="row"><label>Mode</label><select id="rMode"><option value="canvas">Extend / crop the canvas</option><option value="scale">Scale everything to fit</option></select></div>
      <div class="row"><label>Anchor</label><select id="rAnchor"><option value="c">Centre</option><option value="tl">Top-left</option><option value="t">Top</option><option value="l">Left</option><option value="br">Bottom-right</option></select></div>
      <p class="muted">New space added to the map starts as open sea; paint land into it as usual.</p>
      <div class="actions"><button id="rCancel">Cancel</button><button class="primary" id="rOk">Apply</button></div>`, (d) => {
      d.querySelector('#rCancel').onclick = closeDialog;
      d.querySelector('#rOk').onclick = () => {
        const W = clamp(+d.querySelector('#rW').value, 200, 8000), H = clamp(+d.querySelector('#rH').value, 200, 8000);
        resizeMap(W, H, d.querySelector('#rMode').value, d.querySelector('#rAnchor').value); closeDialog();
      };
    });
  }
  function resizeMap(W, H, mode, anchor) {
    settleLand();
    const oldW = doc.width, oldH = doc.height, oldLand = landMask, oldPath = pathMask, oldTex = texMasks;
    let dx = 0, dy = 0, sx = 1, sy = 1;
    if (mode === 'scale') { sx = W / oldW; sy = H / oldH; }
    else {
      if (anchor === 'c') { dx = (W - oldW) / 2; dy = (H - oldH) / 2; }
      if (anchor === 't') dx = (W - oldW) / 2; if (anchor === 'l') dy = (H - oldH) / 2;
      if (anchor === 'br') { dx = W - oldW; dy = H - oldH; }
    }
    allocMasks(W, H);
    const draw = (dst, src, clearFirst) => {
      const c = dst.getContext('2d');
      if (clearFirst && mode !== 'scale') c.clearRect(dx * maskScale, dy * maskScale, oldW * maskScale, oldH * maskScale);
      c.drawImage(src, dx * maskScale, dy * maskScale, oldW * sx * maskScale, oldH * sy * maskScale);
    };
    draw(landMask, oldLand, true); draw(pathMask, oldPath, false);
    doc.width = W; doc.height = H;   // (set early so the new texture masks get the new size)
    for (const [t, m] of Object.entries(oldTex)) texMask(t, true).getContext('2d').drawImage(m, dx * texScale, dy * texScale, oldW * sx * texScale, oldH * sy * texScale);
    const avg = Math.sqrt(sx * sy);
    for (const o of doc.objects) {
      if (o.t === 'line') { o.pts = o.pts.map(([x, y]) => [x * sx + dx, y * sy + dy]); o.w *= avg; }
      else { o.x = o.x * sx + dx; o.y = o.y * sy + dy; o.s *= avg; }
    }
    doc.width = W; doc.height = H;
    lastLandSnap = lastPathSnap = null;
    baseDirty = true; commit(); zoomFit(); refreshPanels();
  }

  function exportDialog(fmt) {
    const maxS = Math.sqrt(70e6 / (doc.width * doc.height)), long = Math.max(doc.width, doc.height);
    const opts = [[0.5, '0.5×'], [1, '1× (map size)'], [2048 / long, '2K'], [4096 / long, '4K'], [8192 / long, '8K'], [2, '2×']]
      .filter(([sc]) => sc <= maxS + 1e-6).sort((a, b) => a[0] - b[0])
      .filter(([sc], i, arr) => i === 0 || Math.abs(sc - arr[i - 1][0]) > 0.01 || arr[i - 1][1].length > 3);
    openDialog(`<h2>Export ${fmt.toUpperCase()}</h2>
      <div class="row"><label>Size</label><select id="eScale">
        ${opts.map(([sc, lab]) => `<option value="${sc}" ${sc === 1 ? 'selected' : ''}>${lab} — ${Math.round(doc.width * sc)} × ${Math.round(doc.height * sc)} px</option>`).join('')}
      </select></div>
      <p class="muted" style="margin:4px 0 0">2K, 4K and 8K set the longest side to 2048, 4096 or 8192 pixels. 8K suits large prints.</p>
      ${fmt === 'jpg' ? '<div class="row"><label>Quality</label><input type="range" id="eQ" min="0.5" max="1" step="0.02" value="0.92"></div>' : ''}
      <div class="row"><label>Include grid</label><input type="checkbox" id="eGrid" ${doc.grid.type !== 'none' ? 'checked' : ''}></div>
      <div class="actions"><button id="eCancel">Cancel</button><button class="primary" id="eGo">Export</button></div>`, (d) => {
      d.querySelector('#eCancel').onclick = closeDialog;
      d.querySelector('#eGo').onclick = async () => {
        const s = +d.querySelector('#eScale').value, q = fmt === 'jpg' ? +d.querySelector('#eQ').value : 1, grid = d.querySelector('#eGrid').checked;
        closeDialog(); await exportImage(fmt, s, q, grid);
      };
    });
  }
  async function renderExportCanvas(s, grid) {
    await whenImagesReady(); await document.fonts.ready;
    // render the terrain at full output resolution where memory allows
    const ts = Math.min(s, Math.sqrt(16e6 / (doc.width * doc.height)));
    const hiBase = MT.renderBase(baseOpts(ts));
    const cv = document.createElement('canvas'); cv.width = Math.round(doc.width * s); cv.height = Math.round(doc.height * s);
    const ctx = cv.getContext('2d'); ctx.scale(s, s);
    renderMapContent(ctx, hiBase, { grid, texLayer: renderTextures(Math.min(s, Math.sqrt(24e6 / (doc.width * doc.height)))) });
    return cv;
  }
  async function exportImage(fmt, s = 1, q = 0.92, grid = true) {
    settleLand();
    status('Rendering export…');
    await new Promise((r) => setTimeout(r, 30));
    let cv = await renderExportCanvas(s, grid);
    if (lookFilter() !== 'none') { const c2 = document.createElement('canvas'); c2.width = cv.width; c2.height = cv.height; const x2 = c2.getContext('2d'); x2.filter = lookFilter(); x2.drawImage(cv, 0, 0); cv = c2; }
    if (fmt === 'jpg') { const c3 = document.createElement('canvas'); c3.width = cv.width; c3.height = cv.height; const x3 = c3.getContext('2d'); x3.fillStyle = '#fff'; x3.fillRect(0, 0, c3.width, c3.height); x3.drawImage(cv, 0, 0); cv = c3; }
    const blob = await new Promise((res) => cv.toBlob(res, fmt === 'jpg' ? 'image/jpeg' : 'image/png', q));
    if (api) { const bytes = new Uint8Array(await blob.arrayBuffer()); const p = await api.exportImage(bytes, fmt); status(p ? `Exported ${cv.width} × ${cv.height} px to ${p}` : ''); }
    else { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${doc.name}.${fmt}`; a.click(); status('Exported'); }
    return { w: cv.width, h: cv.height, bytes: blob.size };
  }

  // ---- SVG, PDF and print
  function exportMoreDialog() {
    openDialog(`<h2>More ways to export</h2>
      <div class="cards">
        <div class="card" data-x="svg"><b>SVG</b><small>Vector file: icons and labels stay sharp at any size and can be edited in Inkscape or Illustrator</small></div>
        <div class="card" data-x="pdf"><b>PDF</b><small>Print-ready page: A4, A3, A2, Letter, Tabloid or poster size</small></div>
        <div class="card" data-x="print"><b>Print</b><small>Send the map straight to a printer</small></div>
      </div>
      <div class="actions"><button id="xCancel">Cancel</button></div>`, (d) => {
      d.querySelector('#xCancel').onclick = closeDialog;
      d.querySelectorAll('[data-x]').forEach((c) => c.onclick = () => { const x = c.dataset.x; closeDialog(); if (x === 'svg') exportSvg(); else exportPdfDialog(x); });
    });
  }
  const PAGES = { A4: [8.27, 11.69], A3: [11.69, 16.54], A2: [16.54, 23.39], A1: [23.39, 33.11], Letter: [8.5, 11], Tabloid: [11, 17] };
  function exportPdfDialog(mode) {
    if (!api) { toast('PDF export and printing need the desktop app. Export a PNG instead.', 'warn'); return; }
    openDialog(`<h2>${mode === 'print' ? 'Print' : 'Export PDF'}</h2>
      <div class="row"><label>Paper</label><select id="pPage">${Object.keys(PAGES).map((k) => `<option ${k === 'A4' ? 'selected' : ''}>${k}</option>`).join('')}<option value="map">Map size (poster, 150 dpi)</option></select></div>
      <div class="row"><label>Orientation</label><select id="pOri"><option value="auto">To suit the map</option><option value="portrait">Portrait</option><option value="landscape">Landscape</option></select></div>
      <div class="row"><label>Margin</label><select id="pMar"><option value="0">None</option><option value="0.25" selected>Narrow (6 mm)</option><option value="0.5">Wide (13 mm)</option></select></div>
      <div class="row"><label>Include grid</label><input type="checkbox" id="pGrid" ${doc.grid.type !== 'none' ? 'checked' : ''}></div>
      <p class="muted">The map is drawn at about 300 dots per inch for the page you choose.</p>
      <div class="actions"><button id="pCancel">Cancel</button><button class="primary" id="pGo">${mode === 'print' ? 'Print…' : 'Export'}</button></div>`, (d) => {
      d.querySelector('#pCancel').onclick = closeDialog;
      d.querySelector('#pGo').onclick = async () => {
        const pg = d.querySelector('#pPage').value, ori = d.querySelector('#pOri').value, m = +d.querySelector('#pMar').value, grid = d.querySelector('#pGrid').checked;
        closeDialog(); await exportPage(mode, pg, ori, m, grid);
      };
    });
  }
  async function exportPage(mode, pg, ori, margin, grid) {
    settleLand(); status(mode === 'print' ? 'Preparing to print…' : 'Rendering PDF…');
    await new Promise((r) => setTimeout(r, 30));
    let page;
    if (pg === 'map') page = { w: doc.width / 150 + margin * 2, h: doc.height / 150 + margin * 2, margin };
    else {
      let [w, h] = PAGES[pg] || PAGES.A4; const land = ori === 'landscape' || (ori === 'auto' && doc.width > doc.height);
      if (land) [w, h] = [h, w]; page = { w, h, margin };
    }
    const fit = Math.min((page.w - margin * 2) / doc.width, (page.h - margin * 2) / doc.height);   // inches per map px
    const maxS = Math.sqrt(70e6 / (doc.width * doc.height));
    const s = clamp(fit * 300, 0.25, maxS);
    let cv = await renderExportCanvas(s, grid);
    if (lookFilter() !== 'none') { const c2 = document.createElement('canvas'); c2.width = cv.width; c2.height = cv.height; const x2 = c2.getContext('2d'); x2.filter = lookFilter(); x2.drawImage(cv, 0, 0); cv = c2; }
    const blob = await new Promise((res) => cv.toBlob(res, 'image/png'));
    const bytes = new Uint8Array(await blob.arrayBuffer());
    if (mode === 'print') { const r = await api.printMap(bytes, page); status(r === 'printed' ? 'Sent to the printer.' : ''); return r; }
    const p = await api.exportPdf(bytes, page, doc.name);
    status(p ? `Exported PDF (${pg === 'map' ? 'poster' : pg}) to ${p}` : '');
    return p;
  }
  // SVG: terrain, textures, rooms and lines as one picture; icons, grid, border and labels as real vectors
  const FONT_FILES = { 'IM Fell English': ['im-fell-english-latin-400-normal.woff2'], 'IM Fell English SC': ['im-fell-english-sc-latin-400-normal.woff2'], 'Uncial Antiqua': ['uncial-antiqua-latin-400-normal.woff2'], Cinzel: ['cinzel-latin-400-normal.woff2', 'cinzel-latin-700-normal.woff2'], Macondo: ['macondo-latin-400-normal.woff2'], 'EB Garamond': ['eb-garamond-latin-400-normal.woff2', 'eb-garamond-latin-700-normal.woff2'], Caveat: ['caveat-latin-400-normal.woff2', 'caveat-latin-700-normal.woff2'], Orbitron: ['orbitron-latin-400-normal.woff2', 'orbitron-latin-700-normal.woff2'] };
  async function buildSvg(opts = {}) {
    await whenImagesReady(); await document.fonts.ready;
    const W = doc.width, H = doc.height, s = opts.scale || 1, n = (v) => Math.round(v * 100) / 100, X = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const defs = [], body = [];
    // 1. background picture: everything below the icons
    const ts = Math.min(s, Math.sqrt(16e6 / (W * H)));
    const bg = document.createElement('canvas'); bg.width = Math.round(W * s); bg.height = Math.round(H * s);
    const bx = bg.getContext('2d'); bx.scale(s, s); bx.imageSmoothingQuality = 'high';
    bx.drawImage(MT.renderBase(baseOpts(ts)), 0, 0, W, H);
    if (Object.keys(texMasks).length && layerState('land').visible) bx.drawImage(renderTextures(Math.min(s, Math.sqrt(24e6 / (W * H)))), 0, 0, W, H);
    const assetsOn = layerState('assets').visible, textOn = layerState('text').visible;
    if (assetsOn) { drawDungeon(bx); for (const o of doc.objects) if (layerOf(o) === 'assets' && o.t !== 'asset') drawObject(bx, o); }
    body.push(`<image x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="none" href="${bg.toDataURL('image/png')}"/>`);
    // 2. grid
    const gr = doc.grid;
    if (opts.grid !== false && gr.type !== 'none') {
      let d = '';
      if (gr.type === 'square') { for (let x = 0; x <= W + 0.1; x += gr.size) d += `M${n(x)} 0V${H}`; for (let y = 0; y <= H + 0.1; y += gr.size) d += `M0 ${n(y)}H${W}`; }
      else { const r = gr.size / 2, hh = Math.sqrt(3) * r; for (let col = 0, x = r; x - r < W; col++, x += r * 1.5) for (let y = (col % 2 ? hh : hh / 2); y - hh / 2 < H; y += hh) { for (let i = 0; i < 6; i++) { const a = (Math.PI / 3) * i; d += `${i ? 'L' : 'M'}${n(x + r * Math.cos(a))} ${n(y + r * Math.sin(a))}`; } d += 'Z'; } }
      body.push(`<path d="${d}" fill="none" stroke="${gr.color}" stroke-opacity="${gr.opacity}" stroke-width="1.5"/>`);
    }
    // 3. icons: each asset file embedded once, placed with <use>
    let fxN = 0;
    const fxFilterSvg = (e) => {
      if (!e) return '';
      const parts = []; let last = 'SourceGraphic';
      if (e.hue) { parts.push(`<feColorMatrix in="${last}" type="hueRotate" values="${e.hue}" result="h"/>`); last = 'h'; }
      if (e.sat != null && e.sat !== 100) { parts.push(`<feColorMatrix in="${last}" type="saturate" values="${e.sat / 100}" result="s"/>`); last = 's'; }
      if (e.bright != null && e.bright !== 100) { const b = e.bright / 100; parts.push(`<feComponentTransfer in="${last}" result="b"><feFuncR type="linear" slope="${b}"/><feFuncG type="linear" slope="${b}"/><feFuncB type="linear" slope="${b}"/></feComponentTransfer>`); last = 'b'; }
      const merge = [];
      if (e.glow) { parts.push(`<feGaussianBlur in="${last}" stdDeviation="${(e.glowSize || 16) / 2}" result="gb"/><feFlood flood-color="${e.glowColor || '#ffd84a'}"/><feComposite in2="gb" operator="in" result="gl"/>`); merge.push('gl', 'gl'); }
      if (e.shadow) { parts.push(`<feGaussianBlur in="SourceAlpha" stdDeviation="6" result="sb"/><feOffset in="sb" dx="8" dy="10" result="so"/><feFlood flood-color="#000" flood-opacity="${e.shadowStr ?? 0.5}"/><feComposite in2="so" operator="in" result="sh"/>`); merge.push('sh'); }
      if (!parts.length) return '';
      const id = `fx${++fxN}`;
      defs.push(`<filter id="${id}" x="-50%" y="-50%" width="200%" height="200%">${parts.join('')}<feMerge>${merge.map((m) => `<feMergeNode in="${m}"/>`).join('')}<feMergeNode in="${last}"/></feMerge></filter>`);
      return ` filter="url(#${id})"`;
    };
    if (assetsOn) {
      const keys = [...new Set(doc.objects.filter((o) => o.t === 'asset' && !o.hidden && !o.a.startsWith('custom:')).map((o) => o.a))];
      const files = api && api.readAssets ? await api.readAssets(doc.style, keys) : {};
      const used = new Set(); const items = [];
      for (const o of doc.objects) {
        if (layerOf(o) !== 'assets' || o.hidden || o.t !== 'asset') continue;
        const inf = assetInfo(o.a); if (!inf) continue;
        const k = inf.base * o.s, e = o.ef;
        const tr = `translate(${n(o.x)} ${n(o.y)}) rotate(${n(o.r || 0)}) scale(${n(o.fx ? -k : k)} ${n(k)})`;
        let href;
        if (e && e.tint && e.tintAmt > 0) href = tinted(o.a, getImg(o.a), e.tint, e.tintAmt).toDataURL('image/png');
        else if (o.a.startsWith('custom:')) href = assetSrc(o.a);
        else if (files[o.a]) { const id = `a-${o.a}`; if (!used.has(id)) { used.add(id); defs.push(`<image id="${id}" x="${-inf.w / 2}" y="${-inf.h / 2}" width="${inf.w}" height="${inf.h}" href="data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(files[o.a])))}"/>`); } items.push(`<use href="#${id}" transform="${tr}"${o.o != null && o.o < 1 ? ` opacity="${o.o}"` : ''}${fxFilterSvg(e)}/>`); continue; }
        else { const c = document.createElement('canvas'); const im = getImg(o.a); c.width = im.naturalWidth || inf.w; c.height = im.naturalHeight || inf.h; c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); href = c.toDataURL('image/png'); }
        items.push(`<image x="${-inf.w / 2}" y="${-inf.h / 2}" width="${inf.w}" height="${inf.h}" href="${href}" transform="${tr}"${o.o != null && o.o < 1 ? ` opacity="${o.o}"` : ''}${fxFilterSvg(e)}/>`);
      }
      const lf = layerFx('assets');
      body.push(`<g id="assets"${lf && lf.opacity < 1 ? ` opacity="${lf.opacity}"` : ''}${lf ? fxFilterSvg({ shadow: lf.shadow, glow: lf.glow, glowColor: lf.glowColor }) : ''}>${items.join('')}</g>`);
    }
    // 4. lighting (a soft picture over the map)
    if (doc.light && doc.light.on) {
      const lc = document.createElement('canvas'); const ls = Math.min(1, 2000 / Math.max(W, H)); lc.width = Math.round(W * ls); lc.height = Math.round(H * ls);
      const lx = lc.getContext('2d'); lx.scale(ls, ls); drawLighting(lx);
      body.push(`<image x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="none" href="${lc.toDataURL('image/png')}"/>`);
    }
    // 5. border
    if (doc.border) {
      const ink = INK[doc.style], m = Math.min(W, H), t = Math.max(6, m * 0.008), g = t * 1.6;
      let b = `<rect x="${n(t / 2)}" y="${n(t / 2)}" width="${n(W - t)}" height="${n(H - t)}" fill="none" stroke="${ink}" stroke-width="${n(t)}"/><rect x="${n(t + g)}" y="${n(t + g)}" width="${n(W - 2 * (t + g))}" height="${n(H - 2 * (t + g))}" fill="none" stroke="${ink}" stroke-width="${n(t * 0.25)}"/>`;
      if (doc.style === 'parchment') { let d = ''; const step = m / 24, a = t, bb = t + g; for (let x = bb + step; x < W - bb; x += step) d += `M${n(x)} ${n(a)}V${n(bb)}M${n(x)} ${n(H - a)}V${n(H - bb)}`; for (let y = bb + step; y < H - bb; y += step) d += `M${n(a)} ${n(y)}H${n(bb)}M${n(W - a)} ${n(y)}H${n(W - bb)}`; b += `<path d="${d}" stroke="${ink}" stroke-width="${n(t * 0.2)}" fill="none"/>`; }
      body.push(`<g id="border">${b}</g>`);
    }
    // 6. labels as real text, with the fonts embedded
    if (textOn) {
      const fontsUsed = new Set(), items = [];
      let arcN = 0;
      for (const o of doc.objects) {
        if (layerOf(o) !== 'text' || o.hidden) continue;
        if (o.t === 'legend') { const c = document.createElement('canvas'); const { w, h } = objSize(o); const ks = 2; c.width = Math.ceil(w * ks) + 4; c.height = Math.ceil(h * ks) + 4; const x = c.getContext('2d'); x.scale(ks, ks); x.translate(w / 2 + 1, h / 2 + 1); drawLegend(x, { ...o, x: 0, y: 0, r: 0 }); items.push(`<image x="${-w / 2 - 1}" y="${-h / 2 - 1}" width="${c.width / ks}" height="${c.height / ks}" href="${c.toDataURL('image/png')}" transform="translate(${n(o.x)} ${n(o.y)}) rotate(${n(o.r || 0)})"/>`); continue; }
        if (o.t !== 'text') continue;
        fontsUsed.add(o.font);
        const style = `font-family:'${o.font}';font-size:${o.size}px;${o.bold ? 'font-weight:700;' : ''}${o.italic ? 'font-style:italic;' : ''}${o.spacing ? `letter-spacing:${o.spacing}px;` : ''}`;
        const halo = o.halo ? ` stroke="${o.haloColor || PAPER[doc.style]}" stroke-width="${n(o.size * 0.22)}" stroke-opacity="0.85" stroke-linejoin="round" paint-order="stroke"` : '';
        const lines = textLines(o), tr = `translate(${n(o.x)} ${n(o.y)}) rotate(${n(o.r || 0)}) scale(${n(o.s)})`;
        let inner;
        if (o.curve) {
          measureCtx.font = fontStr(o); measureCtx.letterSpacing = `${o.spacing || 0}px`;
          const Wt = measureCtx.measureText(lines[0]).width, th = (Math.abs(o.curve) / 100) * Math.PI * 0.9, Rr = Wt / th, sign = o.curve > 0 ? 1 : -1, sag = Rr * (1 - Math.cos(th / 2));
          const id = `arc${++arcN}`, y0 = sign * sag / 2, a0 = -Math.PI / 2 - Math.PI * 0.49, a1 = -Math.PI / 2 + Math.PI * 0.49;
          const cy = y0 + sign * Rr;
          const P = (a) => `${n(Rr * Math.cos(a))} ${n(cy + sign * Rr * Math.sin(a))}`;
          defs.push(`<path id="${id}" d="M${P(a0)} A${n(Rr)} ${n(Rr)} 0 0 ${sign > 0 ? 1 : 0} ${P(a1)}"/>`);
          inner = `<textPath href="#${id}" startOffset="50%">${X(lines[0])}</textPath>`;
          items.push(`<text transform="${tr}" text-anchor="middle" dominant-baseline="central" fill="${o.color}" style="${style}"${o.o != null && o.o < 1 ? ` opacity="${o.o}"` : ''}${halo}${fxFilterSvg(o.ef && { shadow: o.ef.shadow, glow: o.ef.glow, glowColor: o.ef.glowColor })}>${inner}</text>`);
          continue;
        }
        const lh = o.size * 1.15, y0 = -((lines.length - 1) * lh) / 2;
        inner = lines.map((l, i) => `<tspan x="0" y="${n(y0 + i * lh)}">${X(l)}</tspan>`).join('');
        items.push(`<text transform="${tr}" text-anchor="middle" dominant-baseline="central" fill="${o.color}" style="${style}"${o.o != null && o.o < 1 ? ` opacity="${o.o}"` : ''}${halo}${fxFilterSvg(o.ef && { shadow: o.ef.shadow, glow: o.ef.glow, glowColor: o.ef.glowColor })}>${inner}</text>`);
      }
      const faces = [];
      if (api && api.readFont) for (const f of fontsUsed) for (const file of FONT_FILES[f] || []) { const b64 = await api.readFont(file); if (b64) faces.push(`@font-face{font-family:'${f}';font-weight:${file.includes('-700-') ? 700 : 400};src:url(data:font/woff2;base64,${b64}) format('woff2');}`); }
      if (faces.length) defs.push(`<style>${faces.join('')}</style>`);
      const lf = layerFx('text');
      body.push(`<g id="labels"${lf && lf.opacity < 1 ? ` opacity="${lf.opacity}"` : ''}${lf ? fxFilterSvg({ shadow: lf.shadow, glow: lf.glow, glowColor: lf.glowColor }) : ''}>${items.join('')}</g>`);
    }
    // 7. vignette
    const v = doc.look && doc.look.vignette;
    if (v > 0) { defs.push(`<radialGradient id="vig" cx="50%" cy="50%" r="${n(Math.hypot(W, H) / 2 / Math.max(W, H) * 100)}%" gradientUnits="objectBoundingBox"><stop offset="${n((Math.min(W, H) * 0.3) / (Math.hypot(W, H) / 2))}" stop-color="rgb(40,24,10)" stop-opacity="0"/><stop offset="1" stop-color="rgb(40,24,10)" stop-opacity="${n((v / 100) * 0.85)}"/></radialGradient>`); body.push(`<rect width="${W}" height="${H}" fill="url(#vig)"/>`); }
    const lf = lookFilter();
    return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">\n<title>${X(doc.name)}</title>\n<desc>Made with Pocket-Mapp-Creator</desc>\n<defs>${defs.join('\n')}</defs>\n<g${lf !== 'none' ? ` style="filter:${lf}"` : ''}>\n${body.join('\n')}\n</g>\n</svg>\n`;
  }
  async function exportSvg() {
    settleLand(); status('Building SVG…'); await new Promise((r) => setTimeout(r, 30));
    const svg = await buildSvg({ grid: doc.grid.type !== 'none' });
    const bytes = new TextEncoder().encode(svg);
    if (api) { const p = await api.exportImage(bytes, 'svg'); status(p ? `Exported SVG to ${p}` : ''); }
    else { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' })); a.download = `${doc.name}.svg`; a.click(); }
    return svg.length;
  }

  function creditsDialog() {
    const counts = {}; MANIFEST.forEach((a) => (counts[a.genre] = (counts[a.genre] || 0) + 1));
    openDialog(`<h2>Licences</h2>
      <p>Pocket-Mapp-Creator © 2026 Pocket-Designs — released under the MIT Licence.</p>
      <h3>Product icon</h3>
      <p><b>Icon Artist:</b> MJO-Art · workmjo@gmail.com<br>The product Icon files are custom images created by MJO-Art for this project. These icons can not be altered or used without the express permission of the Artist.</p>
      <h3>Built-in map assets (${MANIFEST.length} × ${Object.keys(window.ASSET_STYLES).length} styles)</h3>
      <p>All built-in assets are <b>original artwork</b> drawn procedurally by Pocket-Mapp-Creator's own generator and dedicated to the public domain under <b>CC0 1.0</b>. You may use maps made with them commercially, with no attribution required.</p>
      <p class="muted">${Object.entries(counts).map(([g, n]) => `${g}: ${n}`).join(' · ')}</p>
      <h3>Fonts — SIL Open Font Licence 1.1</h3>
      <table><tr><th>Font</th><th>Licence</th></tr>
      ${['IM Fell English (Igino Marini)', 'IM Fell English SC (Igino Marini)', 'Uncial Antiqua (Astigmatic)', 'Cinzel (Natanael Gama)', 'Macondo (John Vargas Beltrán)', 'EB Garamond (Georg Duffner, Octavio Pardo)', 'Caveat (Impallari Type)', 'Orbitron (Matt McInerney)'].map((f) => `<tr><td>${f}</td><td>OFL-1.1</td></tr>`).join('')}
      </table>
      <p class="muted">Full licence texts ship with the app in ASSET-LICENSES.md and src/fonts/licenses/. Imported assets are your responsibility — check their licence.</p>
      <div class="actions"><button class="primary" id="cOk">Close</button></div>`, (d) => { d.querySelector('#cOk').onclick = closeDialog; });
  }
  function shortcutsDialog() {
    const rows = [['F1', 'Open the User Guide'], ['V / S / B / E / G / X / P / L / U / D / T / M / H', 'Select · Stamp · Land · Ocean · Fill · Texture · Ground · Lines · Shapes · Dungeon · Text · Measure · Pan'], ['Ctrl+P', 'Print'], ['Double-click an item', 'Open its linked map'], ['Enter / Backspace (Shapes)', 'Finish a polygon / remove its last corner'], ['Space + drag, middle mouse', 'Pan'], ['Mouse wheel', 'Zoom'], ['Ctrl+= / Ctrl+- / Ctrl+0', 'Zoom in / out / fit (or the − + buttons and % box at the top)'], ['G', 'Fill bucket'], ['Shift+wheel / Alt+wheel', 'Scroll sideways / up and down (or drag the scroll bars)'], ['Ctrl+Z / Ctrl+Y', 'Undo / Redo'], ['Ctrl+C / Ctrl+X / Ctrl+V', 'Copy / Cut / Paste (pastes at the mouse, same size and rotation)'], ['Ctrl+D', 'Duplicate'], ['Alt + drag', 'Duplicate while moving'], ['Delete', 'Delete selection'], ['R / Shift+R', 'Rotate ±15°'], ['F', 'Flip asset'], ['Click land (Select tool, Land layer)', 'Select a whole landmass to move, resize or rotate'], ['1 / 2 / 3', 'Make Land / Assets / Text the active layer'], ['[ / ]', 'Brush size, or scale selection'], ['Arrows (+Shift)', 'Nudge 1px (10px)'], ['Shift while rotating', 'Snap to 15°'], ['Alt while painting', 'Swap Land ↔ Ocean brush']];
    openDialog(`<h2>Keyboard shortcuts</h2><table>${rows.map(([k, v]) => `<tr><td><kbd>${k}</kbd></td><td>${v}</td></tr>`).join('')}</table><div class="actions"><button class="primary" id="kOk">Close</button></div>`, (d) => { d.querySelector('#kOk').onclick = closeDialog; });
  }

  // ------------------------------------------------------------------ save / open
  function serialize() {
    settleLand();
    const textures = Object.fromEntries(Object.entries(texMasks).map(([t, m]) => [t, m.toDataURL('image/png')]));
    return JSON.stringify({ ...doc, landMask: landMask.toDataURL('image/png'), pathMask: pathMask.toDataURL('image/png'), textures });
  }
  async function loadImageToMask(mask, url) {
    const im = new Image(); im.src = url; await im.decode();
    const c = mask.getContext('2d'); c.clearRect(0, 0, mask.width, mask.height); c.drawImage(im, 0, 0, mask.width, mask.height);
  }
  async function deserialize(text) {
    landSel = null;
    const d = JSON.parse(text);
    if (d.app !== 'Pocket-Mapp-Creator' && d.app !== 'Mapp-Creator') throw new Error('Not a Pocket-Mapp-Creator map file');
    d.app = 'Pocket-Mapp-Creator';
    const { landMask: lm, pathMask: pm, textures, ...rest } = d;
    doc = Object.assign(makeDoc({ type: rest.type }), rest);
    allocMasks(doc.width, doc.height);
    await loadImageToMask(landMask, lm); await loadImageToMask(pathMask, pm);
    for (const [t, url] of Object.entries(textures || {})) if (MT.TEXTURES[t]) await loadImageToMask(texMask(t, true), url);
    selection.clear(); ui.kind = MAP_TYPES[doc.type]?.kind || 'all';
    syncTopbar(); buildLibrary(); resetHistory(); baseDirty = true; zoomFit(); refreshPanels();
  }
  async function save(as = false) {
    const data = serialize();
    if (api) {
      const p = await api.saveProject(data, as ? null : filePath);
      if (p) { filePath = p; dirtyFlag = false; api.autosaveClear && api.autosaveClear(); document.title = `Pocket-Mapp-Creator — ${doc.name}`; status(`Saved ${p}`); }
    } else {
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([data], { type: 'application/json' })); a.download = `${doc.name}.mapp`; a.click();
    }
  }
  async function open() {
    try {
      let r;
      if (api) r = await api.openProject();
      else r = await browserPickText();
      if (!r) return;
      closeDialog();
      await deserialize(r.data); filePath = r.filePath || null; document.title = `Pocket-Mapp-Creator — ${doc.name}`;
    } catch (err) { alert(`Could not open map: ${err.message}`); }
  }
  function browserPickText() {
    return new Promise((res) => { const i = document.createElement('input'); i.type = 'file'; i.accept = '.mapp,.json'; i.onchange = async () => { const f = i.files[0]; res(f ? { data: await f.text() } : null); }; i.click(); });
  }
  function browserPickImages() {
    return new Promise((res) => {
      const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*'; i.multiple = true;
      i.onchange = async () => res(await Promise.all([...i.files].map((f) => new Promise((r) => { const fr = new FileReader(); fr.onload = () => r({ name: f.name.replace(/\.[^.]+$/, ''), dataUrl: fr.result }); fr.readAsDataURL(f); }))));
      i.click();
    });
  }

  // ------------------------------------------------------------------ commands
  async function newWithConfirm() {
    if (dirtyFlag && !(await confirmBox('Start a new map?', 'Unsaved changes to the current map will be lost.'))) return;
    newMapDialog();
  }
  const COMMANDS = {
    new: newWithConfirm, open, save: () => save(false), saveAs: () => save(true),
    exportPng: () => exportDialog('png'), exportJpg: () => exportDialog('jpg'),
    undo: () => typingNow() ? api?.nativeEdit('undo') : undo(), redo: () => typingNow() ? api?.nativeEdit('redo') : redo(),
    copy: () => typingNow() ? api?.nativeEdit('copy') : copySelection(), cut: () => typingNow() ? api?.nativeEdit('cut') : copySelection(true), paste: () => typingNow() ? api?.nativeEdit('paste') : pasteClipboard(),
    duplicate: duplicateSelection, selectAll: () => typingNow() ? api?.nativeEdit('selectAll') : selectAll(), resize: resizeDialog,
    zoomIn: () => zoomStep(1), zoomOut: () => zoomStep(-1), zoom100: () => setZoom(1),
    zoomFit, importAsset: importAssets, credits: creditsDialog, shortcuts: shortcutsDialog,
    guide: () => openGuide(),
    generate: () => generateDialog(), back: goBack,
    exportMore: () => exportMoreDialog(), exportSvg: () => exportSvg(), exportPdf: () => exportPdfDialog('pdf'), print: () => exportPdfDialog('print')
  };
  function openGuide(section) {
    if (api && api.openGuide) api.openGuide(section);
    else window.open(`guide/index.html${section ? '#' + section : ''}`, 'mappguide');
  }
  function typingNow() {
    // only real text entry pauses the map's shortcuts; checkboxes, sliders, colour pickers and lists don't
    const a = document.activeElement; if (!a) return false;
    if (a.tagName === 'TEXTAREA') return true;
    if (a.tagName !== 'INPUT') return false;
    return !['range', 'checkbox', 'color', 'button', 'radio'].includes(a.type);
  }
  function bindCmdButtons(root) { root.querySelectorAll('[data-cmd]').forEach((b) => b.onclick = () => COMMANDS[b.dataset.cmd]?.()); }
  bindCmdButtons(document);
  $('#zoomInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { const v = parseFloat(e.target.value); if (v > 0) setZoom(v / 100); e.target.blur(); }
    if (e.key === 'Escape') e.target.blur();
  });
  $('#zoomInput').addEventListener('focus', (e) => e.target.select());
  $('#zoomInput').addEventListener('blur', () => { needsDraw = true; });
  $('#zoomPreset').addEventListener('change', (e) => { const v = e.target.value; e.target.value = ''; if (v === 'fit') zoomFit(); else if (v) setZoom(+v / 100); });
  if (api) api.onMenu((cmd) => COMMANDS[cmd]?.());

  function syncTopbar() {
    renderLayers();
    $('#styleSelect').value = doc.style;
    $('#gridToggle').checked = doc.grid.type !== 'none';
    $('#snapToggle').checked = !!doc.grid.snap;
    $('#borderToggle').checked = !!doc.border;
    document.title = `Pocket-Mapp-Creator — ${doc.name}`;
  }
  $('#styleSelect').onchange = (e) => {
    settleLand();
    const prev = doc.style; doc.style = e.target.value;
    // keep ink-coloured labels readable when switching styles
    for (const o of doc.objects) if (o.t === 'text' && o.color === INK[prev]) o.color = INK[doc.style];
    baseDirty = true; buildLibrary(); commit(); scheduleUsedList(); needsDraw = true;
  };
  $('#snapToggle').onchange = (e) => { doc.grid.snap = e.target.checked; if (e.target.checked && doc.grid.type === 'none') { doc.grid.type = 'square'; $('#gridToggle').checked = true; } commit(); needsDraw = true; status(e.target.checked ? 'Snap to grid on: rooms snap to grid lines, assets to the middle of squares.' : 'Snap to grid off.'); };
  $('#gridToggle').onchange = (e) => { doc.grid.type = e.target.checked ? (doc.grid.type === 'none' ? 'square' : doc.grid.type) : 'none'; if (e.target.checked && doc.grid.type === 'none') doc.grid.type = 'square'; commit(); renderProps(); needsDraw = true; };
  $('#borderToggle').onchange = (e) => { doc.border = e.target.checked; commit(); needsDraw = true; };

  let toastTimer;
  function toast(msg, kind = 'ok') {
    const el = $('#toast'); el.textContent = msg; el.className = `show ${kind}`;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.className = ''; }, kind === 'warn' ? 6000 : 2600);
  }
  let statusTimer;
  function status(msg, coords = false) {
    const el = $('#status');
    if (coords) { if (!el.dataset.msg) el.textContent = msg; return; }
    el.dataset.msg = msg ? '1' : ''; el.textContent = msg;
    clearTimeout(statusTimer); if (msg) statusTimer = setTimeout(() => { el.dataset.msg = ''; }, 5000);
  }

  // ------------------------------------------------------------------ map key, linked maps
  function addLegend() {
    if (layerBlocked('text')) { status(layerBlocked('text')); return; }
    const k = Math.min(doc.width, doc.height) / 1400, hasRealms = doc.objects.some(isRealm);
    const o = { id: uid(), t: 'legend', x: 0, y: 0, s: 1, r: 0, o: 1, title: 'Key', size: Math.round(26 * k), realms: true, places: !hasRealms, font: 'IM Fell English' };
    const L = legendLayout(o), m = 70 * k;
    // put the key in the emptiest corner (fewest items, least land)
    let best = null;
    for (const [cx, cy] of [[m + L.w / 2, doc.height - m - L.h / 2], [doc.width - m - L.w / 2, doc.height - m - L.h / 2], [m + L.w / 2, m + L.h / 2], [doc.width - m - L.w / 2, m + L.h / 2]]) {
      let score = 0;
      for (const q of doc.objects) { if (q.t === 'line' || q.hidden) continue; const qs = objSize(q); if (Math.abs(q.x - cx) < (L.w + qs.w) / 2 && Math.abs(q.y - cy) < (L.h + qs.h) / 2) score += q.t === 'text' ? 6 : 3; }
      for (let i = 0; i < 25; i++) if (landAt(cx + ((i % 5) / 4 - 0.5) * L.w, cy + (Math.floor(i / 5) / 4 - 0.5) * L.h)) score += 0.4;
      if (!best || score < best.score) best = { score, cx, cy };
    }
    o.x = best.cx; o.y = best.cy;
    doc.objects.push(o); setActiveLayer('text', true); selection.clear(); selection.add(o.id); commit(); refreshPanels(); needsDraw = true;
    status('Map key added. Drag it into place; choose what it lists in Properties.');
  }
  async function leaveMapOk() {
    if (!dirtyFlag) return true;
    if (filePath && api) { await save(false); return !dirtyFlag; }
    return confirmBox('Leave this map without saving?', 'This map has never been saved, so its changes will be lost. Cancel, then Save, to keep them.');
  }
  async function openLinkedMap(o) {
    if (!api) { toast('Linked maps open in the desktop app.', 'warn'); return; }
    const r = await api.readMap(o.link, filePath);
    if (!r) { toast(`Can't find the linked map “${o.link.name}”. It may have been moved or renamed: choose it again in Properties → Linked map.`, 'warn'); return; }
    if (!(await leaveMapOk())) return;
    const here = { path: filePath, name: doc.name };
    try { await deserialize(r.data); filePath = r.filePath; document.title = `Pocket-Mapp-Creator — ${doc.name}`; if (here.path) mapStack.push(here); updateBackBtn(); toast(`Opened ${doc.name}`); }
    catch (err) { toast('Could not open the linked map: ' + err.message, 'warn'); }
  }
  async function goBack() {
    const prev = mapStack[mapStack.length - 1]; if (!prev || !api) return;
    const r = await api.readMap({ path: prev.path }, null);
    if (!r) { mapStack.pop(); updateBackBtn(); toast('That map is no longer where it was.', 'warn'); return; }
    if (!(await leaveMapOk())) return;
    mapStack.pop(); await deserialize(r.data); filePath = r.filePath; document.title = `Pocket-Mapp-Creator — ${doc.name}`; updateBackBtn();
  }
  function updateBackBtn() {
    const b = $('#backBtn'); if (!b) return; const prev = mapStack[mapStack.length - 1];
    b.classList.toggle('hidden', !prev); if (prev) { b.textContent = `◀ ${prev.name}`; b.title = `Back to ${prev.name}`; }
  }

  // ------------------------------------------------------------------ random maps (worlds, towns, dungeons)
  function clearForGenerate() {
    settleLand(); selection.clear(); measure = null;
    doc.objects = []; doc.dungeon = null; texMasks = {}; lastTexSnap = {};
    fillMask(pathMask, false); doc.light.on = false;
  }
  function coastGrid(g) {
    // land / sea on a coarse grid plus each land square's distance from the sea (in squares)
    const G = landGrid(g), water = new Uint8Array(G.land.length);
    for (let i = 0; i < water.length; i++) water[i] = G.land[i] ? 0 : 1;
    G.dist = water.some((v) => v) ? MT.distance(water, G.gw, G.gh) : new Float32Array(water.length).fill(999);
    G.g = g; return G;
  }
  function generateWorld(o) {
    const R = MT.rng(o.seed), N = MT.nameGen(MT.rng(o.seed + 11));
    clearForGenerate(); doc.seed = o.seed;
    const shapes = { continent: { scale: 3.2, fall: 0.55 }, islands: { scale: 5.5, fall: 0.35 }, archipelago: { scale: 9, fall: 0.12 } };
    MT.generateLand(landMask, o.seed, o.land, shapes[o.shape] || shapes.continent);
    rebuildBase(true);
    const W = doc.width, H = doc.height, k = Math.min(W, H) / 1400;
    const G = coastGrid(Math.max(8, Math.max(W, H) / 260)), g = G.g;
    const at = (x, y) => { const gx = Math.floor(x / g), gy = Math.floor(y / g); return gx >= 0 && gy >= 0 && gx < G.gw && gy < G.gh ? G.dist[gy * G.gw + gx] * (G.land[gy * G.gw + gx] ? 1 : 0) : 0; };
    const pick = (n, test, tries = 80) => { const out = []; let t = 0; while (out.length < n && t++ < n * tries) { const x = W * (0.05 + R() * 0.9), y = H * (0.07 + R() * 0.86); if (test(x, y)) out.push([x, y]); } return out; };
    const landArea = G.land.reduce((a, v) => a + v, 0) / G.land.length;
    const inland = (d) => (x, y) => at(x, y) * g > d * k;
    const labels = [];
    // mountain ranges
    const peaks = [];
    if (o.mountains) {
      const ranges = Math.max(1, Math.round(landArea * 8 * (W * H) / (3000 * 2000)));
      for (let c = 0; c < ranges; c++) {
        const st = pick(1, inland(150))[0]; if (!st) break;
        let [x, y] = st, ang = R() * Math.PI * 2;
        const len = 6 + Math.floor(R() * 8);
        for (let i = 0; i < len; i++) {
          if (at(x, y) * g > 50 * k) { addAsset(R() < 0.25 ? 'mountain-snow' : R() < 0.5 ? 'mountain-tall' : 'mountain', x, y, { s: (0.8 + R() * 0.4) * k * 1.1, fx: R() < 0.3 }); peaks.push([x, y]); }
          ang += (R() - 0.5) * 0.7; x += Math.cos(ang) * 68 * k; y += Math.sin(ang) * 38 * k;
        }
        if (c === 0 && peaks.length > 3) labels.push(() => { const p = peaks[Math.floor(peaks.length / 2)]; addText(p[0], p[1] + 90 * k, { text: N.mountains(), size: Math.round(24 * k), italic: true, spacing: 5, noIndex: true, o: 0.9 }); });
      }
      pick(Math.round(landArea * 22), inland(50)).forEach(([x, y]) => addAsset(R() < 0.7 ? 'hill' : 'hills', x, y, { s: 0.7 * k }));
      if (R() < 0.5) { const v = pick(1, inland(120))[0]; if (v) addAsset('volcano', v[0], v[1], { s: 0.9 * k }); }
    }
    // forests
    if (o.forests) {
      const groves = pick(Math.max(2, Math.round(landArea * 14)), inland(110));
      groves.forEach(([fx, fy], gi) => {
        const pine = R() < 0.5;
        for (let i = 0; i < 18; i++) { const x = fx + (R() - 0.5) * 240 * k, y = fy + (R() - 0.5) * 130 * k; if (at(x, y) * g > 20 * k && !peaks.some(([px, py]) => Math.hypot(px - x, py - y) < 50 * k)) addAsset(pine ? (R() < 0.85 ? 'pine' : 'tree') : (R() < 0.85 ? 'tree' : 'pine'), x, y, { s: (0.35 + R() * 0.15) * k, fx: R() < 0.5 }); }
        if (gi < 2) labels.push(() => addText(fx, fy + 85 * k, { text: N.forest(), size: Math.round(20 * k), italic: true, spacing: 3, noIndex: true, o: 0.9 }));
      });
    }
    // rivers: from the mountains down to the nearest coast
    if (o.rivers) {
      const nr = Math.max(1, Math.round(landArea * 6));
      const sources = (peaks.length ? peaks.slice() : pick(nr, inland(200))).sort(() => R() - 0.5).slice(0, nr);
      for (const [sx, sy] of sources) {
        let gx = Math.floor(sx / g), gy = Math.floor(sy / g); const pts = [[sx + 20 * k, sy + 30 * k]];
        for (let step = 0; step < 600; step++) {
          const here = G.dist[gy * G.gw + gx]; if (!G.land[gy * G.gw + gx]) break;
          let best = null;
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
            const nx = gx + dx, ny = gy + dy; if (nx < 0 || ny < 0 || nx >= G.gw || ny >= G.gh) continue;
            const v = (G.land[ny * G.gw + nx] ? G.dist[ny * G.gw + nx] : -1) + R() * 0.9;
            if (!best || v < best.v) best = { v, nx, ny };
          }
          if (!best || best.v > here + 0.6) break;
          gx = best.nx; gy = best.ny; pts.push([(gx + 0.5) * g, (gy + 0.5) * g]);
        }
        if (pts.length > 6) insertLow({ id: uid(), t: 'line', kind: 'river', w: Math.round(9 * k * 10) / 10 + 2, o: 1, pts: MT.smoothLine(simplify(pts, g * 0.8), 2) });
      }
    }
    // towns, cities and the roads between them
    const towns = [];
    if (o.towns) {
      const nt = Math.max(3, Math.round(landArea * 16 * Math.sqrt((W * H) / (3000 * 2000))));
      const spots = pick(nt * 3, (x, y) => at(x, y) * g > 30 * k && !peaks.some(([px, py]) => Math.hypot(px - x, py - y) < 70 * k));
      for (const [x, y] of spots) { if (towns.length >= nt) break; if (towns.some((t) => Math.hypot(t.x - x, t.y - y) < 230 * k)) continue; towns.push({ x, y, name: N.town() }); }
      towns.forEach((t, i) => {
        const kind = i === 0 ? 'city' : i < 3 ? 'castle' : at(t.x, t.y) * g < 60 * k && R() < 0.6 ? 'harbour' : R() < 0.15 ? 'tower' : 'village';
        t.kind = kind; addAsset(kind, t.x, t.y, { s: (i < 3 ? 0.62 : 0.5) * k });
        labels.push(() => addText(t.x, t.y + 64 * k, { text: t.name, size: Math.round((i === 0 ? 34 : 28) * k), font: 'IM Fell English', bold: i === 0 }));
      });
      if (o.roads && towns.length > 1) {
        const grid = landGrid(Math.max(6, Math.max(W, H) / 320));
        const done = new Set([0]);
        while (done.size < towns.length) {
          let best = null;
          for (const i of done) for (let j = 0; j < towns.length; j++) if (!done.has(j)) { const d = Math.hypot(towns[i].x - towns[j].x, towns[i].y - towns[j].y); if (!best || d < best.d) best = { i, j, d }; }
          done.add(best.j);
          if (best.d > Math.max(W, H) * 0.45) continue;
          const pts = routeRoad([towns[best.i].x, towns[best.i].y], [towns[best.j].x, towns[best.j].y], { grid });
          if (pts && pts.length > 1) insertLow({ id: uid(), t: 'line', kind: 'road', w: Math.max(2, Math.round(4 * k)), o: 0.9, pts });
        }
      }
    }
    // realms: the land is shared out between rival capitals
    if (o.realms > 0) {
      const caps = (towns.length >= o.realms ? towns.slice(0, o.realms).map((t) => [t.x, t.y]) : pick(o.realms, inland(80)));
      if (caps.length > 1) {
        const cells = MT.voronoiCells(caps, W, H, o.seed, 0.1);
        towns.forEach((t) => addText(t.x, t.y + 64 * k, { text: '', size: 28 * k, _tmp: true }));   // stand-ins so realm names keep clear of town names
        cells.forEach((pts) => finishRealm({ id: uid(), t: 'line', kind: 'realm', w: Math.max(3, Math.round(6 * k)), o: 1, pts }, { name: N.realm(), label: true, quiet: true, size: 44 * k, clear: 80 * k }));
        doc.objects = doc.objects.filter((q) => !q._tmp);
      }
    }
    // the sea
    if (o.sea) {
      const sea = pick(4, (x, y) => !landAt(x, y) && !landAt(x + 90 * k, y) && !landAt(x - 90 * k, y) && !landAt(x, y + 60 * k) && !landAt(x, y - 60 * k), 200);
      if (sea[0]) addAsset(R() < 0.5 ? 'galleon' : 'ship', sea[0][0], sea[0][1], { s: 0.6 * k });
      if (sea[1]) addAsset(R() < 0.5 ? 'sea-serpent' : 'whirlpool', sea[1][0], sea[1][1], { s: 0.7 * k });
      const seaLab = pick(1, (x, y) => x > W * 0.2 && x < W * 0.8 && y > H * 0.15 && y < H * 0.88 && [-1, -0.5, 0, 0.5, 1].every((t) => !landAt(x + t * 260 * k, y) && !landAt(x + t * 260 * k, y - 40 * k) && !landAt(x + t * 260 * k, y + 40 * k)), 300)[0];
      if (seaLab) sea[2] = seaLab; else sea[2] = null;
      if (sea[2]) labels.push(() => addText(sea[2][0], sea[2][1], { text: N.sea(), size: Math.round(42 * k), italic: true, spacing: 8, curve: 14, noIndex: true }));
      if (sea[3] && R() < 0.6) addAsset('longship', sea[3][0], sea[3][1], { s: 0.5 * k });
    }
    if (o.title) {
      addAsset('compass', W - 170 * k, H - 190 * k, { s: 1.1 * k });
      addAsset('cartouche', W / 2, 115 * k, { s: 2.6 * k });
      labels.push(() => addText(W / 2, 115 * k, { text: doc.name, size: Math.round(52 * k), font: 'IM Fell English SC', spacing: 4, halo: false, noIndex: true }));
    }
    labels.forEach((f) => f());
    if (o.key) addLegend();
  }
  function generateTown(o) {
    const R = MT.rng(o.seed), N = MT.nameGen(MT.rng(o.seed + 5));
    clearForGenerate(); doc.seed = o.seed;
    fillMask(landMask, true);
    const W = doc.width, H = doc.height, unit = Math.min(W, H), top = doc.type === 'battle';
    const title = { x: W / 2, y: unit * 0.07, w: unit * 0.5, h: unit * 0.1 };
    const T = MT.townLayout(W, H, { size: o.size, topdown: top, reserve: [title] }, R);
    // the river runs across the map but well clear of the market square
    let river = null;
    if (o.river) {
      const [cx, cy] = T.centre, side = R() < 0.5 ? -1 : 1, off = T.square.r + unit * 0.13;
      const yc = clamp(cy + side * off, H * 0.12, H * 0.9), tilt = (R() - 0.5) * H * 0.35, pts = [];
      for (let k = 0; k <= 14; k++) { const t = k / 14; pts.push([-40 + (W + 80) * t, yc + tilt * (t - cx / W) + Math.sin(t * 7 + o.seed) * H * 0.035]); }
      river = { id: uid(), t: 'line', kind: 'river', w: unit * 0.04, o: 1, pts: MT.smoothLine(pts, 2) };
    }
    const nearRiver = (x, y, pad) => river && river.pts.some(([px, py]) => Math.hypot(px - x, py - y) < river.w / 2 + pad);
    // streets and the market square, painted as ground
    const pc = pathMask.getContext('2d'); pc.save(); pc.scale(maskScale, maskScale); pc.strokeStyle = pc.fillStyle = '#fff'; pc.lineCap = pc.lineJoin = 'round';
    for (const st of T.streets) { pc.lineWidth = st.w; pc.beginPath(); st.pts.forEach(([x, y], k) => (k ? pc.lineTo(x, y) : pc.moveTo(x, y))); pc.stroke(); }
    pc.beginPath(); pc.arc(T.square.x, T.square.y, T.square.r, 0, 7); pc.fill(); pc.restore();
    if (top) { const m = texMask('grass', true).getContext('2d'); m.fillStyle = 'rgba(255,255,255,.55)'; m.fillRect(0, 0, m.canvas.width, m.canvas.height); }
    if (river) insertLow(river);
    // buildings: sized from each picture's own width so they fill their lot
    const place = (a, x, y, size, r = 0, flip = false) => { const inf = assetInfo(a); if (!inf) return null; return addAsset(a, x, y, { s: size / (inf.w * inf.base), r, fx: flip }); };
    const special = top ? ['round-tower-top', o.size === 'town' || o.size === 'city' ? 'city-block-top' : 'house-top'] : ['tavern', 'chapel', 'blacksmith', 'market-stall', 'market-stall', 'tavern'];
    const common = top ? ['house-top'] : (o.eastern ? ['eastern-house', 'house', 'eastern-house', 'cottage'] : ['house', 'cottage', 'house', 'row-houses', 'cottage']);
    let n = 0;
    T.lots.forEach((L) => {
      if (nearRiver(L.x, L.y, T.bsize * 0.75)) return;
      let a = n < special.length && R() < 0.9 ? special[n] : common[Math.floor(R() * common.length)];
      if (!top && o.size === 'city' && n === special.length) a = 'castle-keep';
      if (o.eastern && !top && n === 1) a = 'pagoda';
      const size = T.bsize * (a === 'city-block-top' ? 1.7 : a === 'row-houses' || a === 'castle-keep' ? 1.5 : a === 'market-stall' ? 0.8 : 1.05) * (0.92 + R() * 0.16);
      place(a, L.x, L.y, size, top ? Math.round(((L.angle * 180) / Math.PI + 360) % 180) : 0, !top && R() < 0.5);
      n++;
    });
    place(o.size === 'hamlet' || top ? 'well' : 'fountain', T.square.x, T.square.y, T.bsize * 0.8);
    if (o.eastern && !top) place('torii-gate', T.square.x, T.square.y - T.square.r * 0.95, T.bsize);
    // bridges wherever a street crosses the river
    if (river) for (const st of T.streets) {
      for (let k = 1; k < st.pts.length; k++) {
        const [ax, ay] = st.pts[k - 1], [bx, by] = st.pts[k];
        for (let q = 1; q < river.pts.length; q++) {   // where the street segment actually crosses the river
          const [cx2, cy2] = river.pts[q - 1], [dx2, dy2] = river.pts[q];
          const den = (bx - ax) * (dy2 - cy2) - (by - ay) * (dx2 - cx2); if (Math.abs(den) < 1e-9) continue;
          const t = ((cx2 - ax) * (dy2 - cy2) - (cy2 - ay) * (dx2 - cx2)) / den, u = ((cx2 - ax) * (by - ay) - (cy2 - ay) * (bx - ax)) / den;
          if (t < 0 || t > 1 || u < 0 || u > 1) continue;
          const x = ax + (bx - ax) * t, y = ay + (by - ay) * t;
          if (x > 0 && x < W && y > 0 && y < H) place('stone-bridge-top', x, y, river.w * 2.6, Math.round((Math.atan2(by - ay, bx - ax) * 180) / Math.PI));
        }
      }
    }
    // trees round the edge of the settlement
    const busy = (x, y) => nearRiver(x, y, T.bsize * 0.4) || doc.objects.some((q) => q.t === 'asset' && Math.hypot(q.x - x, q.y - y) < T.bsize * 0.9) || T.streets.some((st) => st.pts.some(([px, py]) => Math.hypot(px - x, py - y) < st.w)) || (Math.abs(x - title.x) < title.w / 2 && Math.abs(y - title.y) < title.h / 2);
    for (let k = 0, m = 0; k < 500 && m < (top ? 40 : 28); k++) { const x = R() * W, y = R() * H; if (Math.hypot(x - T.centre[0], y - T.centre[1]) < unit * 0.16 || busy(x, y)) continue; place(top ? 'tree-top' : 'tree-34', x, y, T.bsize * (0.7 + R() * 0.5), top ? Math.round(R() * 360) : 0, R() < 0.5); m++; }
    if (!top && o.size !== 'hamlet') for (let k = 0; k < 30; k++) { const a = R() * 6.283, x = T.centre[0] + Math.cos(a) * unit * 0.36, y = T.centre[1] + Math.sin(a) * unit * 0.3; if (x > 60 && y > 60 && x < W - 60 && y < H - 60 && !busy(x, y)) { place('windmill', x, y, T.bsize * 1.1); break; } }
    // town wall with a gatehouse wherever a street leaves the town
    if (o.walls && T.lots.length) {
      const rx = Math.min(W * 0.46, Math.max(...T.lots.map((L) => Math.abs(L.x - T.centre[0]))) + T.bsize * 0.9), ry = Math.min(H * 0.46, Math.max(...T.lots.map((L) => Math.abs(L.y - T.centre[1]))) + T.bsize * 0.9);
      const ring = []; for (let k = 0; k <= 48; k++) { const a = (k / 48) * Math.PI * 2; ring.push([T.centre[0] + Math.cos(a) * rx, T.centre[1] + Math.sin(a) * ry]); }
      insertLow({ id: uid(), t: 'line', kind: 'wall', w: unit * 0.012, o: 1, pts: ring });
      const outside = ([x, y]) => ((x - T.centre[0]) / rx) ** 2 + ((y - T.centre[1]) / ry) ** 2 >= 1;
      for (const st of T.streets) for (let k = 1; k < st.pts.length; k++) {
        if (outside(st.pts[k - 1]) === outside(st.pts[k])) continue;
        const [ax, ay] = st.pts[k - 1], [bx, by] = st.pts[k];
        place(top ? 'round-tower-top' : 'gatehouse', (ax + bx) / 2, (ay + by) / 2, T.bsize * 1.2);
      }
    }
    const name = o.name || N.town();
    doc.name = name;
    addText(title.x, title.y, { text: name, size: Math.round(unit * 0.05), font: 'IM Fell English SC', spacing: 6, noIndex: true });
  }
  function generateDungeon(o) {
    const R = MT.rng(o.seed);
    if (o.replace) clearForGenerate();
    doc.seed = o.seed;
    const z = doc.grid.type === 'square' ? doc.grid.size : 70;
    if (doc.grid.type === 'none') doc.grid.type = 'square';
    fillMask(landMask, true);
    if (o.rock) { const m = texMask('rock', true).getContext('2d'); m.fillStyle = '#fff'; m.fillRect(0, 0, m.canvas.width, m.canvas.height); }
    const cols = Math.floor(doc.width / z), rows = Math.floor(doc.height / z);
    const sizes = { small: [3, 5], medium: [3, 7], large: [5, 10] }[o.roomSize] || [3, 7];
    const L = MT.dungeonLayout(cols, rows, { rooms: o.rooms, minSize: sizes[0], maxSize: sizes[1], corridor: o.corridor, loops: Math.round(o.rooms / 4) }, R);
    if (!L.rooms.length) { toast('The map is too small for that dungeon. Make the map bigger or the rooms smaller.', 'warn'); return; }
    const D = dungeonData(); D.size = z; D.cells = L.cells; D.v = (D.v || 0) + 1; D.fill = o.floor || 'stone'; D.wall = o.wall || 'stone'; D.wallW = Math.max(6, Math.round(z * 0.17));
    const sc = z / 70, busy = new Set();
    const centreOf = (c) => [(c[0] + 0.5) * z, (c[1] + 0.5) * z];
    if (o.doors) for (const d of L.doors) {
      const roll = R(); if (roll < 0.22) continue;
      const kind = roll > 0.92 ? 'secret-door' : 'door';
      addAsset(kind, d.x * z, d.y * z, { s: sc * 0.95, r: d.vertical ? 90 : 0 });
      busy.add(`${d.inside[0]},${d.inside[1]}`);
    }
    if (o.furnish) {
      const FURN = ['barrel', 'crate', 'chest', 'table', 'bed', 'bones', 'rubble', 'statue', 'pillar', 'spike-pit', 'cauldron', 'sarcophagus', 'weapon-rack', 'bookshelf', 'cobweb'];
      L.rooms.forEach((rm, i) => {
        const inside = []; for (let y = rm.y + 1; y < rm.y + rm.h - 1; y++) for (let x = rm.x + 1; x < rm.x + rm.w - 1; x++) if (L.roomOf.get(`${x},${y}`) === i && !busy.has(`${x},${y}`)) inside.push([x, y]);
        const take = () => { if (!inside.length) return null; const c = inside.splice(Math.floor(R() * inside.length), 1)[0]; busy.add(`${c[0]},${c[1]}`); return c; };
        const special = i === 0 ? 'stairs' : i === L.rooms.length - 1 ? (R() < 0.5 ? 'treasure-pile' : 'altar') : null;
        if (special) { const c = take(); if (c) addAsset(special, ...centreOf(c), { s: sc * 0.95 }); }
        const n = 1 + Math.floor(R() * Math.min(4, inside.length / 3));
        for (let j = 0; j < n; j++) { const c = take(); if (c) addAsset(FURN[Math.floor(R() * FURN.length)], ...centreOf(c), { s: sc * (0.8 + R() * 0.15), r: Math.floor(R() * 4) * 90 }); }
        // a torch on the north wall of most rooms
        if (R() < 0.7) { const tx = rm.x + Math.floor(rm.w / 2); if (L.roomOf.get(`${tx},${rm.y}`) === i) addAsset('wall-torch', (tx + 0.5) * z, rm.y * z + z * 0.32, { s: sc * 0.75 }); }
      });
    }
    if (o.numbers) L.rooms.forEach((rm, i) => {
      let c = [Math.floor(rm.x + rm.w / 2), Math.floor(rm.y + rm.h / 2)];
      for (let y = rm.y; busy.has(`${c[0]},${c[1]}`) && y < rm.y + rm.h; y++) for (let x = rm.x; x < rm.x + rm.w; x++) if (L.roomOf.get(`${x},${y}`) === i && !busy.has(`${x},${y}`)) { c = [x, y]; break; }
      busy.add(`${c[0]},${c[1]}`);
      addText((c[0] + 0.5) * z, (c[1] + 0.5) * z, { text: String(i + 1), size: Math.round(z * 0.42), font: 'Cinzel', bold: true, halo: true, color: INK[doc.style], noIndex: true });
    });
    if (o.dark) { doc.light.on = true; doc.light.dark = 0.72; }
  }
  function generateDialog(kind) {
    let tab = kind || (doc.type === 'battle' ? 'dungeon' : doc.type === 'town' ? 'town' : 'world');
    const seed = () => Math.floor(Math.random() * 1e6);
    const render = () => {
      openDialog(`<h2>Generate a random map</h2>
        <div class="seg" style="margin-bottom:10px">${[['world', 'World'], ['town', 'Town'], ['dungeon', 'Dungeon']].map(([k, v]) => `<button data-tab="${k}" class="${tab === k ? 'on' : ''}">${v}</button>`).join('')}</div>
        ${tab === 'world' ? `
          <div class="row"><label>Land</label><select id="gShape"><option value="continent">One big continent</option><option value="islands">A few large islands</option><option value="archipelago">Many small islands</option></select></div>
          <div class="row"><label>Amount of land</label><input type="range" id="gLand" min="0.2" max="0.65" step="0.01" value="0.42"></div>
          <div class="row"><label>Realms</label><input type="number" id="gRealms" min="0" max="10" value="4" style="width:70px"> <span class="muted">0 for none</span></div>
          <div class="btnrow"><label class="chk"><input type="checkbox" id="gMount" checked> Mountains</label><label class="chk"><input type="checkbox" id="gForest" checked> Forests</label><label class="chk"><input type="checkbox" id="gRivers" checked> Rivers</label><label class="chk"><input type="checkbox" id="gTowns" checked> Towns &amp; names</label><label class="chk"><input type="checkbox" id="gRoads" checked> Roads</label><label class="chk"><input type="checkbox" id="gSea" checked> Ships &amp; sea names</label><label class="chk"><input type="checkbox" id="gTitle" checked> Title &amp; compass</label><label class="chk"><input type="checkbox" id="gKey" checked> Map key</label></div>`
        : tab === 'town' ? `
          <div class="row"><label>Size</label><select id="gSize"><option value="hamlet">Hamlet</option><option value="village" selected>Village</option><option value="town">Town</option><option value="city">City</option></select></div>
          <div class="row"><label>Name</label><input type="text" id="gName" placeholder="Leave empty for a random name"></div>
          <div class="btnrow"><label class="chk"><input type="checkbox" id="gWalls"> Town walls</label><label class="chk"><input type="checkbox" id="gRiver" checked> River</label><label class="chk"><input type="checkbox" id="gEast"> Eastern style (pagoda, shrine gate)</label></div>
          <p class="muted">${doc.type === 'battle' ? 'This is a battle map, so buildings are drawn from above.' : 'Buildings are drawn in 3/4 view. On a Battle Map they are drawn from above.'}</p>`
        : `
          <div class="row"><label>Rooms</label><input type="range" id="gRooms" min="3" max="24" value="9"> <span id="gRoomsV">9</span></div>
          <div class="row"><label>Room size</label><select id="gRSize"><option value="small">Small</option><option value="medium" selected>Medium</option><option value="large">Large</option></select></div>
          <div class="row"><label>Corridors</label><select id="gCorr"><option value="1">1 square wide</option><option value="2">2 squares wide</option></select></div>
          <div class="row"><label>Floor / wall</label><select id="gFloor">${Object.entries(MT.TEXTURES).map(([k, v]) => `<option value="${k}" ${k === 'stone' ? 'selected' : ''}>${v}</option>`).join('')}</select><select id="gWall">${Object.entries(WALL_KINDS).filter(([k]) => k !== 'none').map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></div>
          <div class="btnrow"><label class="chk"><input type="checkbox" id="gDoors" checked> Doors</label><label class="chk"><input type="checkbox" id="gFurn" checked> Furniture &amp; traps</label><label class="chk"><input type="checkbox" id="gNum" checked> Room numbers</label><label class="chk"><input type="checkbox" id="gRock" checked> Solid rock around it</label><label class="chk"><input type="checkbox" id="gDark"> Dark, lit by torches</label></div>
          <p class="muted">Each room is ${doc.grid.type === 'square' ? doc.grid.size : 70} px per square (the grid's cell size).</p>`}
        <div class="row"><label>Seed</label><input type="number" id="gSeed" value="${seed()}" style="width:110px"><button class="mini" id="gDice" title="New random seed">🎲</button><span class="muted">the same seed makes the same map</span></div>
        <p class="muted" style="color:#c9a64a">${doc.objects.length || (doc.dungeon && doc.dungeon.cells.length) ? 'This replaces everything on the current map. You can undo it with Ctrl+Z.' : ''}</p>
        <div class="actions"><button id="gCancel">Cancel</button><button class="primary" id="gGo">Generate</button></div>`, (d) => {
        d.querySelectorAll('[data-tab]').forEach((b) => b.onclick = () => { tab = b.dataset.tab; render(); });
        d.querySelector('#gCancel').onclick = closeDialog;
        d.querySelector('#gDice').onclick = () => { d.querySelector('#gSeed').value = seed(); };
        const rr = d.querySelector('#gRooms'); if (rr) rr.oninput = () => { d.querySelector('#gRoomsV').textContent = rr.value; };
        d.querySelector('#gGo').onclick = () => {
          const v = (id) => d.querySelector(id), chk = (id) => !!v(id)?.checked, sd = +v('#gSeed').value || seed();
          let opts;
          if (tab === 'world') opts = { seed: sd, shape: v('#gShape').value, land: +v('#gLand').value, realms: clamp(+v('#gRealms').value || 0, 0, 10), mountains: chk('#gMount'), forests: chk('#gForest'), rivers: chk('#gRivers'), towns: chk('#gTowns'), roads: chk('#gRoads'), sea: chk('#gSea'), title: chk('#gTitle'), key: chk('#gKey') };
          else if (tab === 'town') opts = { seed: sd, size: v('#gSize').value, name: v('#gName').value.trim(), walls: chk('#gWalls'), river: chk('#gRiver'), eastern: chk('#gEast') };
          else opts = { seed: sd, rooms: +v('#gRooms').value, roomSize: v('#gRSize').value, corridor: +v('#gCorr').value, floor: v('#gFloor').value, wall: v('#gWall').value, doors: chk('#gDoors'), furnish: chk('#gFurn'), numbers: chk('#gNum'), rock: chk('#gRock'), dark: chk('#gDark'), replace: true };
          closeDialog(); runGenerator(tab, opts);
        };
      });
    };
    render();
  }
  function runGenerator(tab, opts) {
    status('Generating…');
    const prevDepth = ui.depthSort; ui.depthSort = true;
    try {
      if (tab === 'world') { if (doc.type !== 'world') { doc.type = 'world'; ui.kind = 'world'; } generateWorld(opts); }
      else if (tab === 'town') { if (doc.type === 'world') { doc.type = 'town'; ui.kind = 'town'; } generateTown(opts); }
      else { if (doc.type !== 'battle') { doc.type = 'battle'; ui.kind = 'battle'; } generateDungeon(opts); }
    } finally { ui.depthSort = prevDepth; }
    baseDirty = true; rebuildBase(true); buildLibrary(); syncTopbar(); commit(); refreshPanels(); needsDraw = true;
    status(`Generated with seed ${opts.seed}. Everything can be edited, moved or deleted.`);
  }

  // ------------------------------------------------------------------ example map
  function buildExample() {
    const W = doc.width, H = doc.height, R = MT.rng(doc.seed);
    const landAt = (x, y) => {
      const c = landMask.getContext('2d', { willReadFrequently: true });
      return c.getImageData(Math.floor(x * maskScale), Math.floor(y * maskScale), 1, 1).data[3] > 127;
    };
    const coastDist = (x, y, r) => { for (let a = 0; a < 6.28; a += 0.8) if (!landAt(x + Math.cos(a) * r, y + Math.sin(a) * r)) return false; return true; };
    const pick = (n, test) => { const out = []; let tries = 0; while (out.length < n && tries++ < n * 60) { const x = W * (0.06 + R() * 0.88), y = H * (0.08 + R() * 0.84); if (test(x, y)) out.push([x, y]); } return out; };
    const k = Math.min(W, H) / 1400;
    // mountain chains
    for (let c = 0; c < 3; c++) {
      const [sx, sy] = pick(1, (x, y) => landAt(x, y) && coastDist(x, y, 160 * k))[0] || [W / 2, H / 2];
      let x = sx, y = sy, ang = R() * Math.PI * 2;
      for (let i = 0; i < 9; i++) {
        if (landAt(x, y) && coastDist(x, y, 60 * k)) addAsset(R() < 0.25 ? 'mountain-snow' : R() < 0.5 ? 'mountain-tall' : 'mountain', x, y, { s: (0.8 + R() * 0.4) * k * 1.1 });
        ang += (R() - 0.5) * 0.7; x += Math.cos(ang) * 70 * k; y += Math.sin(ang) * 40 * k;
      }
    }
    pick(10, (x, y) => landAt(x, y) && coastDist(x, y, 50 * k)).forEach(([x, y]) => addAsset('hill', x, y, { s: 0.7 * k }));
    // forests
    for (const [fx, fy] of pick(5, (x, y) => landAt(x, y) && coastDist(x, y, 120 * k))) {
      for (let i = 0; i < 16; i++) { const x = fx + (R() - 0.5) * 220 * k, y = fy + (R() - 0.5) * 120 * k; if (landAt(x, y) && coastDist(x, y, 20 * k)) addAsset(R() < 0.5 ? 'pine' : 'tree', x, y, { s: (0.35 + R() * 0.15) * k, fx: R() < 0.5 }); }
    }
    const places = pick(6, (x, y) => landAt(x, y) && coastDist(x, y, 40 * k));
    const names = ['Eldmoor', 'Harrowgate', 'Thornwick', 'Dunmere', 'Ashford', 'Greyhaven'];
    places.forEach(([x, y], i) => {
      addAsset(i === 0 ? 'city' : i === 1 ? 'castle' : i === 2 ? 'tower' : 'village', x, y, { s: (i < 2 ? 0.6 : 0.5) * k });
      addText(x, y + 70 * k, { text: names[i], size: Math.round(30 * k), font: 'IM Fell English' });
    });
    const sea = pick(3, (x, y) => !landAt(x, y) && !landAt(x + 80 * k, y) && !landAt(x - 80 * k, y));
    if (sea[0]) addAsset('ship', sea[0][0], sea[0][1], { s: 0.6 * k });
    if (sea[1]) addAsset('sea-serpent', sea[1][0], sea[1][1], { s: 0.7 * k });
    if (sea[2]) addText(sea[2][0], sea[2][1], { text: 'The Sundering Sea', size: Math.round(46 * k), italic: true, spacing: 8, curve: 18 });
    addAsset('compass', W - 170 * k, H - 190 * k, { s: 1.1 * k });
    addAsset('cartouche', W / 2, 115 * k, { s: 2.6 * k });
    addText(W / 2, 115 * k, { text: doc.name, size: Math.round(52 * k), font: 'IM Fell English SC', spacing: 4, halo: false });
    commit();
  }

  // ------------------------------------------------------------------ boot
  window.addEventListener('resize', () => { resizeStage(); });
  new ResizeObserver(resizeStage).observe(stage.parentElement);
  resizeStage();
  window.addEventListener('beforeunload', (e) => { if (dirtyFlag && !api?.testMode) { e.returnValue = ''; } });

  async function boot() {
    await document.fonts.load('30px "IM Fell English"').catch(() => {});
    if (api && api.testMode && api.testQuick) { loop(); try { const r = await QUICK[api.testQuick](api.testMode); document.title = `TESTDONE ${r || ''}`; } catch (err) { document.title = `TESTDONE ERROR ${err && err.stack}`; } return; }
    if (api && api.testMode) { await runTest(api.testMode); return; }
    newMap({ type: 'world', style: 'parchment', start: 'sea', name: 'The Known World' });
    setTool('land');
    loop();
    if (api && api.autosaveRead) { try { recovery = await api.autosaveRead(); } catch (_) { recovery = null; } }
    setTimeout(() => newMapDialog(true), 50);
    // autosave every minute while there are unsaved changes (not mid-drag or mid landmass edit)
    setInterval(() => {
      if (!api || !api.autosaveWrite || !dirtyFlag || dragState || landSel || painting || texPainting) return;
      try { api.autosaveWrite(serialize()); } catch (_) { /* best effort */ }
    }, 60000);
  }

  // quick checks used while developing (MAPP_TEST=<dir> MAPP_QUICK=<name>)
  const QUICK = {};
  const qwait = (ms) => new Promise((r) => setTimeout(r, ms));
  const qshot = async (dir, name) => { needsDraw = true; await qwait(400); await api.testCapture(`${dir}/${name}.png`); };
  QUICK.styles = async (dir) => {
    for (const st of ['copperplate', 'night']) {
      newMap({ type: 'world', style: st, start: 'example', name: 'The Known World', seed: 7 });
      await qwait(2500); await whenImagesReady(); await qshot(dir, `style-${st}`);
      const ex = await renderExportCanvas(1, false); await api.testWrite(`${dir}/export-${st}.png`, ex.toDataURL('image/png'));
    }
    return 'styles ok';
  };
  QUICK.gen = async (dir) => {
    const out = [];
    const ex = async (name) => { const c = await renderExportCanvas(Math.min(1, 1600 / Math.max(doc.width, doc.height)), true); await api.testWrite(`${dir}/${name}.png`, c.toDataURL('image/png')); };
    newMap({ type: 'world', style: 'parchment', start: 'sea', name: 'Generated World' }); await qwait(300);
    runGenerator('world', { seed: 4242, shape: 'continent', land: 0.42, realms: 4, mountains: true, forests: true, rivers: true, towns: true, roads: true, sea: true, title: true, key: true });
    await qwait(1500); await whenImagesReady(); await ex('gen-world');
    out.push(`world:${doc.objects.length}:realms=${doc.objects.filter(isRealm).length}:roads=${doc.objects.filter((o) => o.kind === 'road').length}:rivers=${doc.objects.filter((o) => o.kind === 'river').length}`);
    runGenerator('world', { seed: 77, shape: 'archipelago', land: 0.35, realms: 0, mountains: true, forests: true, rivers: false, towns: true, roads: true, sea: true, title: true, key: false });
    await qwait(1200); await whenImagesReady(); await ex('gen-archipelago');
    newMap({ type: 'town', style: 'colour', start: 'sea', name: 'Town' }); await qwait(300);
    runGenerator('town', { seed: 9, size: 'town', walls: true, river: true, eastern: false });
    await qwait(1500); await whenImagesReady(); await ex('gen-town'); out.push(`town:${doc.objects.length}`);
    newMap({ type: 'battle', style: 'colour', start: 'sea', name: 'Battle town', width: 2100, height: 1400 }); await qwait(300);
    runGenerator('town', { seed: 3, size: 'village', walls: false, river: true, eastern: false });
    await qwait(1500); await whenImagesReady(); await ex('gen-town-top'); out.push(`towntop:${doc.objects.length}`);
    newMap({ type: 'battle', style: 'parchment', start: 'sea', name: 'Crypt', width: 2100, height: 1400 }); await qwait(300);
    runGenerator('dungeon', { seed: 12, rooms: 9, roomSize: 'medium', corridor: 1, floor: 'stone', wall: 'stone', doors: true, furnish: true, numbers: true, rock: true, dark: false, replace: true });
    await qwait(1500); await whenImagesReady(); await ex('gen-dungeon'); out.push(`dungeon:cells=${doc.dungeon.cells.length}:objs=${doc.objects.length}`);
    doc.light.on = true; needsDraw = true; await qwait(300); await ex('gen-dungeon-dark');
    await qshot(dir, 'ui-dungeon');
    return out.join(' ');
  };
  QUICK.features = async (dir) => {
    const out = [];
    newMap({ type: 'world', style: 'parchment', start: 'example', name: 'The Known World', seed: 7 }); await qwait(2000); await whenImagesReady();
    const r = stage.getBoundingClientRect();
    const ev = (type, mx, my, extra = {}) => { const sx = r.left + view.ox + mx * view.zoom, sy = r.top + view.oy + my * view.zoom; stage.dispatchEvent(new PointerEvent(type, { clientX: sx, clientY: sy, button: 0, buttons: type === 'pointerup' ? 0 : 1, pointerId: 1, bubbles: true, ...extra })); };
    // realm drawn with the Lines tool
    setTool('line'); ui.lineKind = 'realm'; renderToolOptions();
    const ring = []; for (let a = 0; a < 6.3; a += 0.2) ring.push([1800 + Math.cos(a) * 700, 1100 + Math.sin(a) * 500]);
    ev('pointerdown', ...ring[0]); ring.slice(1).forEach((p) => ev('pointermove', ...p)); ev('pointerup', ...ring[ring.length - 1]);
    const realm = doc.objects.find(isRealm); out.push(`realm=${!!realm}:${realm && realm.name}:label=${!!(realm && findObj(realm.labelId))}`);
    // routed road between two towns
    ui.lineKind = 'road'; ui.autoRoute = true; renderToolOptions();
    const towns = doc.objects.filter((o) => o.t === 'asset' && ['city', 'castle', 'village'].includes(o.a));
    ev('pointerdown', towns[0].x, towns[0].y); ev('pointermove', towns[1].x, towns[1].y); ev('pointerup', towns[1].x, towns[1].y);
    const road = doc.objects.filter((o) => o.kind === 'road').pop(); out.push(`road=${road ? road.pts.length : 0}pts`);
    // map key
    addLegend(); const key = doc.objects.find((o) => o.t === 'legend'); key.places = true; out.push(`key=${!!key}:${legendRows(key).length}rows`);
    // measure
    setTool('measure'); ev('pointerdown', 500, 500); ev('pointermove', 1500, 500); ev('pointerup', 1500, 500); out.push(`measure=${measureLabel(1000)}`);
    // layer effects + lighting
    doc.layers.text.fx = { shadow: true }; doc.layers.assets.fx = { glow: true, glowColor: '#ffe9a0', opacity: 0.95 };
    addAsset('campfire', 1500, 900, { s: 0.6 }); doc.light.on = true; doc.light.dark = 0.5;
    needsDraw = true; await qwait(500); await qshot(dir, 'feat-ui');
    const c = await renderExportCanvas(0.5, false); await api.testWrite(`${dir}/feat-export.png`, c.toDataURL('image/png'));
    doc.light.on = false; doc.layers.text.fx = null; doc.layers.assets.fx = null;
    // marsh / jungle textures and the two new styles
    texDab(900, 900, 400, 'marsh', false, 0.6, 0.9, true); texDab(1300, 700, 400, 'jungle', false, 0.6, 0.9, true); rebuildTexComposite();
    // SVG
    const svg = await buildSvg({ grid: false }); await api.testWrite(`${dir}/feat.svg.txt`, 'data:text/plain;base64,' + btoa(unescape(encodeURIComponent(svg))));
    out.push(`svg=${Math.round(svg.length / 1024)}KB:uses=${(svg.match(/<use /g) || []).length}:texts=${(svg.match(/<text /g) || []).length}:fonts=${(svg.match(/@font-face/g) || []).length}`);
    // PDF
    const pdf = await exportPage('pdf', 'A4', 'auto', 0.25, false); out.push(`pdf=${!!pdf}`);
    // serialize round trip keeps everything
    const data = serialize(); await deserialize(data); await qwait(500);
    out.push(`reload realms=${doc.objects.filter(isRealm).length} key=${doc.objects.filter((o) => o.t === 'legend').length} scale=${doc.scale.name}`);
    // undo of dungeon carving
    newMap({ type: 'battle', style: 'night', start: 'land', name: 'Night test' }); await qwait(300);
    setTool('dungeon'); ui.dgMode = 'room'; ev('pointerdown', 150, 150); ev('pointermove', 600, 500); ev('pointerup', 600, 500);
    ui.dgMode = 'cell'; ev('pointerdown', 600, 300); ev('pointermove', 1100, 300); ev('pointerup', 1100, 300);
    const n1 = doc.dungeon.cells.length; undo(); const n2 = doc.dungeon.cells.length; redo(); const n3 = doc.dungeon.cells.length;
    out.push(`dg=${n1}/${n2}/${n3}`);
    addAsset('wall-torch', 375, 175, { s: 0.8 }); doc.light.on = true; needsDraw = true; await qwait(400); await qshot(dir, 'feat-night-dungeon');
    return out.join(' ');
  };
  QUICK.svg = async (dir) => {
    newMap({ type: 'world', style: 'parchment', start: 'example', name: 'The Known World', seed: 7 }); await qwait(2000); await whenImagesReady();
    doc.objects.find((o) => o.t === 'asset' && o.a === 'castle').ef = { shadow: true, glow: true, glowColor: '#ff0000' };
    doc.objects.find((o) => o.t === 'asset' && o.a === 'city').ef = { tint: '#3060ff', tintAmt: 0.5 };
    runGenerator('world', { seed: 99, shape: 'continent', land: 0.42, realms: 3, mountains: true, forests: true, rivers: true, towns: true, roads: true, sea: true, title: true, key: true });
    await qwait(800); await whenImagesReady();
    const svg = await buildSvg({ grid: false });
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    const im = new Image(); im.src = url; await im.decode();
    const c = document.createElement('canvas'); c.width = 1500; c.height = 1000; c.getContext('2d').drawImage(im, 0, 0, 1500, 1000);
    await api.testWrite(`${dir}/svg-render.png`, c.toDataURL('image/png'));
    const ref = await renderExportCanvas(0.5, false); await api.testWrite(`${dir}/svg-ref.png`, ref.toDataURL('image/png'));
    return `svg ${svg.length}`;
  };
  QUICK.links = async (dir) => {
    newMap({ type: 'town', style: 'colour', start: 'land', name: 'Linked Town' }); await qwait(300);
    const townFile = `${dir}/linked-town.mapp`; await api.saveProject(serialize(), townFile);
    newMap({ type: 'world', style: 'parchment', start: 'example', name: 'World With Link', seed: 7 }); await qwait(1500);
    const worldFile = `${dir}/world-link.mapp`; filePath = worldFile;
    const castle = doc.objects.find((o) => o.a === 'castle'); castle.link = { path: townFile, rel: 'linked-town.mapp', name: 'Linked Town' };
    await api.saveProject(serialize(), worldFile); dirtyFlag = false;
    needsDraw = true; await qwait(300); await qshot(dir, 'link-badge');
    await openLinkedMap(castle); const a = doc.name; const back = !$('#backBtn').classList.contains('hidden');
    await goBack(); const b = doc.name;
    return `opened=${a} back=${back} returned=${b} linkKept=${!!doc.objects.find((o) => o.link)}`;
  };
  // automated screenshot test (MAPP_TEST=<dir>)
  async function runTest(dir) {
    loop();
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const shot = async (name) => { needsDraw = true; await wait(400); await api.testCapture(`${dir}/${name}.png`); };
    newMap({ type: 'world', style: 'parchment', start: 'example', name: 'The Known World', seed: 7 });
    await wait(2500); await whenImagesReady(); await shot('01-parchment-world');
    const sample = doc.objects.find((o) => o.t === 'asset' && o.a === 'castle'); if (sample) { selection.add(sample.id); refreshPanels(); openGroups.add('a:mountain'); renderUsedList(); }
    await shot('02-selection');
    selection.clear(); refreshPanels();
    const ex = await renderExportCanvas(1, false); const exUrl = ex.toDataURL('image/png');
    await api.testWrite(`${dir}/export-parchment.png`, exUrl); window.__exportPng = exUrl.length;
    await api.testWrite(`${dir}/export-parchment.jpg`, ex.toDataURL('image/jpeg', 0.9));
    $('#styleSelect').value = 'colour'; $('#styleSelect').onchange({ target: $('#styleSelect') }); await wait(2500); await shot('03-colour-world');
    $('#styleSelect').value = 'watercolour'; $('#styleSelect').onchange({ target: $('#styleSelect') }); await wait(2500); await shot('04-watercolour-world');
    newMap({ type: 'battle', style: 'colour', start: 'land', name: 'Forest Clearing' });
    for (let i = 0; i < 18; i++) addAsset('tree-top', 80 + Math.random() * 1240, 80 + Math.random() * 1240, { s: 1 + Math.random() * 0.5, r: Math.random() * 360 });
    addAsset('campfire', 700, 700, { s: 1 }); addAsset('tent', 560, 620, { s: 1.2, r: 20 }); addAsset('barrel', 840, 600); addAsset('crate', 880, 640, { r: 12 }); addAsset('rock', 400, 900, { s: 1.3 });
    const pc = pathMask.getContext('2d'); pc.fillStyle = '#fff'; pc.beginPath(); pc.ellipse(700 * maskScale, 700 * maskScale, 260 * maskScale, 200 * maskScale, 0, 0, 7); pc.fill();
    const lc = landMask.getContext('2d'); lc.globalCompositeOperation = 'destination-out'; lc.beginPath(); lc.ellipse(1150 * maskScale, 1150 * maskScale, 220 * maskScale, 160 * maskScale, 0, 0, 7); lc.fill(); lc.globalCompositeOperation = 'source-over';
    baseDirty = true; commit(); setTool('stamp'); stampKey = 'tree-top'; renderToolOptions(); buildLibrary();
    await wait(2500); await whenImagesReady(); await shot('05-battle-colour');
    newMap({ type: 'town', style: 'parchment', start: 'land', name: 'Thornwick Village' });
    const blds = ['house', 'tavern', 'chapel', 'cottage', 'windmill', 'blacksmith', 'barn', 'well', 'market-stall', 'house', 'cottage', 'tree-34', 'tree-34', 'fountain'];
    blds.forEach((b, i) => addAsset(b, 380 + (i % 5) * 380 + Math.random() * 60, 380 + Math.floor(i / 5) * 420 + Math.random() * 60, { s: 1.6 }));
    const p2 = pathMask.getContext('2d'); p2.strokeStyle = '#fff'; p2.lineWidth = 70 * maskScale; p2.lineCap = 'round'; p2.beginPath(); p2.moveTo(0, 900 * maskScale); p2.bezierCurveTo(800 * maskScale, 700 * maskScale, 1500 * maskScale, 1100 * maskScale, 2400 * maskScale, 860 * maskScale); p2.stroke();
    doc.objects.push({ id: uid(), t: 'line', kind: 'river', w: 26, o: 1, pts: [[1800, 0], [1750, 400], [1900, 900], [1820, 1400], [1900, 1800]] });
    addText(1200, 160, { text: 'Thornwick', size: 90, font: 'IM Fell English SC', spacing: 6 });
    baseDirty = true; commit(); setTool('select'); buildLibrary();
    await wait(2500); await whenImagesReady(); await shot('06-town-parchment');
    // save / load round trip
    const data = serialize(); await deserialize(data); await wait(2000); await shot('07-roundtrip');
    // interaction test with synthetic pointer events
    newMap({ type: 'world', style: 'parchment', name: 'Interaction Test', width: 2000, height: 1400 });
    await wait(500);
    window.__landStart = landMask.getContext('2d').getImageData(0, 0, landMask.width, landMask.height).data.some((v, i) => i % 4 === 3 && v > 0) ? 'HAS_LAND' : 'empty';
    const r = stage.getBoundingClientRect();
    const ev = (type, mx, my, extra = {}) => { const sx = r.left + view.ox + mx * view.zoom, sy = r.top + view.oy + my * view.zoom; stage.dispatchEvent(new PointerEvent(type, { clientX: sx, clientY: sy, button: 0, buttons: type === 'pointerup' ? 0 : 1, pointerId: 1, bubbles: true, ...extra })); };
    const stroke = (pts) => { ev('pointerdown', ...pts[0]); for (const p of pts.slice(1)) ev('pointermove', ...p); ev('pointerup', ...pts[pts.length - 1]); };
    setTool('land'); ui.brush = 260;
    const blob = []; for (let a = 0; a < 6.3; a += 0.15) blob.push([1000 + Math.cos(a) * 420, 700 + Math.sin(a) * 280]);
    stroke(blob); stroke([[900, 700], [1100, 700], [1000, 620], [1000, 780]]);
    setTool('ocean'); ui.brush = 120; stroke([[1000, 700], [1050, 720]]);
    setTool('stamp'); stampKey = 'pine'; ui.scatter = true; ui.stampScale = 0.5; ui.randFlip = true;
    stroke([[760, 600], [800, 620], [840, 600], [880, 640], [920, 610], [960, 640], [1000, 600]]);
    ui.scatter = false; stampKey = 'castle'; ui.stampScale = 0.8; stroke([[1180, 760]]);
    setTool('line'); ui.lineKind = 'river'; ui.lineWidth = 10; stroke([[1300, 600], [1340, 650], [1330, 720], [1380, 790], [1450, 900], [1500, 960]]);
    setTool('text'); ui.textFont = 'Cinzel'; ui.textSize = 70; ev('pointerdown', 1180, 860); ev('pointerup', 1180, 860);
    const label = doc.objects[doc.objects.length - 1]; label.text = 'Castle Rock'; label.curve = 0;
    ev('pointerdown', 1180, 860); ev('pointermove', 1100, 520); ev('pointerup', 1100, 520);
    $('#toTSizeN').value = 90; $('#toTSizeN').onchange({ target: $('#toTSizeN') });
    window.__label = `${label.font}/${label.size}/${Math.round(label.x)},${Math.round(label.y)}`;
    stampKey = 'mountain'; setTool('stamp'); ui.stampScale = 1; stroke([[1100, 520]]);
    selection.clear(); setTool('select'); ev('pointerdown', 1180, 760); ev('pointerup', 1180, 760);
    const castle = findObj([...selection][0]);
    const hp = handlePositions(castle); ev('pointerdown', hp.rot[0], hp.rot[1]); ev('pointermove', hp.rot[0] + 80, hp.rot[1] + 20); ev('pointerup', hp.rot[0] + 80, hp.rot[1] + 20);
    const rotated = Math.round(castle.r);
    const before = doc.objects.length; undo(); const afterUndo = Math.round(findObj(castle.id)?.r); redo(); const afterRedo = Math.round(findObj(castle.id)?.r);
    await wait(1500); await whenImagesReady(); await shot('08-interactions');
    // copy / paste keeps size + rotation, pastes at the mouse, and repeated pastes don't stack exactly
    const cSrc = findObj([...selection][0]);
    copySelection(); hoverPt = { x: 400, y: 300 }; pasteClipboard();
    const cP1 = findObj([...selection][0]);
    pasteClipboard(); const cP2 = findObj([...selection][0]);
    hoverPt = null; copySelection(true); const cutGone = !findObj(cP2.id); pasteClipboard(); const cP3 = findObj([...selection][0]);
    window.__clip = `copy=${cSrc.a}/${cSrc.s.toFixed(2)}/${Math.round(cSrc.r)} paste=${cP1.a}/${cP1.s.toFixed(2)}/${Math.round(cP1.r)}@${Math.round(cP1.x)},${Math.round(cP1.y)} again@${Math.round(cP2.x)},${Math.round(cP2.y)} cutGone=${cutGone} cutPaste=${cP3 ? cP3.a : 'none'}`;
    const pineCount = doc.objects.filter((o) => o.a === 'pine').length;
    setActiveLayer('assets');
    // landmass selection: pick the island, scale it up 1.5x, check land area and items followed
    const area = () => { const d = landMask.getContext('2d').getImageData(0, 0, landMask.width, landMask.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 127) n++; return n; };
    const a0 = area(); setTool('select'); setActiveLayer('land'); selection.clear(); refreshPanels();
    const pine0 = doc.objects.find((o) => o.a === 'pine'); const px0 = pine0.x;
    ev('pointerdown', 700, 760); ev('pointerup', 700, 760);
    const picked = !!landSel; const nItems = landSel ? landSel.items.length : -1;
    const cs = landCorners(); const L = landSel; const cx = L.cx, cy = L.cy;
    const k = [cs[2][0] + (cs[2][0] - cx) * 0.5, cs[2][1] + (cs[2][1] - cy) * 0.5];
    ev('pointerdown', cs[2][0], cs[2][1]); ev('pointermove', k[0], k[1]); ev('pointerup', k[0], k[1]);
    const sAfter = landSel ? landSel.s.toFixed(2) : 'none';
    await wait(300); await shot('09-land-selected');
    ev('pointerdown', 60, 60); ev('pointerup', 60, 60); // click sea to finish
    const a1 = area();
    window.__land = `picked=${picked} items=${nItems} scale=${sAfter} area=${(a1 / a0).toFixed(2)} pineMoved=${Math.round(pine0.x - px0)}`;
    undo(); const a2 = area(); window.__land += ` undoArea=${(a2 / a0).toFixed(2)}`; redo();
    // layers: clicking a mountain-covered spot on the Land layer selects LAND, not the mountain
    setActiveLayer('land'); const onPine = doc.objects.find((o) => o.a === 'pine');
    ev('pointerdown', onPine.x, onPine.y); ev('pointerup', onPine.x, onPine.y);
    const landUnderAsset = !!landSel && selection.size === 0; settleLand();
    setActiveLayer('assets'); ev('pointerdown', onPine.x, onPine.y); ev('pointerup', onPine.x, onPine.y);
    const assetOnAssets = selection.size === 1 && findObj([...selection][0]).a === 'pine' && !landSel;
    doc.layers.assets.locked = true; selection.clear(); ev('pointerdown', onPine.x, onPine.y); ev('pointerup', onPine.x, onPine.y);
    const lockedBlocks = selection.size === 0; doc.layers.assets.locked = false;
    doc.layers.text.visible = false; doc.layers.water.visible = false; baseDirty = true; renderLayers(); await wait(1500); await shot('11-layers-hidden');
    doc.layers.text.visible = true; doc.layers.water.visible = true; baseDirty = true; renderLayers();
    window.__land += ` landUnderAsset=${landUnderAsset} assetOnAssets=${assetOnAssets} lockedBlocks=${lockedBlocks}`;
    await wait(1500); await shot('10-land-resized');
    // fill bucket: draw a closed ring outline on open sea, fill inside it, then test a leaking outline
    {
      const areaNow = () => { const d = landMask.getContext('2d').getImageData(0, 0, landMask.width, landMask.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 127) n++; return n; };
      setTool('land'); ui.brush = 30; const ring = []; for (let a = 0; a <= 6.4; a += 0.1) ring.push([190 + Math.cos(a) * 95, 1240 + Math.sin(a) * 70]); stroke(ring);
      const f0 = areaNow(); setTool('fill'); ui.fillMode = 'land'; ev('pointerdown', 190, 1240); ev('pointerup', 190, 1240); const f1 = areaNow();
      // open "C" shape with a big gap: the fill must refuse rather than flood the ocean
      ui.autoClose = false; setTool('land'); const cshape = []; for (let a = 1.6; a <= 4.7; a += 0.1) cshape.push([1830 + Math.cos(a) * 95, 1240 + Math.sin(a) * 70]); stroke(cshape);
      const g0 = areaNow(); ui.autoClose = true; setTool('fill'); ev('pointerdown', 1830, 1240); ev('pointerup', 1830, 1240); const g1 = areaNow();
      await wait(300); await shot('12-fill');
      // water mode removes the filled island again
      ui.fillMode = 'water'; ev('pointerdown', 190, 1240); ev('pointerup', 190, 1240); const f2 = areaNow();
      undo(); const f3 = areaNow(); ui.fillMode = 'land';
      // an outline with a small break: refused with Close gaps = 0, filled with Close gaps = 8
      ui.fillMode = 'water'; ev('pointerdown', 190, 1240); ev('pointerup', 190, 1240); ui.fillMode = 'land';
      ui.autoClose = false; setTool('land'); ui.brush = 8; const arc = []; for (let a = 0.16; a <= 6.13; a += 0.04) arc.push([190 + Math.cos(a) * 85, 1240 + Math.sin(a) * 62]); stroke(arc);
      setTool('fill'); const h0 = areaNow();
      ui.fillGap = 0; ev('pointerdown', 190, 1240); ev('pointerup', 190, 1240); const h1 = areaNow();
      ui.fillGap = 12; ev('pointerdown', 190, 1240); ev('pointerup', 190, 1240); const h2 = areaNow();
      ui.autoClose = true; window.__gap = `gap0Refused=${h1 === h0} gap8Filled=${h2 > h0 + 8000}`;
      await wait(300); await shot('13-gap-fill');
      window.__fill = `${window.__gap} fillGrew=${(f1 / f0).toFixed(3)} leakRefused=${g1 === g0} waterMode=${f2 < f0} undo=${f3 === g1}`;
      setTool('select');
    }
    // shapes: rooms drawn on a battle map, furnished with interior assets
    {
      newMap({ type: 'battle', style: 'colour', name: 'Tavern', width: 1400, height: 1400 });
      fillMask(landMask, true); baseDirty = true; await wait(300);
      const r2 = stage.getBoundingClientRect();
      const ev2 = (type, mx, my, extra = {}) => { const sx = r2.left + view.ox + mx * view.zoom, sy = r2.top + view.oy + my * view.zoom; stage.dispatchEvent(new PointerEvent(type, { clientX: sx, clientY: sy, button: 0, buttons: type === 'pointerup' ? 0 : 1, pointerId: 1, bubbles: true, detail: 1, ...extra })); };
      setTool('shape'); ui.shapeKind = 'rect'; ui.shapeFill = 'wood'; ui.shapeWall = 'stone'; ui.shapeWallW = 20;
      ev2('pointerdown', 140, 140); ev2('pointermove', 600, 400); ev2('pointermove', 840, 700); ev2('pointerup', 840, 700);
      ui.shapeFill = 'stone'; ev2('pointerdown', 840, 300); ev2('pointermove', 1260, 700); ev2('pointerup', 1260, 700);
      ui.shapeKind = 'ellipse'; ui.shapeFill = 'cobbles'; ui.shapeWall = 'wood'; ui.shapeWallW = 12; ev2('pointerdown', 200, 820); ev2('pointermove', 620, 1240); ev2('pointerup', 620, 1240);
      ui.shapeKind = 'poly'; ui.shapeFill = 'rock'; ui.shapeWall = 'ink';
      for (const [x, y] of [[760, 860], [1180, 820], [1280, 1060], [1100, 1280], [800, 1200]]) { ev2('pointerdown', x, y); ev2('pointerup', x, y); }
      ev2('pointerdown', 760, 860); ev2('pointerup', 760, 860);   // click the first point to close
      const shapes = doc.objects.filter((o) => o.t === 'shape');
      for (const [a, x, y, sc] of [['fireplace', 480, 200, 1.2], ['bar-counter', 300, 600, 1.4], ['tavern-table', 300, 380, 1], ['tavern-table', 560, 420, 1], ['bard-stage', 720, 560, 1], ['stairs', 1180, 380, 0.9], ['altar', 1050, 560, 1], ['wall-torch', 900, 360, 0.8], ['spike-pit', 1000, 1000, 1.1], ['treasure-pile', 1120, 1120, 1], ['giant-spider', 880, 1080, 1.1], ['cobweb', 820, 900, 1], ['rubble', 1180, 960, 1], ['campfire', 410, 1030, 1]]) addAsset(a, x, y, { s: sc });
      // copy a room and resize it: shapes behave like other objects
      selection.clear(); selection.add(shapes[0].id); copySelection(); hoverPt = { x: 700, y: 700 }; pasteClipboard(); const pasted = findObj([...selection][0]); pasted.s = 0.4; hoverPt = null;
      baseDirty = true; commit(); setTool('select'); await wait(1500); await whenImagesReady(); await shot('14-shapes-tavern');
      window.__shapes = `shapes=${doc.objects.filter((o) => o.t === 'shape').length} kinds=${shapes.map((o) => o.kind).join('+')} polyPts=${(shapes.find((o) => o.kind === 'poly') || {}).pts?.length}`;
    }
    // texture brush: paint, undo, recolour with style, move with landmass, save + reload
    {
      newMap({ type: 'world', style: 'colour', name: 'Textures', width: 2000, height: 1400 }); await wait(300);
      const r3 = stage.getBoundingClientRect();
      const ev3 = (type, mx, my) => { const sx = r3.left + view.ox + mx * view.zoom, sy = r3.top + view.oy + my * view.zoom; stage.dispatchEvent(new PointerEvent(type, { clientX: sx, clientY: sy, button: 0, buttons: type === 'pointerup' ? 0 : 1, pointerId: 1, bubbles: true, detail: 1 })); };
      const stroke3 = (pts) => { ev3('pointerdown', ...pts[0]); for (const q of pts.slice(1)) ev3('pointermove', ...q); ev3('pointerup', ...pts[pts.length - 1]); };
      setTool('land'); ui.brush = 120; const ring = []; for (let a = 0; a <= 6.4; a += 0.08) ring.push([1000 + Math.cos(a) * 560, 700 + Math.sin(a) * 380]); stroke3(ring);
      setTool('fill'); ev3('pointerdown', 1000, 700); ev3('pointerup', 1000, 700);
      setTool('texture'); ui.brush = 260; ui.texType = 'grass'; stroke3([[650, 650], [900, 600], [1150, 680], [1350, 640]]);
      ui.texType = 'rock'; ui.brush = 200; stroke3([[1250, 480], [1380, 560], [1450, 700]]);
      ui.texType = 'snow'; ui.brush = 150; stroke3([[1300, 470], [1400, 540]]);
      ui.texType = 'sand'; ui.brush = 120; const coast = []; for (let a = 1.6; a <= 3.4; a += 0.05) coast.push([1000 + Math.cos(a) * 520, 700 + Math.sin(a) * 350]); stroke3(coast);
      ui.texType = 'dirt'; ui.brush = 70; stroke3([[700, 820], [900, 780], [1100, 860]]);
      const used1 = Object.keys(texMasks).sort().join(',');
      const alphaSum = (m) => { const d = m.getContext('2d').getImageData(0, 0, m.width, m.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) n += d[i]; return n; };
      const dirt0 = alphaSum(texMasks.dirt); undo(); const dirtUndo = texMasks.dirt ? alphaSum(texMasks.dirt) : 0; redo(); const dirtRedo = alphaSum(texMasks.dirt);
      await wait(800); await shot('15-textures-colour');
      $('#styleSelect').value = 'parchment'; $('#styleSelect').onchange({ target: $('#styleSelect') }); await wait(2500); await shot('16-textures-parchment');
      // move + shrink the island: its textures go with it
      const gx0 = alphaSum(texMasks.grass);
      setTool('select'); setActiveLayer('land'); ev3('pointerdown', 1000, 700); ev3('pointerup', 1000, 700); setLandScale(0.6); landSel.dx = -300; applyLandItems(); settleLand(); const gx1 = alphaSum(texMasks.grass);
      const data = serialize(); await deserialize(data); await wait(1500);
      const used2 = Object.keys(texMasks).sort().join(','); const gx2 = alphaSum(texMasks.grass);
      await shot('17-textures-moved-reloaded');
      window.__tex = `textures=${used1} undo=${dirtUndo < dirt0 * 0.2} redo=${dirtRedo === dirt0} shrunk=${(gx1 / gx0).toFixed(2)} reload=${used2 === used1 && Math.abs(gx2 - gx1) / gx1 < 0.05}`;
    }
    // effects, look, coastline, snap, export sizes
    {
      newMap({ type: 'battle', style: 'colour', name: 'FX', width: 1400, height: 1400 }); fillMask(landMask, true);
      doc.grid.snap = true; await wait(200);
      const p0 = placeStamp(333, 451); const snapped = `${p0.x},${p0.y}`;
      const a1 = addAsset('castle-keep', 700, 600, { s: 2 }); a1.ef = { shadow: true, hue: 90, glow: true, glowColor: '#ff3366' };
      const a2 = addAsset('tree-top', 1000, 600, { s: 1.6 }); a2.ef = { tint: '#3366ff', tintAmt: 0.5 };
      const t1 = addText(700, 1000, { text: 'Glowing Text', size: 90 }); t1.ef = { glow: true, glowColor: '#40c0ff', shadow: true };
      doc.coast = { rings: 6, gap: 10, width: 3, sea: '#1e5a8a', land: '#c9b27a' }; doc.look = { bright: 105, contrast: 115, sat: 80, hue: 0, sepia: 30, vignette: 70 };
      fillMask(landMask, false); const lc = landMask.getContext('2d'); lc.fillStyle = '#fff'; lc.beginPath(); lc.ellipse(700 * maskScale, 700 * maskScale, 520 * maskScale, 420 * maskScale, 0, 0, 7); lc.fill();
      commit(); await wait(300); rebuildBase(true); needsDraw = true; await wait(600); await whenImagesReady(); await shot('18-effects-look');
      // a full-size 8K export
      const long = Math.max(doc.width, doc.height); const ex = await exportImage('png', 8192 / long, 1, true);
      window.__fx = `snap=${snapped} export8k=${ex && ex.w}x${ex && ex.h} bytes=${ex && Math.round(ex.bytes / 1e6)}MB filter=${lookFilter().replace(/ /g, '|')}`;
    }
    document.title = `TESTDONE ${window.__fx} ${window.__tex} ${window.__shapes} ${window.__fill} ${window.__clip} ${window.__land} label=${window.__label} landStart=${window.__landStart} objs=${before} pines=${pineCount} rotated=${rotated} undoR=${afterUndo} redoR=${afterRedo} sel=${castle.a} png=${window.__exportPng}`;
  }
  boot();
})();
