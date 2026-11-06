// Pocket-Mapp-Creator — main process
// Copyright (c) 2026 project-tech-me <project-tech-me@protonmail.com> — MIT Licence
const { app, BrowserWindow, ipcMain, dialog, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs');

let win;

function createWindow() {
  win = new BrowserWindow({
    width: 1500,
    height: 940,
    minWidth: 1100,
    minHeight: 700,
    title: 'Pocket-Mapp-Creator',
    backgroundColor: '#1e1a16',
    icon: path.join(__dirname, 'build', process.platform === 'win32' ? 'icon.ico' : 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  win.loadFile(path.join(__dirname, 'src', 'index.html'));
  win.webContents.on('will-prevent-unload', (e) => {
    const choice = dialog.showMessageBoxSync(win, {
      type: 'question', buttons: ['Close without saving', 'Cancel'], defaultId: 1, cancelId: 1,
      message: 'This map has unsaved changes.',
      detail: 'A copy is kept automatically and offered next time you start Pocket-Mapp-Creator, but saving is safer.'
    });
    if (choice === 0) e.preventDefault();   // preventDefault here lets the window close
  });
  buildMenu();
  if (process.env.MAPP_TEST) {
    win.webContents.on('console-message', (e) => console.log('[renderer]', e.message || ''));
    win.on('page-title-updated', (_e, title) => {
      if (title.startsWith('TESTDONE')) { console.log(title); setTimeout(() => app.quit(), 300); }
    });
  }
}

function send(cmd) { if (win) win.webContents.send('menu', cmd); }

function buildMenu() {
  const isMac = process.platform === 'darwin';
  const template = [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    {
      label: 'File',
      submenu: [
        { label: 'New Map…', accelerator: 'CmdOrCtrl+N', click: () => send('new') },
        { label: 'Open Map…', accelerator: 'CmdOrCtrl+O', click: () => send('open') },
        { label: 'Save', accelerator: 'CmdOrCtrl+S', click: () => send('save') },
        { label: 'Save As…', accelerator: 'CmdOrCtrl+Shift+S', click: () => send('saveAs') },
        { type: 'separator' },
        { label: 'Export PNG…', accelerator: 'CmdOrCtrl+E', click: () => send('exportPng') },
        { label: 'Export JPG…', accelerator: 'CmdOrCtrl+Shift+E', click: () => send('exportJpg') },
        { type: 'separator' },
        { label: 'Import Custom Asset…', click: () => send('importAsset') },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        // Shortcuts are shown here but handled in the page, so they still work normally inside text boxes
        { label: 'Undo', accelerator: 'CmdOrCtrl+Z', registerAccelerator: false, click: () => send('undo') },
        { label: 'Redo', accelerator: 'CmdOrCtrl+Y', registerAccelerator: false, click: () => send('redo') },
        { type: 'separator' },
        { label: 'Cut', accelerator: 'CmdOrCtrl+X', registerAccelerator: false, click: () => send('cut') },
        { label: 'Copy', accelerator: 'CmdOrCtrl+C', registerAccelerator: false, click: () => send('copy') },
        { label: 'Paste', accelerator: 'CmdOrCtrl+V', registerAccelerator: false, click: () => send('paste') },
        { label: 'Duplicate', accelerator: 'CmdOrCtrl+D', registerAccelerator: false, click: () => send('duplicate') },
        { label: 'Select All Objects', accelerator: 'CmdOrCtrl+A', registerAccelerator: false, click: () => send('selectAll') },
        { label: 'Map Size…', click: () => send('resize') }
      ]
    },
    {
      label: 'View',
      submenu: [
        { label: 'Zoom In', accelerator: 'CmdOrCtrl+=', click: () => send('zoomIn') },
        { label: 'Zoom Out', accelerator: 'CmdOrCtrl+-', click: () => send('zoomOut') },
        { label: 'Fit to Window', accelerator: 'CmdOrCtrl+0', click: () => send('zoomFit') },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        { role: 'toggleDevTools' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        { label: 'User Guide', accelerator: 'F1', click: () => openGuide() },
        { type: 'separator' },
        { label: 'Asset & Font Licences', click: () => send('credits') },
        { label: 'Keyboard Shortcuts', click: () => send('shortcuts') },
        { label: 'Find More Free Assets (Kenney.nl, CC0)', click: () => shell.openExternal('https://kenney.nl/assets') },
        { label: 'Find More Free Icons (game-icons.net, CC BY 3.0)', click: () => shell.openExternal('https://game-icons.net') }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ---------- IPC: file dialogs ----------
// ---------- User Guide window (a separate window so it can sit beside the map)
let guideWin = null;
function openGuide(section) {
  if (guideWin && !guideWin.isDestroyed()) {
    if (section) guideWin.webContents.executeJavaScript(`location.hash = ${JSON.stringify('#' + section)}`).catch(() => {});
    guideWin.show(); guideWin.focus(); return;
  }
  guideWin = new BrowserWindow({
    width: 1080, height: 860, minWidth: 640, minHeight: 480,
    title: 'Pocket-Mapp-Creator — User Guide',
    backgroundColor: '#1d1915',
    icon: path.join(__dirname, 'build', process.platform === 'win32' ? 'icon.ico' : 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  guideWin.setMenu(null);
  guideWin.loadFile(path.join(__dirname, 'src', 'guide', 'index.html'), section ? { hash: section } : undefined);
  // web links in the guide open in the normal browser, never inside the app
  guideWin.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/i.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  guideWin.webContents.on('will-navigate', (e, url) => { if (/^https?:/i.test(url)) { e.preventDefault(); shell.openExternal(url); } });
  guideWin.webContents.on('before-input-event', (_e, input) => { if (input.type === 'keyDown' && input.key === 'Escape' && !input.alt) guideWin.close(); });
  guideWin.on('closed', () => { guideWin = null; });
}
ipcMain.handle('open-guide', (_e, section) => { openGuide(section); return true; });

ipcMain.handle('save-project', async (_e, { data, filePath }) => {
  let target = filePath;
  if (!target) {
    const r = await dialog.showSaveDialog(win, {
      title: 'Save Map',
      defaultPath: 'my-map.mapp',
      filters: [{ name: 'Pocket-Mapp-Creator Map', extensions: ['mapp'] }]
    });
    if (r.canceled || !r.filePath) return null;
    target = r.filePath;
  }
  fs.writeFileSync(target, data, 'utf8');
  return target;
});

ipcMain.handle('open-project', async () => {
  const r = await dialog.showOpenDialog(win, {
    title: 'Open Map',
    properties: ['openFile'],
    filters: [{ name: 'Pocket-Mapp-Creator Map', extensions: ['mapp', 'json'] }]
  });
  if (r.canceled || !r.filePaths.length) return null;
  return { filePath: r.filePaths[0], data: fs.readFileSync(r.filePaths[0], 'utf8') };
});

ipcMain.handle('export-image', async (_e, { dataUrl, ext }) => {
  if (process.env.MAPP_TEST) {   // automated tests: no dialog
    const out = path.join(process.env.MAPP_TEST, `export-test.${ext}`);
    fs.writeFileSync(out, typeof dataUrl === 'string' ? Buffer.from(dataUrl.split(',')[1], 'base64') : Buffer.from(dataUrl));
    return out;
  }
  const r = await dialog.showSaveDialog(win, {
    title: 'Export Map',
    defaultPath: `my-map.${ext}`,
    filters: [{ name: ext.toUpperCase(), extensions: [ext] }]
  });
  if (r.canceled || !r.filePath) return null;
  // large exports arrive as raw bytes; older callers send a data: URL
  const buf = typeof dataUrl === 'string' ? Buffer.from(dataUrl.split(',')[1], 'base64') : Buffer.from(dataUrl);
  fs.writeFileSync(r.filePath, buf);
  return r.filePath;
});

// ---------- autosave: a copy of the open map, written every minute while there are unsaved changes
const autosavePath = () => path.join(app.getPath('userData'), 'autosave.mapp');
ipcMain.handle('autosave-write', (_e, data) => { try { fs.writeFileSync(autosavePath(), data, 'utf8'); return true; } catch (_) { return false; } });
ipcMain.handle('autosave-read', () => {
  try {
    const p = autosavePath(); if (!fs.existsSync(p)) return null;
    const st = fs.statSync(p);
    return { data: fs.readFileSync(p, 'utf8'), when: st.mtime.toLocaleString() };
  } catch (_) { return null; }
});
ipcMain.handle('autosave-clear', () => { try { fs.rmSync(autosavePath(), { force: true }); } catch (_) {} return true; });

ipcMain.handle('import-assets', async () => {
  const r = await dialog.showOpenDialog(win, {
    title: 'Import Custom Assets',
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Images', extensions: ['png', 'svg', 'jpg', 'jpeg', 'webp'] }]
  });
  if (r.canceled) return [];
  return r.filePaths.map((p) => {
    const ext = path.extname(p).slice(1).toLowerCase();
    const mime = ext === 'svg' ? 'image/svg+xml' : ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
    return {
      name: path.basename(p, path.extname(p)),
      dataUrl: `data:${mime};base64,${fs.readFileSync(p).toString('base64')}`
    };
  });
});

// Native clipboard/undo actions for text boxes (needed on macOS, where these normally come from the Edit menu)
ipcMain.handle('native-edit', (_e, action) => {
  const wc = win && win.webContents; if (!wc) return false;
  const fns = { copy: () => wc.copy(), cut: () => wc.cut(), paste: () => wc.paste(), selectAll: () => wc.selectAll(), undo: () => wc.undo(), redo: () => wc.redo() };
  if (fns[action]) fns[action]();
  return true;
});

ipcMain.handle('confirm', async (_e, { message, detail }) => {
  const r = await dialog.showMessageBox(win, {
    type: 'question', buttons: ['Yes', 'Cancel'], defaultId: 0, cancelId: 1, message, detail
  });
  return r.response === 0;
});

// Headless screenshot hook used for automated testing only
ipcMain.handle('test-capture', async (_e, outPath) => {
  const img = await win.webContents.capturePage();
  fs.writeFileSync(outPath, img.toPNG());
  return true;
});

ipcMain.handle('test-write', async (_e, { outPath, dataUrl }) => {
  if (!process.env.MAPP_TEST) return false;
  fs.writeFileSync(outPath, Buffer.from(dataUrl.split(',')[1], 'base64'));
  return true;
});

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
