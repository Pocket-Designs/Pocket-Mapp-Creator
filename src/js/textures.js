// Pocket-Mapp-Creator — procedural surface textures (shape floors and the texture brush)
// Copyright (c) 2026 project-tech-me — MIT Licence
// Every texture is drawn here in code: original work, CC0, like the built-in assets.
(function () {
  const MT = (window.MT = window.MT || {});

  // name, label and colours per style: [base, dark, light]
  const TEX = {
    stone:   { label: 'Stone tiles',  parchment: ['#e2cfa3', '#b39668', '#efe2c2'], colour: ['#b7b0a4', '#7d776d', '#d4cfc4'], watercolour: ['#cfc9bd', '#9a9488', '#e6e2d8'] },
    cobbles: { label: 'Cobbles',      parchment: ['#ddc89a', '#a88b5c', '#ecdcb8'], colour: ['#a69d8f', '#6f675c', '#c8c0b3'], watercolour: ['#c4bcae', '#8e877b', '#dfd9cd'] },
    wood:    { label: 'Wood planks',  parchment: ['#d9bd8a', '#a3824e', '#e8d3a6'], colour: ['#a8743f', '#6f4a26', '#c4935e'], watercolour: ['#c99d72', '#93704d', '#dfbe98'] },
    dirt:    { label: 'Dirt',         parchment: ['#d8c08e', '#ad9160', '#e6d4ac'], colour: ['#9c7a52', '#6e5435', '#b89670'], watercolour: ['#c2a47e', '#957a58', '#d8c2a3'] },
    grass:   { label: 'Grass',        parchment: ['#d7c48e', '#ad9a62', '#e6d8ad'], colour: ['#6fa846', '#477a2c', '#94c467'], watercolour: ['#9cc57a', '#6f9a55', '#bcd9a1'] },
    sand:    { label: 'Sand',         parchment: ['#ecdcae', '#c8b07c', '#f6ead0'], colour: ['#e6cf92', '#bf9f5f', '#f3e3b5'], watercolour: ['#eedcae', '#cdb486', '#f7ecd2'] },
    rock:    { label: 'Rock',         parchment: ['#cfb889', '#9f8357', '#e0cda6'], colour: ['#8f877b', '#5c564d', '#ada69b'], watercolour: ['#aaa296', '#7c756a', '#c8c1b6'] },
    snow:    { label: 'Snow',         parchment: ['#f6eed8', '#d9caa6', '#fffaf0'], colour: ['#f2f6fa', '#c3d0dc', '#ffffff'], watercolour: ['#f3f6f8', '#cfdbe4', '#ffffff'] },
    water:   { label: 'Water',        parchment: ['#d6c091', '#b09564', '#e4d3ac'], colour: ['#4f97c8', '#2f6f99', '#86c1e2'], watercolour: ['#8fc2df', '#5f9cc0', '#bcdcee'] },
    lava:    { label: 'Lava',         parchment: ['#c99a62', '#8e4a2c', '#e2bb7a'], colour: ['#e2561c', '#8a1f0c', '#ffb43a'], watercolour: ['#e88a5a', '#b24a2e', '#f8c487'] }
  };
  MT.TEXTURES = Object.fromEntries(Object.entries(TEX).map(([k, v]) => [k, v.label]));

  function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const cache = new Map();

  // Returns a square, seamlessly repeating canvas tile for a texture in a style.
  MT.textureTile = function (type, style) {
    const key = `${type}/${style}`; if (cache.has(key)) return cache.get(key);
    const T = TEX[type] || TEX.stone; const [base, dark, light] = T[style] || T.parchment;
    const ink = style === 'parchment' ? '#3b2817' : style === 'colour' ? '#2d2216' : '#5a4634';
    const N = 128, c = document.createElement('canvas'); c.width = c.height = N;
    const x = c.getContext('2d'); const r = rng(type.length * 977 + style.length * 31);
    x.fillStyle = base; x.fillRect(0, 0, N, N);
    // fine grain on every texture (wrapped so the tile repeats seamlessly)
    const speck = (n, col, size, alpha) => { x.globalAlpha = alpha; x.fillStyle = col; for (let i = 0; i < n; i++) { const px = r() * N, py = r() * N, s = size * (0.5 + r()); for (const ox of [0, -N, N]) for (const oy of [0, -N, N]) x.fillRect(px + ox, py + oy, s, s); } x.globalAlpha = 1; };
    const wrapLine = (pts, w, col, a = 1) => { x.globalAlpha = a; x.strokeStyle = col; x.lineWidth = w; x.lineCap = 'round'; for (const ox of [0, -N, N]) for (const oy of [0, -N, N]) { x.beginPath(); pts.forEach(([px, py], i) => (i ? x.lineTo(px + ox, py + oy) : x.moveTo(px + ox, py + oy))); x.stroke(); } x.globalAlpha = 1; };
    switch (type) {
      case 'stone': {
        const S = 32;
        for (let gy = 0; gy < N; gy += S) for (let gx = 0; gx < N; gx += S) { x.fillStyle = r() < 0.5 ? base : light; x.globalAlpha = 0.6; x.fillRect(gx + 1, gy + 1, S - 2, S - 2); x.globalAlpha = 1; }
        speck(500, dark, 1.2, 0.25);
        x.strokeStyle = ink; x.globalAlpha = 0.55; x.lineWidth = 1.4;
        for (let i = 0; i <= N; i += S) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, N); x.moveTo(0, i); x.lineTo(N, i); x.stroke(); }
        x.globalAlpha = 1;
        for (let i = 0; i < 4; i++) { const sx = r() * N, sy = r() * N; wrapLine([[sx, sy], [sx + 5 + r() * 6, sy + 4 + r() * 6], [sx + 9 + r() * 6, sy + 2 + r() * 10]], 0.8, ink, 0.4); }
        break;
      }
      case 'cobbles': {
        speck(300, dark, 1.4, 0.3);
        for (let gy = 0; gy < N; gy += 16) for (let gx = (gy / 16) % 2 ? 8 : 0; gx < N + 16; gx += 16) {
          const cx = gx + (r() - 0.5) * 3, cy = gy + 8 + (r() - 0.5) * 3, rx = 6.5 + r() * 1.5, ry = 5.5 + r() * 1.5;
          for (const ox of [0, -N]) { x.beginPath(); x.ellipse(cx + ox, cy, rx, ry, r(), 0, 6.283); x.fillStyle = r() < 0.5 ? light : base; x.fill(); x.strokeStyle = ink; x.globalAlpha = 0.5; x.lineWidth = 1; x.stroke(); x.globalAlpha = 1; }
        }
        break;
      }
      case 'wood': {
        const P = 16;
        for (let gy = 0; gy < N; gy += P) {
          x.fillStyle = r() < 0.5 ? base : light; x.globalAlpha = 0.7; x.fillRect(0, gy, N, P); x.globalAlpha = 1;
          for (let g = 0; g < 4; g++) { const yy = gy + 2 + r() * (P - 4); wrapLine([[0, yy], [N * 0.33, yy + (r() - 0.5) * 2], [N * 0.66, yy + (r() - 0.5) * 2], [N, yy]], 0.6, dark, 0.35); }
          x.strokeStyle = ink; x.globalAlpha = 0.55; x.lineWidth = 1.3; x.beginPath(); x.moveTo(0, gy); x.lineTo(N, gy); x.stroke();
          const j = ((gy / P) * 37) % N; x.beginPath(); x.moveTo(j, gy); x.lineTo(j, gy + P); x.moveTo((j + 64) % N, gy); x.lineTo((j + 64) % N, gy + P); x.stroke(); x.globalAlpha = 1;
          x.fillStyle = ink; x.globalAlpha = 0.5; x.fillRect((j + 3) % N, gy + 3, 1.6, 1.6); x.fillRect((j + 3) % N, gy + P - 5, 1.6, 1.6); x.globalAlpha = 1;
        }
        break;
      }
      case 'dirt': speck(900, dark, 1.6, 0.35); speck(400, light, 1.4, 0.4); for (let i = 0; i < 10; i++) { const px = r() * N, py = r() * N; x.globalAlpha = 0.35; x.fillStyle = dark; x.beginPath(); x.ellipse(px, py, 2 + r() * 2, 1.5 + r() * 1.5, r() * 3, 0, 6.283); x.fill(); x.globalAlpha = 1; } break;
      case 'grass': {
        speck(400, light, 1.6, 0.4);
        for (let i = 0; i < 160; i++) { const px = r() * N, py = r() * N, h = 3 + r() * 4, lean = (r() - 0.5) * 3; wrapLine([[px, py], [px + lean, py - h]], 0.9, r() < 0.5 ? dark : ink, style === 'parchment' ? 0.45 : 0.5); }
        break;
      }
      case 'sand': speck(1400, dark, 1, 0.3); speck(500, light, 1, 0.6); for (let i = 0; i < 5; i++) { const yy = r() * N; wrapLine([[0, yy], [32, yy - 3], [64, yy], [96, yy - 3], [N, yy]], 0.7, dark, 0.3); } break;
      case 'rock': {
        speck(700, dark, 1.6, 0.35);
        for (let i = 0; i < 12; i++) { const px = r() * N, py = r() * N, s = 5 + r() * 9; wrapLine([[px - s, py], [px - s * 0.3, py - s * 0.7], [px + s * 0.6, py - s * 0.5], [px + s, py + s * 0.2], [px, py + s * 0.6], [px - s, py]], 1, ink, 0.45); }
        break;
      }
      case 'snow': speck(500, dark, 1.4, 0.25); speck(300, light, 2, 0.8); for (let i = 0; i < 6; i++) { const yy = r() * N; wrapLine([[0, yy], [40, yy - 4], [88, yy + 2], [N, yy]], 0.6, dark, 0.3); } break;
      case 'water': {
        speck(300, light, 1.4, 0.4);
        for (let i = 0; i < 9; i++) { const px = r() * N, py = r() * N; wrapLine([[px, py], [px + 5, py - 3], [px + 10, py], [px + 15, py - 3], [px + 20, py]], 0.9, style === 'parchment' ? ink : light, style === 'parchment' ? 0.45 : 0.8); }
        break;
      }
      case 'lava': {
        speck(400, dark, 2, 0.5);
        for (let i = 0; i < 10; i++) { const px = r() * N, py = r() * N; wrapLine([[px, py], [px + 8 + r() * 10, py + (r() - 0.5) * 10], [px + 16 + r() * 12, py + (r() - 0.5) * 14]], 2.2, light, 0.85); }
        break;
      }
      default: speck(500, dark, 1.2, 0.3);
    }
    cache.set(key, c);
    return c;
  };
})();
