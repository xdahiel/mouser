const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('automation', {
  capturePosition: () => ipcRenderer.invoke('automation:capture-position'),
  startPickMode: () => ipcRenderer.invoke('automation:start-pick-mode'),
  stopPickMode: () => ipcRenderer.invoke('automation:stop-pick-mode'),
  updateLastConfig: (config) => ipcRenderer.invoke('automation:update-last-config', config),
  start: (config) => ipcRenderer.invoke('automation:start', config),
  stop: () => ipcRenderer.invoke('automation:stop'),
  onError: (handler) => {
    const wrapped = (_event, message) => handler(message);
    ipcRenderer.on('automation:error', wrapped);
    return () => ipcRenderer.removeListener('automation:error', wrapped);
  },
  onPickPosition: (handler) => {
    const wrapped = (_event, position) => handler(position);
    ipcRenderer.on('automation:pick-position', wrapped);
    return () => ipcRenderer.removeListener('automation:pick-position', wrapped);
  },
  onPickModeEnded: (handler) => {
    const wrapped = (_event, payload) => handler(payload);
    ipcRenderer.on('automation:pick-mode-ended', wrapped);
    return () => ipcRenderer.removeListener('automation:pick-mode-ended', wrapped);
  },
  onRunningChanged: (handler) => {
    const wrapped = (_event, payload) => handler(payload);
    ipcRenderer.on('automation:running-changed', wrapped);
    return () => ipcRenderer.removeListener('automation:running-changed', wrapped);
  }
});
