# Pocket-Mapp-Creator

A desktop map maker in the spirit of Inkarnate, for Windows, Linux and macOS (Electron).
Make Tolkien-style parchment world maps, towns and villages, and top-down RPG battle maps, then export them as PNG or JPG.

![Parchment world map](docs/parchment-world.png)

**[Read the User Guide](docs/USER-GUIDE.md)**: everything from installing to exporting, with screenshots. The same guide is built into the app: press **F1**, click **? Guide**, or choose **Help → User Guide**.

## Features

**Map styles** (switch at any time from the toolbar; the whole map re-skins)
- **Parchment** — sepia ink on aged paper, hatched mountains, Tolkien-style ripple lines around every coast
- **Full colour** — saturated, game-ready, beaches and shallow water
- **Watercolour** — soft washes with bleeding edges and pigment rims
- **Copperplate** — an engraved atlas: fine dark ink on ivory, closely hatched seas
- **Night & Gold** — cream ink and gold on midnight-blue paper

**Map types**
- **World / Region** — paint continents and seas; side-view mountains, forests, castles, cities
- **Town / City / Village** — 3/4-view houses, taverns, chapels, windmills, walls, gatehouses
- **Battle maps** — top-down trees, rocks, furniture, campfires, with a square or hex grid (default 70 px cells)

**Asset genres:** Fantasy, Sci-Fi, Modern, Realistic — 157 original assets × 5 styles.
Includes ships (galleon, longship, merchant ship, rowing boat, cargo ship), docks, jetties and harbours, sea stacks and rocks for the ocean, and stone, wooden and suspension bridges, with top-down versions for battle maps.

**Editing**
- Adjustable map size (presets or custom up to 8000 × 8000) — resize later by extending/cropping or by scaling everything
- **Scroll bars** along the bottom and right of the map area: drag them, or click the track to jump a page. The mouse wheel zooms; Shift+wheel scrolls sideways and Alt+wheel scrolls up and down
- **Zoom controls** in the top bar: **−** and **+** buttons, a box where you can type any zoom % (press Enter), a preset list (25%–400%) and **Fit**
- Every asset can be moved, **rotated** (handle, R key, or slider) and **scaled** (corner handles, [ ] keys, or slider), flipped, layered, faded
- **Copy, Cut & Paste** (Ctrl+C / Ctrl+X / Ctrl+V, the Edit menu, or the buttons in Properties): copies keep their exact size, rotation, flip and opacity, and are pasted where your mouse pointer is. This works for one item or a whole group, and for text and lines too, including between maps
- **Scatter brush** to paint whole forests or mountain ranges with random size, rotation and flip
- Every new map starts as **open ocean**. Paint land in any shape with the **Land brush** (B), and turn land back into sea with the **Ocean brush** (E). Coastlines are inked automatically. The **Ground brush** paints roads, dirt and clearings
- **Fill bucket** (G): draw a coastline outline with the Land brush, then click inside it to fill it with land. With **Auto-close outlines** on (the default), the Land brush joins the ends of a stroke that finishes near where it started. The fill also seals small breaks by itself; **Close gaps** (in screen pixels) sets how far, and it tries wider automatically before giving up. If the outline really is open, the fill refuses and shows in red the sea it would have flooded. **Fill with water** mode turns a whole piece of land back into sea with one click
- **Layers**: 1 **Water** (base), 2 **Land**, 3 **Assets** (mountains, towns, ships, rivers and roads), 4 **Text** (always on top). Each layer can be hidden or locked, and hidden layers are left out of exports. The Select tool only picks things on the **active** layer. Click a layer in the Layers panel, or press 1 for Land, 2 for Assets, 3 for Text. Drawing tools switch to their own layer automatically.
- **Resize land**: make **Land** the active layer, choose **Select** and click any land, even under mountains or towns. Drag a corner to make it **bigger or smaller**, drag inside the box to move it, or use the round handle to rotate it. Size and rotation can also be typed in. Items on that land move with it (this can be turned off). Delete removes the land, and Esc or **Done** finishes
- **Line tool** for tapering rivers, dashed roads, dotted trails, dash-dot borders and walls
- **Text labels**: pick a font, size and colour in the Text tool bar, then click where the label should go. Drag a label to move it and resize it from the same bar. 8 bundled map fonts, halo, letter-spacing, CAPS and **curved text**. Labels always sit on top of land, assets and lines
- **Assets used** panel — every asset type on the map with its count; select all copies, hide them, or delete all copies in one click; expand to jump to individual copies
- Import your own PNG/SVG assets (saved inside the map file)
- **Shapes tool** (U) for rooms, buildings and floors: rectangle, round and polygon rooms with textured floors (stone, cobbles, wood, dirt, grass, sand, rock, snow, water, lava) and stone, wooden or ink walls
- **Texture brush** (X) paints grass, dirt, sand, rock, snow, stone and more straight onto the land, with soft edges
- **Interior, dungeon and city assets**: fireplaces, bars, tables, bookshelves, stairs, trapdoors, secret doors, spike pits, prison bars, altars, sarcophagi, treasure, rubble, cobwebs, top-down houses and city blocks, and Asian-style pagodas, shrine gates, lanterns and houses
- **Effects** on any item: drop shadow, coloured glow, hue, brightness, saturation and tint
- **Coastline & colours**: number and spacing of sea ripples, coast line thickness, sea and land colours
- **Map look** filters for the whole map: brightness, contrast, saturation, hue, sepia and vignette
- **Snap to grid** for rooms and assets
- **Random maps** (🎲): worlds with mountains, forests, rivers, named towns, roads and realms; towns with streets, a market square, river, bridges and walls; dungeons with rooms, corridors, doors, furniture, traps and room numbers. The same seed always gives the same map
- **Dungeon tool** (D): carve rooms and corridors square by square; walls are drawn automatically
- **Realms**: coloured areas with dashed borders that only colour the land, plus a **map key** that lists them and an index of places by grid square
- **Auto-routed roads** that find their own way round seas, lakes and mountains
- **Lighting**: darken the map and let torches, fires, lanterns and lighthouses glow
- **Layer effects**: opacity, drop shadow and glow for a whole layer
- **Linked maps**: double-click a town or castle to open its own map, with a Back button
- **Measure tool** (M) with a scale you set (miles, km, feet, squares)
- **Marsh and jungle** textures
- **Autosave** every minute with recovery from the welcome window, plus an **example map** to explore
- Undo/redo, save/open `.mapp` files, export **PNG** or **JPG** at 0.5×, 1×, 2K, 4K, 8K or 2×, **SVG** (vector icons and labels, fonts built in), print-ready **PDF** (A4 to A1, Letter, Tabloid or poster) and **Print**

