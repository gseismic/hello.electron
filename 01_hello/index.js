const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      // 关键配置：启用预加载脚本
      preload: path.join(__dirname, "preload.js"),
      // 安全建议：生产环境中通常关闭 nodeIntegration
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.loadFile("index.html");

  // 开发模式下打开开发者工具
  // mainWindow.webContents.openDevTools();
}

// 当 Electron 完成初始化时创建窗口
app.whenReady().then(createWindow);

// 监听来自渲染进程的请求
ipcMain.handle("get-app-version", () => {
  return app.getVersion();
});

// 所有窗口关闭时退出应用 (macOS 除外)
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
