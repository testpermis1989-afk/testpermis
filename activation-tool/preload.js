const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getMachineInfo: () => ipcRenderer.invoke('get-machine-info'),
  adminLogin: (password) => ipcRenderer.invoke('admin-login', password),
  generateCode: (machineCode, durationCode) => ipcRenderer.invoke('generate-code', machineCode, durationCode),
  activate: (activationCode) => ipcRenderer.invoke('activate', activationCode),
  getActivations: () => ipcRenderer.invoke('get-activations'),
  getStatus: () => ipcRenderer.invoke('get-status'),
  deleteLicense: (code) => ipcRenderer.invoke('delete-license', code),
});
