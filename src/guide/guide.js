// Pocket-Mapp-Creator — in-app User Guide behaviour. Copyright (c) 2026 project-tech-me — MIT Licence
(function () {
  const doc = document.getElementById('doc');
  const links = [...document.querySelectorAll('#toc a')];
  const headsNow = () => links.map((a) => document.getElementById(a.getAttribute('href').slice(1)));

  // contents links scroll the guide pane
  for (const a of document.querySelectorAll('a[href^="#"]')) {
    a.addEventListener('click', (e) => {
      const t = document.getElementById(a.getAttribute('href').slice(1));
      if (t) { e.preventDefault(); t.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    });
  }
  // highlight the section being read
  function mark() {
    let cur = 0; const top = doc.scrollTop + 80;
    headsNow().forEach((h, i) => { if (h && h.offsetTop <= top) cur = i; });
    links.forEach((a, i) => a.classList.toggle('on', i === cur));
  }
  doc.addEventListener('scroll', mark, { passive: true }); mark();

  // search: highlight matches and jump to the first; sections without a match are dimmed in the contents
  const find = document.getElementById('find');
  const original = doc.innerHTML;
  let timer;
  find.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(run, 180); });
  find.addEventListener('keydown', (e) => { if (e.key === 'Enter') next(); if (e.key === 'Escape') { find.value = ''; run(); } });
  let hits = [], at = -1;
  function run() {
    const q = find.value.trim();
    doc.innerHTML = original; hits = []; at = -1;
    links.forEach((a) => { a.style.opacity = ''; });
    document.querySelector('.nores')?.remove();
    if (q.length < 2) { mark(); return; }
    const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const walk = document.createTreeWalker(doc, NodeFilter.SHOW_TEXT);
    const nodes = []; while (walk.nextNode()) nodes.push(walk.currentNode);
    for (const n of nodes) {
      if (!re.test(n.nodeValue)) continue; re.lastIndex = 0;
      const frag = document.createDocumentFragment(); let last = 0; let m;
      while ((m = re.exec(n.nodeValue))) {
        frag.append(n.nodeValue.slice(last, m.index));
        const mk = document.createElement('mark'); mk.textContent = m[0]; frag.append(mk); hits.push(mk);
        last = m.index + m[0].length;
      }
      frag.append(n.nodeValue.slice(last)); n.replaceWith(frag);
    }
    // dim contents entries whose section has no match
    const fresh = links.map((a) => document.getElementById(a.getAttribute('href').slice(1)));
    fresh.forEach((h, i) => {
      const end = fresh[i + 1]; let el = h, found = false;
      while (el && el !== end) { if (el.querySelector && el.querySelector('mark')) { found = true; break; } el = el.nextElementSibling; }
      links[i].style.opacity = found ? '' : '.35';
    });
    if (!hits.length) { const p = document.createElement('p'); p.className = 'nores'; p.textContent = 'No matches'; document.getElementById('toc').after(p); return; }
    next();
  }
  function next() {
    if (!hits.length) return;
    at = (at + 1) % hits.length;
    hits.forEach((h) => { h.style.outline = ''; });
    hits[at].style.outline = '2px solid #8a4b1c';
    hits[at].scrollIntoView({ block: 'center' });
  }
})();
