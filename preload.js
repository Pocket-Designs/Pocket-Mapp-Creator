// Pocket-Mapp-Creator — preload bridge
// Copyright (c) 2026 Pocket-Designs — MIT Licence
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('mapp', {
  saveProject: (data, filePath) => ipcRenderer.invoke('save-project', { data, filePath }),
  openProject: () => ipcRenderer.invoke('open-project'),
  exportImage: (dataUrl, ext) => ipcRenderer.invoke('export-image', { dataUrl, ext }),
  importAssets: () => ipcRenderer.invoke('import-assets'),
  confirm: (message, detail) => ipcRenderer.invoke('confirm', { message, detail }),
  nativeEdit: (action) => ipcRenderer.invoke('native-edit', action),
  openGuide: (section) => ipcRenderer.invoke('open-guide', section),
  autosaveWrite: (data) => ipcRenderer.invoke('autosave-write', data),
  pickMap: (base) => ipcRenderer.invoke('pick-map', { base }),
  readMap: (link, base) => ipcRenderer.invoke('read-map', { link, base }),
  readAssets: (style, keys) => ipcRenderer.invoke('read-assets', { style, keys }),
  readFont: (file) => ipcRenderer.invoke('read-font', file),
  exportPdf: (bytes, page, name) => ipcRenderer.invoke('export-pdf', { bytes, page, name }),
  printMap: (bytes, page) => ipcRenderer.invoke('print-map', { bytes, page }),
  autosaveRead: () => ipcRenderer.invoke('autosave-read'),
  autosaveClear: () => ipcRenderer.invoke('autosave-clear'),
  isMac: process.platform === 'darwin',
  testCapture: (p) => ipcRenderer.invoke('test-capture', p),
  testWrite: (outPath, dataUrl) => ipcRenderer.invoke('test-write', { outPath, dataUrl }),
  testMode: process.env.MAPP_TEST || '',
  testQuick: process.env.MAPP_QUICK || '',
  onMenu: (fn) => ipcRenderer.on('menu', (_e, cmd) => fn(cmd))
});
