# 01_hello - 第一个 Electron 应用

一个最小的 Electron 桌面应用示例，演示主进程、预加载脚本和渲染进程之间的通信。

## 功能演示

- 创建 Electron 窗口
- 使用预加载脚本（preload.js）安全地暴露 API 给渲染进程
- IPC 通信：渲染进程通过按钮点击获取主进程中的应用版本号

## 项目结构

```
01_hello/
├── index.html    # 渲染进程 UI
├── index.js     # 主进程入口
├── preload.js   # 预加载脚本（安全桥接）
└── package.json
```

## 运行方式

```bash
cd 01_hello
npm install
npm start
```

---

## 原理详解

### Electron 进程模型

```
┌─────────────────────────────────────────────────────┐
│                    Main Process                     │
│                    (主进程)                          │
│                                                      │
│   index.js                                           │
│   ├── app.whenReady() ← 应用入口点                   │
│   ├── BrowserWindow ← 创建窗口                       │
│   └── ipcMain.handle() ← 注册 IPC 处理程序           │
└──────────────────────┬──────────────────────────────┘
                        │  preload.js (桥接)
                        │  contextBridge 暴露 API
┌──────────────────────▼──────────────────────────────┐
│                 Renderer Process                     │
│                 (渲染进程)                            │
│                                                      │
│   index.html + inline JS                            │
│   └── window.electronAPI.getAppVersion()            │
└─────────────────────────────────────────────────────┘
```

---

### 1. 主进程入口 (index.js)

```javascript
const { app, BrowserWindow, ipcMain } = require("electron");
```

**三个核心模块：**

| 模块 | 作用 |
|------|------|
| `app` | 控制应用生命周期 |
| `BrowserWindow` | 创建和管理窗口 |
| `ipcMain` | 主进程接收渲染进程消息的渠道 |

#### 窗口创建

```javascript
mainWindow = new BrowserWindow({
  width: 800,
  height: 600,
  webPreferences: {
    preload: path.join(__dirname, "preload.js"),
    nodeIntegration: false,
    contextIsolation: true,
  },
});
```

**关键配置解释：**

| 配置项 | 值 | 作用 |
|--------|-----|------|
| `preload` | `"preload.js"` | 指定预加载脚本路径 |
| `nodeIntegration` | `false` | 渲染进程禁用 Node.js 访问 |
| `contextIsolation` | `true` | 隔离预加载脚本与渲染进程上下文 |

#### IPC 处理程序

```javascript
ipcMain.handle("get-app-version", () => {
  return app.getVersion();
});
```

- `ipcMain.handle()` 注册一个**异步处理程序**
- 当渲染进程调用 `"get-app-version"` 时，返回 `app.getVersion()` 的结果
- `handle` vs `on`：前者支持 Promise 返回值，后者是单向消息

#### 应用生命周期

```javascript
app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
```

- `whenReady()` — Electron 初始化完成后的回调
- `window-all-closed` — 所有窗口关闭时（macOS 除外）退出应用

---

### 2. 预加载脚本 (preload.js)

```javascript
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  getAppVersion: () => ipcRenderer.invoke("get-app-version"),
});
```

**为什么需要预加载脚本？**

```
Without preload (nodeIntegration: false, contextIsolation: true):

┌─────────────────────────────────────────┐
│ Renderer Process                         │
│                                          │
│ window (sandboxed)                       │
│   ├── NO access to Node.js               │
│   ├── NO access to Electron APIs         │
│   └── window.electronAPI = undefined     │
└─────────────────────────────────────────┘

With preload (contextBridge):

┌─────────────────────────────────────────┐
│ Renderer Process                         │
│                                          │
│ window (sandboxed)                       │
│   └── window.electronAPI = {            │
│         getAppVersion: () => {...}       │
│       }                                  │
└─────────────────────────────────────────┘
          ▲
          │ ipcRenderer.invoke()
          ▼
┌─────────────────────────────────────────┐
│ Main Process                              │
│   └── ipcMain.handle("get-app-version")  │
└─────────────────────────────────────────┘
```

**安全原则：最小暴露**

- 只暴露必要的 API
- `ipcRenderer.invoke()` 是异步的，不会直接暴露主进程对象

---

### 3. 渲染进程 (index.html)

```html
<button id="btn">获取版本信息</button>
<script>
  const version = await window.electronAPI.getAppVersion();
</script>
```

- 渲染进程代码像普通网页一样执行
- 通过 `window.electronAPI` 间接调用主进程功能
- 无法直接访问 Node.js 或 Electron API

---

### 4. IPC 完整调用链

```
用户点击按钮
    │
    ▼
index.html: window.electronAPI.getAppVersion()
    │
    ▼ (ipcRenderer.invoke)
preload.js: ipcRenderer.invoke("get-app-version")
    │
    ▼ (IPC 通道)
index.js: ipcMain.handle("get-app-version")
    │
    ▼
app.getVersion() → "1.0.0"
    │
    ▼ (原路返回)
index.html: versionSpan.innerText = "1.0.0"
```

---

### 5. 安全要点总结

| 实践 | 说明 |
|------|------|
| `contextIsolation: true` | 防止渲染进程 JavaScript 污染预加载脚本上下文 |
| `nodeIntegration: false` | 渲染进程无法直接 require Node.js 模块 |
| `contextBridge` | 显式、有限地暴露 API |

---

## 扩展学习路径

1. **添加窗口事件** — `mainWindow.on('close')`、`mainWindow.webContents.on('did-finish-load')`
2. **发送消息到主进程** — `ipcRenderer.send()` + `ipcMain.on()`
3. **渲染进程主动通知** — `webContents.send()` 从主进程推送到渲染进程
4. **多窗口通信** — 通过主进程作为消息中转站

## 扩展阅读

- [Electron 官方文档](https://www.electronjs.org/docs)
- [Electron 安全最佳实践](https://www.electronjs.org/docs/tutorial/security)
