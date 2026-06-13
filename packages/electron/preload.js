const { contextBridge, ipcRenderer } = require("electron");

// Expose protected APIs to the renderer (Next.js web app)
contextBridge.exposeInMainWorld("electronAPI", {
  // Pi CLI
  getPiPath: () => ipcRenderer.invoke("get-pi-path"),

  // Platform info
  platform: process.platform,
  isElectron: true,
});
