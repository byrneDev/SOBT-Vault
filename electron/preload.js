const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld("vault", {
  version: "2026.1.0",

  // Generic invoke bridge used by the dashboard
  invoke: (channel, data) => ipcRenderer.invoke(channel, data),

  // Platform API helpers used by modules
  selectZip: () => ipcRenderer.invoke('vault:select-zip'),
  buildSco: (zipPath, title) => ipcRenderer.invoke('vault:build-sco', { zipPath, title }),
  clearUploads: () => ipcRenderer.invoke('vault:clear-uploads'),
  getVersion: () => ipcRenderer.invoke('vault:get-version'),
  showAbout: () => ipcRenderer.invoke('vault:show-about'),
  toggleDevTools: () => ipcRenderer.invoke('vault:toggle-devtools'),

  // Event subscription helper
  on: (channel, callback) => {
    ipcRenderer.on(channel, (_event, ...args) => callback(...args));
  }
});
