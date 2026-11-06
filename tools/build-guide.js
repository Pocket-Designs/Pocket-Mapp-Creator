#!/usr/bin/env node
/*
 * Builds the in-app User Guide (src/guide/index.html) from docs/USER-GUIDE.md.
 * Copyright (c) 2026 project-tech-me — MIT Licence
 *
 * Edit docs/USER-GUIDE.md (GitHub shows it as a page), then run:  npm run guide
 * The installer build scripts run this automatically.
 */
const fs = require('fs');
const path = require('path');
const { marked } = require('marked');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'docs', 'USER-GUIDE.md');
const OUT_DIR = path.join(ROOT, 'src', 'guide');
const IMG_SRC = path.join(ROOT, 'docs', 'guide-images');
const IMG_OUT = path.join(OUT_DIR, 'guide-images');

// GitHub-style heading anchors, so the guide's own contents links work in both places
const slug = (text) => text.toLowerCase().replace(/<[^>]+>/g, '').replace(/&[a-z#0-9]+;/g, '').replace(/[^\w\- ]+/g, '').trim().replace(/ /g, '-');
const toc = [];
marked.use({
  gfm: true,
  renderer: {
    heading({ tokens, depth }) {
      const html = this.parser.parseInline(tokens);
      const id = slug(html);
      if (depth === 2 && !/^contents$/i.test(html)) toc.push({ id, html });
      return `<h${depth} id="${id}">${html}</h${depth}>\n`;
    },
    link({ href, title, tokens }) {
      const text = this.parser.parseInline(tokens);
      const ext = /^https?:/i.test(href);
      return `<a href="${href}"${title ? ` title="${title}"` : ''}${ext ? ' class="ext" rel="noopener"' : ''}>${text}</a>`;
    }
  }
});

let md = fs.readFileSync(SRC, 'utf8');
// the in-app page has its own side contents, so drop the Markdown contents list
md = md.replace(/## Contents\n[\s\S]*?(?=\n## )/, '');
const body = marked.parse(md);

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; img-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; script-src 'self'">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Pocket-Mapp-Creator — User Guide</title>
<link rel="stylesheet" href="guide.css">
</head>
<body>
<nav id="side">
  <div class="brand"><img src="../icon.png" alt=""> User Guide</div>
  <input id="find" type="search" placeholder="Search the guide…" autocomplete="off">
  <ol id="toc">
${toc.map((t) => `    <li><a href="#${t.id}">${t.html.replace(/^\d+\.\s*/, '')}</a></li>`).join('\n')}
  </ol>
</nav>
<main id="doc">
${body}
</main>
<script src="guide.js"></script>
</body>
</html>
`;

fs.mkdirSync(IMG_OUT, { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, 'index.html'), html);
for (const f of fs.readdirSync(IMG_SRC)) fs.copyFileSync(path.join(IMG_SRC, f), path.join(IMG_OUT, f));
console.log(`User guide built: ${toc.length} sections -> src/guide/index.html`);
