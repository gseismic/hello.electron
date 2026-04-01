const { contextBridge, ipcRenderer } = require("electron");

// 向 window 对象注入一个安全的 API
contextBridge.exposeInMainWorld("electronAPI", {
  getAppVersion: () => ipcRenderer.invoke("get-app-version"),
});
