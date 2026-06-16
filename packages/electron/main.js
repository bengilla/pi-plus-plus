const { app, BrowserWindow, dialog, ipcMain, shell } = require("electron");
const path = require("path");
const { spawn, execSync } = require("child_process");
const fs = require("fs");

const PORT = 31508;
const SERVER_URL = `http://localhost:${PORT}`;
let serverProcess = null;
let mainWindow = null;
let installWindow = null;

// ── Paths ────────────────────────────────────────────────
const isDev = !app.isPackaged;
const resourcesPath = isDev
  ? path.join(__dirname, "..", "web")
  : path.join(process.resourcesPath, "server");

const serverDir = isDev
  ? path.join(__dirname, "..", "web")
  : path.join(process.resourcesPath, "server");

const serverEntry = isDev
  ? null  // dev mode uses npm run dev
  : path.join(process.resourcesPath, "server", "packages", "web", "server.js");

// ── Pi CLI Detection ─────────────────────────────────────
function findPi() {
  // Try `which pi` with shell (inherits user's shell profile)
  try {
    const bin = execSync("which pi", {
      encoding: "utf8",
      shell: process.env.SHELL || "/bin/zsh",
      env: { ...process.env },
    }).trim();
    if (bin && fs.existsSync(bin)) return bin;
  } catch {
    // not found via shell
  }

  // Try direct execSync (uses process.env.PATH)
  try {
    const bin = execSync("which pi", { encoding: "utf8" }).trim();
    if (bin && fs.existsSync(bin)) return bin;
  } catch {
    // not found
  }

  // Common hardcoded fallbacks
  const candidates = [
    "/opt/homebrew/bin/pi",
    "/usr/local/bin/pi",
    path.join(process.env.HOME || "/", ".hermes/node/bin/pi"),
    path.join(process.env.HOME || "/", ".nvm/versions/node/*/bin/pi"),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

// ── Install Window ───────────────────────────────────────
function showInstallWindow() {
  if (installWindow) {
    installWindow.focus();
    return;
  }

  installWindow = new BrowserWindow({
    width: 520,
    height: 480,
    resizable: false,
    frame: true,
    title: "pi++ — 安装 Pi CLI",
    webPreferences: { nodeIntegration: true, contextIsolation: false },
  });

  installWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`
<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="UTF-8"><title>安装 Pi CLI</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    background: #1a1a1a; color: #e0e0e0;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    height: 100vh; padding: 40px; text-align: center;
  }
  .icon { width: 56px; height: 56px; margin-bottom: 20px; }
  h1 { font-size: 24px; font-weight: 600; margin-bottom: 8px; color: #fff; }
  .subtitle { font-size: 14px; color: #999; margin-bottom: 28px; line-height: 1.6; }
  .btn {
    display: inline-block; padding: 10px 28px; font-size: 15px;
    border: 1px solid #4ade80; color: #4ade80; background: transparent;
    cursor: pointer; border-radius: 0; font-weight: 500;
    transition: background 0.2s;
  }
  .btn:hover { background: rgba(74,222,128,0.1); }
  .btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .status { margin-top: 20px; font-size: 13px; color: #888; min-height: 40px; line-height: 1.5; }
  .error { color: #f87171; }
  .success { color: #4ade80; }
  .progress { color: #facc15; }
  .spinner { display: inline-block; animation: spin 0.8s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
</style></head>
<body>
  <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADgAAAA4CAYAAACohjseAAADUElEQVR4nO2Yz28bRRTHv+/N7NopSSnqLwUJpCYSh+TSA3fCDSGBhFTzB3Dg3Bu9IMcXVJV/gwOqD1UviFuTfwFILvySKMHCpbhJE2ft3XkPzZqkibR2nCUt6mo+ku317PvOm7c7s9r5AoFAIBAIBAKBwP8DlRE19K7pYqOUtjRrwPq7reyF5nwZoFPGqj9o/HrnFkf2appkSqQE8ASZnNDtZK0qaVRncol7vLzY/6JFLYGCQKOxnIRFCVRxs3Zp7qrZGxwpuxgiGn8Z1fc1STyKsTMR+p3tJ2vA7Smu2H8vEIqtwV9PX8mSVACKiWALiyQfqgP/VdgPgQhUG6tVZIAOXd+yEh6WGao9RezhMCzi94ec1lXUGaJW9OrMJ+n2fgZf6LNoZWvIiXwoqfveGnDmRlf/4JisXWaDbzWV0aR7ps2i8zN2uNP/Spx+nqZiDGGwTv8+ZKacnqXv4NeLN/88OL7x4+1t4jFz0DeLbt1769bvRac/+unLCzDF2rxPpu17i58Vap/zFFVqbKxGS21kPxy9a4UZbNxsNrnzesfM/zHv8rYVMNYg31kTT1pSqmq9dnMZtt1YTUE09Z2b5hE2HiLtLkNarZaQTk7KEPVxvdd6ebz/YGWkZZWJWgLl2u5lSJniyhf4EsGoOIyKw6g4jIrDqDiMisOoOIyKw6g4jIrDZYW76NDUjoCCuhvdw9jN9qbf8EzrJtDu3ClynVWBC+j5bcCJL8Ck7EvRFawfbhvuNtri2xhmmhdoXfhlulxnVmBTmwwsGf+rRzeqhRlcHtf54FNz0LSKZt7mz02SKojyuKVRrhdmOt34+c43pm4Xsv1MiHCFmC6oqOd4f96PUf2NDQ/Fyf6e1N+pRX9z7GYfwGBGnMQgetN7E8dlpMREKvpEFV1bM+wG2UNavPZemz52z990Irxdv3T+cupNJ1GIc8cch6NwxNc4thjuJDBpZOLHsTXz8fVorgYZOkjqinNAwcZcBNPF6FyM3a3e/KMSXqxFOe4nj3becIPM+3p+IXnzzBtkhwM4+M8Ep+y/JTmX9NKns3Cz/eH9LBnWSaCiYsZpc8+KyLm9hBnauYLNUuuw0lAZUdkFn5u2Z6APBAKBQCAQCAQCgUAAJ/APfw54+ugIXOQAAAAASUVORK5CYII=" alt="pi++" class="icon" />
  <h1>Pi CLI 未安装</h1>
  <p class="subtitle">Pi 是 AI 对话引擎，pi++ 依赖它运行。<br>点击下方按钮自动安装（通过 npm）。</p>
  <button class="btn" id="installBtn" onclick="install()">🟢 安装 Pi CLI</button>
  <div class="status" id="status"></div>
  <script>
    const { exec } = require("child_process");
    let installed = false;

    function install() {
      const btn = document.getElementById("installBtn");
      const status = document.getElementById("status");
      btn.disabled = true;
      status.innerHTML = '<span class="progress"><span class="spinner">⏳</span> 正在安装 @earendil-works/pi-coding-agent...</span>';

      exec("npm install -g @earendil-works/pi-coding-agent", (err, stdout, stderr) => {
        if (err) {
          status.innerHTML = '<span class="error">❌ 安装失败<br>' +
            '请手动运行: <code style="background:#333;padding:2px 6px;border-radius:3px">npm install -g @earendil-works/pi-coding-agent</code><br>' +
            stderr.toString().substring(stderr.length - 200) + '</span>';
          btn.disabled = false;
          btn.textContent = '🔁 重试';
          return;
        }
        status.innerHTML = '<span class="success">✅ 安装成功！正在启动...</span>';
        installed = true;
        setTimeout(() => {
          window.close();
        }, 1000);
      });
    }

    window.addEventListener("beforeunload", () => {
      if (installed) {
        require("electron").ipcRenderer.send("pi-installed");
      }
    });
  </script>
</body></html>`)}`);

  installWindow.on("closed", () => {
    installWindow = null;
  });
}

// ── Proxy Environment ────────────────────────────────────
// When the app is launched from Finder/Dock, it doesn't inherit
// HTTP_PROXY/HTTPS_PROXY from the terminal shell. Read them from
// the user's shell profile so spawned processes can reach external APIs.
function readProxyFromShell() {
  const proxyVars = {};
  // Only these env vars should be inherited (avoid leaking NODE_OPTIONS etc.)
  const PROXY_KEYS = new Set(["HTTP_PROXY", "HTTPS_PROXY", "http_proxy", "https_proxy", "NO_PROXY", "no_proxy"]);
  try {
    const shell = process.env.SHELL || "/bin/zsh";
    // macOS: zsh -l -c only reads .zprofile, NOT .zshrc.
    // Source .zshrc explicitly to get proxy vars set there.
    const cmd = `${shell} -c 'source ~/.zshrc 2>/dev/null; printf "HTTP_PROXY=%s\n" "$HTTP_PROXY"; printf "HTTPS_PROXY=%s\n" "$HTTPS_PROXY"; printf "http_proxy=%s\n" "$http_proxy"; printf "https_proxy=%s\n" "$https_proxy"; printf "NO_PROXY=%s\n" "$NO_PROXY"; printf "no_proxy=%s\n" "$no_proxy"'`;
    const out = execSync(cmd, { encoding: "utf8", timeout: 3000 });
    for (const line of out.trim().split("\n")) {
      const eqIdx = line.indexOf("=");
      if (eqIdx === -1) continue;
      const k = line.slice(0, eqIdx);
      const v = line.slice(eqIdx + 1);
      if (k && v && !process.env[k] && PROXY_KEYS.has(k)) {
        proxyVars[k] = v;
      }
    }
  } catch { /* shell profile not available */ }
  return proxyVars;
}

// ── Find Node.js ─────────────────────────────────────────
function findNode() {
  // Try shell PATH first (inherits user's shell profile)
  try {
    const bin = execSync("which node", {
      encoding: "utf8",
      shell: process.env.SHELL || "/bin/zsh",
      env: { ...process.env },
    }).trim();
    if (bin && fs.existsSync(bin)) return bin;
  } catch {}

  try {
    const bin = execSync("which node", { encoding: "utf8" }).trim();
    if (bin && fs.existsSync(bin)) return bin;
  } catch {}

  // Hardcoded fallbacks
  const candidates = [
    "/opt/homebrew/bin/node",
    "/usr/local/bin/node",
    path.join(process.env.HOME || "/", ".hermes/node/bin/node"),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

// ── Start Next.js Server ─────────────────────────────────
function startServer() {
  return new Promise((resolve, reject) => {
    const serverScript = path.join(
      __dirname,
      isDev ? "../../node_modules/.bin/next" : "server.js"
    );
    const args = isDev ? ["dev", "-p", String(PORT)] : [];
    const cwd = isDev ? path.join(__dirname, "..", "web") : resourcesPath;

    if (isDev) {
      const nodeBin = findNode();
      if (!nodeBin) throw new Error("Node.js not found");

      // Filter out API keys from env
      const devEnv = {};
      for (const [k, v] of Object.entries(process.env)) {
        if (v == null) continue;
        if (k.endsWith("_API_KEY") || k.endsWith("_API_SECRET")) continue;
        devEnv[k] = v;
      }
      // Inherit proxy from shell (needed when launched from Finder)
      const shellProxyDev = readProxyFromShell();
      Object.assign(devEnv, shellProxyDev);

      serverProcess = spawn(nodeBin, [serverScript, "dev", "-p", String(PORT)], {
        cwd: path.join(__dirname, "..", "web"),
        env: { ...devEnv, NODE_ENV: "development" },
        stdio: ["ignore", "pipe", "pipe"],
      });
    } else {
      const nodeBin = findNode();
      console.log(`[electron] Node.js found at: ${nodeBin}`);
      if (!nodeBin) throw new Error("Node.js not found");
      const cwd = path.join(resourcesPath, "packages", "web");
      console.log(`[electron] CWD: ${cwd}, server.js exists: ${fs.existsSync(path.join(cwd, "server.js"))}`);
      // Preserve process.env but filter out secrets
      const cleanEnv = {};
      for (const [k, v] of Object.entries(process.env)) {
        if (v == null) continue;
        if (k.endsWith("_API_KEY") || k.endsWith("_API_SECRET")) continue;
        if (k === "NODE_OPTIONS" && v.includes("proxy-preload")) continue;
        cleanEnv[k] = v;
      }
      // Inherit proxy from shell (needed when launched from Finder)
      const shellProxy = readProxyFromShell();
      Object.assign(cleanEnv, shellProxy);

      serverProcess = spawn(nodeBin, ["server.js"], {
        cwd,
        env: {
          ...cleanEnv,
          NODE_ENV: "production",
          PORT: String(PORT),
          PATH: `${process.env.PATH}:/opt/homebrew/bin:/usr/local/bin`,
        },
        stdio: ["ignore", "pipe", "pipe"],
      });
      console.log(`[electron] Server PID: ${serverProcess.pid}`);
      serverProcess.on("error", (err) => {
        console.error(`[electron] Server spawn error: ${err.message}`);
        reject(err);
      });
      serverProcess.on("close", (code) => {
        console.error(`[electron] Server exited with code ${code}`);
        if (code !== null && code !== 0) reject(new Error(`Server exited code ${code}`));
      });
    }

    serverProcess.stdout.on("data", (data) => {
      process.stdout.write(`[server] ${data}`);
    });
    serverProcess.stderr.on("data", (data) => {
      process.stderr.write(`[server] ${data}`);
    });

    // Poll for readiness
    let attempts = 0;
    const maxAttempts = 60;
    const check = () => {
      attempts++;
      const http = require("http");
      const req = http.get(`${SERVER_URL}/api/pi/version`, (res) => {
        if (res.statusCode === 200) resolve();
        else if (attempts < maxAttempts) setTimeout(check, 1000);
        else reject(new Error("Server not ready"));
      });
      req.on("error", () => {
        if (attempts < maxAttempts) setTimeout(check, 1000);
        else reject(new Error("Server not ready after timeout"));
      });
      req.setTimeout(2000, () => {
        req.destroy();
        if (attempts < maxAttempts) setTimeout(check, 1000);
        else reject(new Error("Server not ready after timeout"));
      });
    };
    setTimeout(check, 500);
  });
}

// ── Main Window ──────────────────────────────────────────
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: "pi++",
    backgroundColor: "#1a1a1a",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadURL(SERVER_URL);

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// ── App Lifecycle ────────────────────────────────────────
app.whenReady().then(async () => {
  // Check Pi CLI
  const piPath = findPi();

  if (!piPath) {
    showInstallWindow();

    // When user closes install window, re-check
    installWindow?.on("closed", () => {
      const found = findPi();
      if (found) {
        bootstrap(found);
      } else {
        // Still not installed — show again or quit
        const choice = dialog.showMessageBoxSync({
          type: "question",
          buttons: ["重试安装", "退出"],
          title: "pi++",
          message: "Pi CLI 仍未安装。pi++ 需要 Pi 才能运行。",
        });
        if (choice === 0) showInstallWindow();
        else app.quit();
      }
    });
    return;
  }

  await bootstrap(piPath);
});

async function bootstrap(piPath) {
  console.log(`Pi CLI found at: ${piPath}`);
  console.log(`Resources path: ${resourcesPath}`);
  console.log(`isDev: ${isDev}`);

  try {
    await startServer();
    console.log(`Server ready at ${SERVER_URL}`);
  } catch (err) {
    console.error("Failed to start server:", err);
    dialog.showErrorBox("启动失败", `无法启动 pi++ 服务器：${err.message}`);
    app.quit();
    return;
  }

  createMainWindow();
}

// ── IPC Handlers ─────────────────────────────────────────
ipcMain.on("pi-installed", async () => {
  const piPath = findPi();
  if (piPath) {
    if (installWindow) installWindow.close();
    await bootstrap(piPath);
  }
});

ipcMain.handle("get-pi-path", () => findPi());

ipcMain.handle("open-folder-dialog", async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Open Project Folder",
    properties: ["openDirectory", "createDirectory"],
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

// ── Cleanup ──────────────────────────────────────────────
app.on("window-all-closed", () => {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
  app.quit();
});

app.on("before-quit", () => {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
});
