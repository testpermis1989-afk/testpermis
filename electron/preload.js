const { contextBridge } = require('electron');

// Expose protected APIs to renderer
contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  isElectron: true,
  getDataPath: () => {
    // Will be filled by main process
    return null;
  },
});