## Running it

Requires **Node.js 24** or newer (an `.nvmrc` is included, so `nvm use` picks the right version).

```bash
npm install
npm start
```

## Building installers with GitHub (Windows, macOS, Linux)

The workflow in `.github/workflows/build.yml` builds all three platforms on GitHub's own machines using Node.js 24.

1. Create a GitHub repository called `Pocket-Mapp-Creator` and push this folder to it, including `package-lock.json`.
2. **To test a build:** on GitHub open **Actions → Build installers → Run workflow**. When it finishes (about 10 minutes), open the **Releases** page. The installers are on a **draft** release called `build-<number>`, which only you can see. Delete old test drafts when you no longer need them.
3. **To publish a release:** bump `version` in `package.json`, then tag and push:
   ```bash
   git tag v0.1.0
   git push origin v0.1.0
   ```
   The installers are attached to a release and it is made public once all three platforms have built.

Installers are stored on GitHub Releases rather than as workflow "artifacts", so they don't use up the account's Actions artifact storage quota.

| Platform | Files produced |
|---|---|
| Windows | `…-win-x64.exe` (installer) and `…-win-portable.exe` (no install needed) |
| macOS | `…-mac-x64.dmg` (Intel) and `…-mac-arm64.dmg` (Apple Silicon) |
| Linux | `…-linux-x86_64.AppImage` and `…-linux-amd64.deb` |

**Unsigned builds:** the installers are not code-signed, which would need paid Apple and Windows certificates.
- On Windows, SmartScreen may say "Windows protected your PC". Click **More info → Run anyway**.
- On macOS, right-click the app and choose **Open** the first time. If macOS says the app "is damaged", run `xattr -cr "/Applications/Pocket-Mapp-Creator.app"` in Terminal.

### Building on your own computer

```bash
npm run dist:win     # on Windows
npm run dist:mac     # on a Mac
npm run dist:linux   # on Linux
```

Output goes to `dist/`.

## Updating the User Guide

The guide lives in `docs/USER-GUIDE.md`, with its pictures in `docs/guide-images/`. After editing it, run `npm run guide` to rebuild the in-app copy (`src/guide/`). The installer builds do this automatically.

## Regenerating the asset library

All built-in assets are drawn by code in `tools/generate-assets.js`. Edit a palette or a drawing function, then:

```bash
npm run assets
```

## Shortcuts

| Key | Action |
|---|---|
| F1 | Open the User Guide |
| V S B E G P L T H | Select · Stamp · Land brush · Ocean brush · Fill bucket · Ground · Lines · Text · Pan |
| Space + drag / middle mouse | Pan |
| Wheel, Ctrl+= / Ctrl+- / Ctrl+0 | Zoom / zoom in / zoom out / fit |
| Scroll bars, Shift+wheel / Alt+wheel | Scroll sideways / up and down |
| Ctrl+Z / Ctrl+Y | Undo / Redo |
| Ctrl+C / Ctrl+X / Ctrl+V | Copy / Cut / Paste (pastes at the mouse, same size) |
| Ctrl+D, Alt+drag | Duplicate |
| Delete | Delete selection |
| R / Shift+R | Rotate ±15° (Shift while dragging the handle snaps to 15°) |
| F | Flip |
| 1 / 2 / 3 | Active layer: Land / Assets / Text |
| Click land (Select tool, Land layer) | Select a landmass; [ ] resize it, R rotate, Delete remove |
| [ / ] | Brush size, or scale the selection |
| Alt while painting | Swap Land ↔ Ocean brush |

## Licences

- Code: MIT — see `LICENSE`
- Product icon: © MJO-Art (workmjo@gmail.com), all rights reserved — may not be altered or used without the Artist's express permission
- Built-in assets: original work, CC0 1.0 — see `ASSET-LICENSES.md` (full per-asset list)
- Fonts: SIL Open Font License 1.1 — see `ASSET-LICENSES.md` and `src/fonts/licenses/`

© 2026 Pocket-Designs · pocket-designs@proton.me
