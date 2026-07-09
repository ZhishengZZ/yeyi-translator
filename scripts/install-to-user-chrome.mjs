import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const extensionRoot = resolve(scriptDir, "..");
const cdpPort = Number(process.env.YEYI_CHROME_CDP_PORT || 9222);

if (!existsSync(resolve(extensionRoot, "manifest.json"))) {
  throw new Error(`找不到扩展 manifest：${extensionRoot}`);
}

const version = await waitForCdp();
const browser = await connectCdp(version.webSocketDebuggerUrl);
const loaded = await send(browser, "Extensions.loadUnpacked", {
  path: extensionRoot,
  enableInIncognito: false
});
const extensionId = loaded.id || loaded.extensionId;
if (!extensionId) {
  throw new Error(`Chrome 没有返回扩展 ID：${JSON.stringify(loaded)}`);
}

await send(browser, "Target.createTarget", {
  url: `chrome-extension://${extensionId}/src/options.html`
});

console.log(JSON.stringify({
  ok: true,
  extensionId,
  optionsUrl: `chrome-extension://${extensionId}/src/options.html`,
  extensionRoot
}, null, 2));

async function waitForCdp() {
  const started = Date.now();
  while (Date.now() - started < 20000) {
    try {
      const response = await fetch(`http://127.0.0.1:${cdpPort}/json/version`);
      if (response.ok) return response.json();
    } catch {
      // Retry until Chrome finishes opening.
    }
    await delay(250);
  }
  throw new Error(`Chrome 调试端口 ${cdpPort} 未就绪。`);
}

async function connectCdp(webSocketDebuggerUrl) {
  const socket = new WebSocket(webSocketDebuggerUrl);
  await new Promise((resolveOpen, rejectOpen) => {
    socket.addEventListener("open", resolveOpen, { once: true });
    socket.addEventListener("error", rejectOpen, { once: true });
  });
  const state = { socket, nextId: 1, pending: new Map() };
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (!message.id) return;
    const pending = state.pending.get(message.id);
    if (!pending) return;
    state.pending.delete(message.id);
    if (message.error) pending.reject(new Error(`${pending.method} 失败：${message.error.message}`));
    else pending.resolve(message.result);
  });
  return state;
}

function send(client, method, params = {}) {
  const id = client.nextId++;
  client.socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolveSend, rejectSend) => {
    client.pending.set(id, { resolve: resolveSend, reject: rejectSend, method });
    setTimeout(() => {
      if (!client.pending.has(id)) return;
      client.pending.delete(id);
      rejectSend(new Error(`CDP 超时：${method}`));
    }, 10000);
  });
}

function delay(ms) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
}
