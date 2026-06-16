const { contextBridge, ipcRenderer } = require("electron");

// Expose protected APIs to the renderer (Next.js web app)
contextBridge.exposeInMainWorld("electronAPI", {
  // Pi CLI
  getPiPath: () => ipcRenderer.invoke("get-pi-path"),

  // Native folder picker
  openFolderDialog: () => ipcRenderer.invoke("open-folder-dialog"),

  // Platform info
  platform: process.platform,
  isElectron: true,

  // Version & updates
  getVersion: () => ipcRenderer.invoke("get-version"),
  checkForUpdates: () => ipcRenderer.invoke("check-for-updates"),
});
