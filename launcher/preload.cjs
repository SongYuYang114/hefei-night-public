'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('launcher', {
  state: () => ipcRenderer.invoke('launcher-state'),
  check: () => ipcRenderer.invoke('launcher-check'),
  download: () => ipcRenderer.invoke('launcher-download'),
  cancel: () => ipcRenderer.invoke('launcher-cancel'),
  apply: () => ipcRenderer.invoke('launcher-apply'),
  play: () => ipcRenderer.invoke('launcher-play'),
  help: () => ipcRenderer.invoke('launcher-help'),
  onUpdate: callback => { const listener = (_event, state) => callback(state); ipcRenderer.on('launcher-update', listener); return () => ipcRenderer.removeListener('launcher-update', listener); }
});
