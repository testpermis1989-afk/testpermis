const { contextBridge, ipcRenderer } = require('electron');

// Expose protected APIs to renderer via contextBridge
contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  isElectron: true,
  
  // Get application paths (data dir, db dir, etc.)
  getAppPaths: () => ipcRenderer.invoke('get-app-paths'),
  
  // Get machine code for licensing
  getMachineInfo: () => ipcRenderer.invoke('get-machine-info'),
  
  // Check if running in Electron
  isDesktop: () => true,
});
