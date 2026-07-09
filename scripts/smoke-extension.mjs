import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { createWriteStream, existsSync, rmSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const preferredExtensionRoot = "D:/翻译插件备份开发/yeyi-translator";
const extensionRoot = existsSync(`${preferredExtensionRoot}/manifest.json`)
  ? preferredExtensionRoot
  : resolve(scriptDir, "..");
const runId = `${process.pid}-${Date.now()}`;
const profileDir = `C:/Users/10446/Documents/codex1/tmp/yeyi-smoke-profile-${runId}`;
const pagePort = 18891 + (process.pid % 1000);
const providerPort = 19891 + (process.pid % 1000);
const cdpPort = 20891 + (process.pid % 1000);
const chromePath = findChrome();
const headless = process.argv.includes("--headless") || process.env.YEYI_HEADLESS === "1";
const chromeLogPath = `C:/Users/10446/Documents/codex1/tmp/yeyi-smoke-chrome-${runId}.log`;

let chromeProcess;
let pageServer;
let providerServer;
let chromeLogs = [];
let chromeExit = null;
const providerRequests = [];
const searchRequests = [];
const contextRequests = [];

try {
  if (existsSync(profileDir)) rmSync(profileDir, { recursive: true, force: true });
  pageServer = await serveStatic(extensionRoot, pagePort);
  providerServer = await serveProvider(providerPort);
  chromeProcess = await launchChrome();
  const cdpVersion = await waitForCdp();
  const browser = await connectCdp(cdpVersion.webSocketDebuggerUrl, { runtime: false });
  const loadedExtension = await send(browser, "Extensions.loadUnpacked", {
    path: extensionRoot,
    enableInIncognito: false
  });
  if (process.env.YEYI_DEBUG === "1") {
    console.error(`Loaded extension: ${JSON.stringify(loadedExtension)}`);
  }

  const extensionId = loadedExtension.id || loadedExtension.extensionId;
  assert(extensionId, `Extensions.loadUnpacked did not return an extension id: ${JSON.stringify(loadedExtension)}`);

  const optionsTarget = await send(browser, "Target.createTarget", {
    url: `chrome-extension://${extensionId}/src/options.html`
  });
  const attachedOptions = await send(browser, "Target.attachToTarget", {
    targetId: optionsTarget.targetId,
    flatten: true
  });
  const extensionPage = { transport: browser, sessionId: attachedOptions.sessionId };
  await waitForCondition(extensionPage, () => `!!globalThis.chrome?.storage?.local`);
  await evaluate(extensionPage, `
    chrome.storage.local.set({
      "yeyi.settings": {
        providerName: "LocalSmoke",
        baseUrl: "http://127.0.0.1:${providerPort}",
        model: "smoke-model",
        apiKey: "smoke-key",
        targetLanguage: "简体中文",
        sourceLanguage: "自动检测",
        mode: "bilingual",
        quality: "balanced",
        autoTranslate: false,
        enableCache: false,
        batchSize: 8,
        concurrency: 4,
        maxCharsPerItem: 1200,
        temperature: 0.1,
        maxTokens: 4000,
        thinkingMode: "disabled",
        glossary: "",
        requestTimeoutMs: 20000,
        maxRetries: 1,
        showFloatingBall: true,
        bilingualStyle: "none",
        searchBoxTranslate: true,
        searchBoxTranslateMode: "suggest",
        alwaysTranslateHosts: [],
        neverTranslateHosts: []
      }
    })
  `);

  const testUrl = `http://127.0.0.1:${pagePort}/test-page.html`;
  const createdTarget = await send(browser, "Target.createTarget", { url: testUrl });
  const attachedPage = await send(browser, "Target.attachToTarget", {
    targetId: createdTarget.targetId,
    flatten: true
  });
  const page = { transport: browser, sessionId: attachedPage.sessionId };
  await waitForPageReady(page);
  await delay(2800);
  const originalArticleHtml = await evaluate(page, `document.querySelector('article')?.innerHTML || ""`);

  await waitForCondition(page, () => `
    !!document.querySelector('.yeyi-floating-ball')
  `);

  await evaluate(page, `
    const input = document.querySelector('#siteSearch');
    input.value = '人工智能发展趋势';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  `);
  await waitForCondition(page, () => `
    (document.querySelector('.yeyi-search-suggest .yeyi-search-text')?.textContent || '').includes('AI development trends')
  `);
  await evaluate(page, `document.querySelector('.yeyi-search-suggest [data-action="fill"]').click()`);
  const searchAssist = await evaluate(page, `({
    value: document.querySelector('#siteSearch')?.value || "",
    panelExists: !!document.querySelector('.yeyi-search-suggest')
  })`);
  assert(searchAssist.value === "AI development trends", "search box Chinese-to-English suggestion was not filled");
  assert(!searchAssist.panelExists, "search suggestion panel remained after fill");

  await evaluate(page, `document.querySelector('.yeyi-floating-ball').click()`);

  await waitForCondition(page, () => `
    document.querySelectorAll('.yeyi-translation').length >= 4 &&
    (document.querySelector('h1')?.innerText || '').includes('[smoke]') &&
    !!document.querySelector('#nestedWrap .yeyi-translation') &&
    (document.querySelector('#longParagraph .yeyi-translation')?.textContent || '').includes('[smoke]')
  `);

  const translated = await evaluate(page, `({
    translationBlocks: document.querySelectorAll('.yeyi-translation').length,
    firstParagraphBlocks: document.querySelectorAll('article p:first-of-type .yeyi-translation').length,
    translatedLinkHref: document.querySelector('article p:first-of-type .yeyi-translation a')?.getAttribute('href') || "",
    translatedLinkText: document.querySelector('article p:first-of-type .yeyi-translation a')?.textContent || "",
    chineseBlocks: document.querySelectorAll('#chineseParagraph .yeyi-translation').length,
    nestedBlocks: document.querySelectorAll('#nestedWrap .yeyi-translation').length,
    nestedText: document.querySelector('#nestedWrap .yeyi-translation')?.textContent || "",
    longText: document.querySelector('#longParagraph .yeyi-translation')?.textContent || "",
    hasToolbar: !!document.querySelector('.yeyi-toolbar'),
    hasFloatingBall: !!document.querySelector('.yeyi-floating-ball'),
    heading: document.querySelector('h1')?.innerText || "",
    paragraph: document.querySelector('p')?.innerText || "",
    codeText: document.querySelector('code')?.textContent || "",
    buttonTranslated: Array.from(document.querySelectorAll('button')).some((button) => button.innerText.includes('[smoke]')),
    bodyText: document.body.innerText || ""
  })`);

  assert(translated.translationBlocks >= 4, "bilingual mode should insert paragraph translation blocks");
  assert(translated.firstParagraphBlocks === 1, "linked paragraph should receive exactly one translation block");
  assert(translated.translatedLinkHref === "#context", "translated link did not preserve href");
  assert(translated.translatedLinkText.includes("isolated sentences"), "translated link text was not preserved");
  assert(translated.chineseBlocks === 0, "Chinese paragraph should be skipped for Chinese target language");
  assert(translated.nestedBlocks === 1, "nested div>span content should produce exactly one translation block (no wrapper duplication)");
  assert(translated.nestedText.includes("[smoke]"), "nested div>span content inside wrapper divs was not translated");
  assert(translated.longText.includes("[smoke]"), "long split paragraph should still show assembled translation when one part is dropped");
  assert(!translated.hasToolbar, "toolbar should not exist after 0.2 redesign");
  assert(translated.hasFloatingBall, "expected floating ball on page");
  assert(translated.codeText.includes("do-not-translate-code"), "code block changed unexpectedly");
  assert(!translated.buttonTranslated, "button text was translated");
  assert(translated.heading.includes("[smoke]"), "heading bilingual translation was not rendered");
  assert(translated.bodyText.includes("[smoke]"), "fake provider output not rendered");
  assert(
    providerRequests.flat().every((item) => !item.text.includes("这一段已经是中文")),
    "Chinese paragraph was sent to provider"
  );

  await evaluate(page, `document.querySelector('.yeyi-floating-menu [data-action="context"]')?.click()`);
  await waitForCondition(page, () => `
    (document.body.innerText || "").includes('[context]') &&
    (document.querySelector('h1')?.innerText || '').includes('[context]')
  `);
  const refined = await evaluate(page, `({
    contextBlocks: document.querySelectorAll('[data-context-refined="true"]').length,
    heading: document.querySelector('h1')?.innerText || "",
    translatedLinkHref: document.querySelector('article p:first-of-type .yeyi-translation a')?.getAttribute('href') || "",
    translatedLinkText: document.querySelector('article p:first-of-type .yeyi-translation a')?.textContent || "",
    bodyText: document.body.innerText || ""
  })`);
  assert(refined.contextBlocks >= 4, "context refine should rewrite existing translation blocks");
  assert(refined.heading.includes("[context]"), "context-refined heading was not rendered");
  assert(refined.translatedLinkHref === "#context", "context-refined link did not preserve href");
  assert(refined.translatedLinkText.includes("isolated sentences"), "context-refined link text was not preserved");
  assert(contextRequests.length > 0, "context refine did not call the provider");
  assert(
    contextRequests.flat().some((item) => String(item.previousTranslation || "").includes("[smoke]")),
    "context refine did not include the previous draft translation"
  );
  assert(
    contextRequests.flat().every((item) => !String(item.headingPath || "").includes("[smoke]") && !String(item.headingPath || "").includes("[context]")),
    "context refine heading path included injected translation text"
  );

  const nextUrl = `${testUrl}?next=1`;
  await evaluate(page, `location.href = ${JSON.stringify(nextUrl)}`);
  await waitForCondition(page, () => `
    location.href === ${JSON.stringify(nextUrl)} &&
    (document.readyState === "complete" || document.readyState === "interactive")
  `);
  await waitForCondition(page, () => `
    document.querySelectorAll('.yeyi-translation').length >= 4 &&
    (document.querySelector('h1')?.innerText || '').includes('[smoke]')
  `);

  const autoTranslated = await evaluate(page, `({
    url: location.href,
    translationBlocks: document.querySelectorAll('.yeyi-translation').length,
    heading: document.querySelector('h1')?.innerText || ""
  })`);
  assert(autoTranslated.translationBlocks >= 4, "global floating-ball translate state did not continue on next page");
  await delay(2800);

  await evaluate(page, `document.querySelector('.yeyi-floating-ball').click()`);

  await waitForCondition(page, () => `
    document.querySelectorAll('.yeyi-translation').length === 0 &&
    !document.querySelector('.yeyi-toolbar') &&
    (document.querySelector('article')?.innerHTML || "") === ${JSON.stringify(originalArticleHtml)}
  `);

  const restored = await evaluate(page, `({
    translations: document.querySelectorAll('.yeyi-translation').length,
    hasToolbar: !!document.querySelector('.yeyi-toolbar'),
    articleHtml: document.querySelector('article')?.innerHTML || ""
  })`);

  assert(restored.translations === 0, "translations remained after restore");
  assert(!restored.hasToolbar, "toolbar remained after restore");
  assert(restored.articleHtml === originalArticleHtml, "article DOM was not restored to the original snapshot");

  const offUrl = `${testUrl}?next=2`;
  await evaluate(page, `location.href = ${JSON.stringify(offUrl)}`);
  await waitForCondition(page, () => `
    location.href === ${JSON.stringify(offUrl)} &&
    (document.readyState === "complete" || document.readyState === "interactive")
  `);
  await delay(1800);
  const afterCancel = await evaluate(page, `({
    translations: document.querySelectorAll('.yeyi-translation').length,
    heading: document.querySelector('h1')?.innerText || ""
  })`);
  assert(afterCancel.translations === 0, "global translate state stayed enabled after restore");

  // 新标签页：Chrome Settings 风格卡片 + 搜索框 + topSites 磁贴 + 可开关的英文搜索建议。
  const newtabTarget = await send(browser, "Target.createTarget", {
    url: `chrome-extension://${extensionId}/src/newtab.html`
  });
  const attachedNewtab = await send(browser, "Target.attachToTarget", {
    targetId: newtabTarget.targetId,
    flatten: true
  });
  const newtabPage = { transport: browser, sessionId: attachedNewtab.sessionId };
  await waitForPageReady(newtabPage);
  await waitForCondition(newtabPage, () => `
    !!document.querySelector('.ntp-search-card.settings-section') &&
    document.querySelectorAll('#tiles .ntp-tile').length >= 1
  `);
  await evaluate(newtabPage, `
    const input = document.querySelector('#queryInput');
    input.value = '人工智能趋势';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  `);
  await waitForCondition(newtabPage, () => `
    !document.querySelector('#omni')?.hidden &&
    (document.querySelector('#omniText')?.textContent || '').includes('AI development trends')
  `);
  await evaluate(newtabPage, `document.querySelector('#disableOverride')?.click()`);
  await delay(900);
  const suggestionOff = await evaluate(newtabPage, `({
    buttonText: document.querySelector('#disableOverride')?.textContent || "",
    omniHidden: document.querySelector('#omni')?.hidden === true
  })`);
  assert(suggestionOff.buttonText.includes("显示建议"), "newtab suggestion toggle did not switch off");
  assert(suggestionOff.omniHidden, "newtab suggestion remained visible after hiding suggestions");

  const ntp = await evaluate(newtabPage, `({
    tileCount: document.querySelectorAll('#tiles .ntp-tile').length,
    hasChromeSettingsShell: !!document.querySelector('.ntp.settings-page'),
    hasSettingsCards: document.querySelectorAll('.settings-section').length >= 2,
    hasSearch: !!document.querySelector('.ntp-search'),
    hasMic: !!document.querySelector('#voiceBtn'),
    hasLens: !!document.querySelector('#lensBtn'),
    hasSubmitArrow: !!document.querySelector('.ntp-search button[type="submit"]')
  })`);
  assert(ntp.tileCount >= 1, "newtab top-sites tiles did not render");
  assert(ntp.hasChromeSettingsShell && ntp.hasSettingsCards, "newtab is not using the Chrome Settings-style shell/cards");
  assert(ntp.hasSearch && ntp.hasMic && ntp.hasLens, "newtab search capsule / mic / lens buttons missing");
  assert(!ntp.hasSubmitArrow, "newtab should not keep the old blue submit-arrow button");

  const stats = await evaluate(extensionPage, `
    chrome.storage.local.get("yeyi.stats").then((value) => value["yeyi.stats"])
  `);
  assert(stats?.total?.requestedItems > 0, "usage stats did not update");
  assert(stats?.total?.totalTokens > 0, "token usage stats did not update");

  console.log(JSON.stringify({
    ok: true,
    extensionId,
    translated,
    refined,
    autoTranslated,
    searchAssist,
    restored,
    afterCancel,
    ntp,
    providerRequests,
    contextRequests,
    searchRequests,
    stats: stats.total
  }, null, 2));
} finally {
  chromeProcess?.kill();
  await closeServer(pageServer);
  await closeServer(providerServer);
}

function findChrome() {
  const candidates = [
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    `${process.env.LOCALAPPDATA || ""}/Google/Chrome/Application/chrome.exe`
  ];
  const found = candidates.find((candidate) => candidate && existsSync(candidate));
  if (!found) throw new Error("Chrome executable not found");
  return found;
}

function launchChrome() {
  return new Promise((resolve, reject) => {
    const args = [
      `--user-data-dir=${profileDir}`,
      `--remote-debugging-port=${cdpPort}`,
      "--enable-logging=stderr",
      "--v=1",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-popup-blocking",
      "about:blank"
    ];
    if (headless) {
      args.splice(
        -1,
        0,
        "--headless=new",
        "--disable-gpu",
        "--disable-gpu-compositing",
        "--disable-dev-shm-usage",
        "--in-process-gpu",
        "--use-angle=swiftshader",
        "--use-gl=swiftshader",
        "--disable-features=CanvasOopRasterization,DefaultANGLEVulkan,SkiaGraphite,Vulkan,WebGPU,WebGPUDeveloperFeatures",
        "--window-size=1280,900"
      );
    }
    chromeProcess = spawn(chromePath, args, { stdio: ["ignore", "ignore", "pipe"] });
    const chromeLogStream = createWriteStream(chromeLogPath, { flags: "a" });
    chromeProcess.stderr.on("data", (chunk) => {
      chromeLogs.push(chunk.toString("utf8"));
      chromeLogs = chromeLogs.slice(-80);
      chromeLogStream.write(chunk);
    });
    chromeProcess.once("exit", () => chromeLogStream.end());
    chromeProcess.once("exit", (code, signal) => {
      chromeExit = { code, signal };
    });
    chromeProcess.once("error", reject);
    setTimeout(() => resolve(chromeProcess), 500);
  });
}

function serveStatic(root, port) {
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url, `http://127.0.0.1:${port}`);
      const relativePath = decodeURIComponent(url.pathname).replace(/^\/+/, "") || "test-page.html";
      const fullPath = resolve(root, relativePath);
      if (!fullPath.startsWith(resolve(root))) {
        response.writeHead(403);
        response.end("Forbidden");
        return;
      }
      const data = await readFile(fullPath);
      response.writeHead(200, { "Content-Type": contentType(fullPath) });
      response.end(data);
    } catch (error) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end(String(error.message || error));
    }
  });
  return listen(server, port);
}

function serveProvider(port) {
  const server = createServer(async (request, response) => {
    if (request.method !== "POST" || !request.url.includes("/chat/completions")) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }
    const body = await readBody(request);
    const parsed = JSON.parse(body);
    const userMessage = parsed.messages.find((message) => message.role === "user")?.content || "";
    if (userMessage.includes("中文搜索词：")) {
      searchRequests.push(userMessage);
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify({
        choices: [{ message: { content: JSON.stringify({ text: "AI development trends" }) } }],
        usage: { prompt_tokens: 12, completion_tokens: 4, total_tokens: 16 }
      }));
      return;
    }
    const jsonStart = userMessage.lastIndexOf("\n[");
    const items = JSON.parse(userMessage.slice(jsonStart >= 0 ? jsonStart + 1 : userMessage.lastIndexOf("[")));
    const isContextRefine = userMessage.includes("Context refinement task.");
    if (isContextRefine) contextRequests.push(items);
    else providerRequests.push(items);
    // 模拟长段的第 2 片（::part1）丢失：验证 A2「有几片拼几片」——parent 仍应显示已成功片。
    const translations = items
      .filter((item) => isContextRefine || !/::part1$/.test(item.id))
      .map((item) => ({
        id: item.id,
        text: `${isContextRefine ? "[context]" : "[smoke]"} ${item.text}`
      }));
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({ translations }) } }],
      usage: {
        prompt_tokens: items.reduce((sum, item) => sum + Math.ceil(item.text.length / 4), 0),
        completion_tokens: translations.reduce((sum, item) => sum + Math.ceil(item.text.length / 4), 0),
        total_tokens: items.reduce((sum, item) => sum + Math.ceil(item.text.length / 4), 0) +
          translations.reduce((sum, item) => sum + Math.ceil(item.text.length / 4), 0)
      }
    }));
  });
  return listen(server, port);
}

function listen(server, port) {
  return new Promise((resolve) => {
    server.listen(port, "127.0.0.1", () => resolve(server));
  });
}

function closeServer(server) {
  if (!server) return Promise.resolve();
  return new Promise((resolve) => server.close(resolve));
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    request.on("error", reject);
  });
}

function contentType(filePath) {
  const ext = extname(filePath).toLowerCase();
  if (ext === ".html") return "text/html; charset=utf-8";
  if (ext === ".css") return "text/css; charset=utf-8";
  if (ext === ".js") return "text/javascript; charset=utf-8";
  return "application/octet-stream";
}

async function waitForCdp() {
  const started = Date.now();
  while (Date.now() - started < 15000) {
    if (chromeExit) {
      throw new Error(`Chrome exited before DevTools became ready: ${JSON.stringify(chromeExit)}\nChrome logs:\n${chromeLogs.join("").slice(-6000)}`);
    }
    try {
      const response = await fetch(`http://127.0.0.1:${cdpPort}/json/version`);
      if (response.ok) return response.json();
    } catch {
      // Retry.
    }
    await delay(250);
  }
  throw new Error(`Timed out waiting for Chrome DevTools Protocol\nChrome logs:\n${chromeLogs.join("").slice(-6000)}`);
}

async function listTargets() {
  try {
    const response = await fetch(`http://127.0.0.1:${cdpPort}/json/list`);
    return response.json();
  } catch {
    return [];
  }
}

async function findYeyiServiceWorker(expectedExtensionId = "") {
  const started = Date.now();
  const seen = new Map();
  while (Date.now() - started < 15000) {
    if (chromeExit) {
      throw new Error(`Chrome exited before Yeyi worker appeared: ${JSON.stringify(chromeExit)}\nChrome logs:\n${chromeLogs.join("").slice(-6000)}`);
    }
    const targets = (await listTargets()).filter((target) =>
      target.type === "service_worker" && target.url.startsWith("chrome-extension://")
    );

    for (const target of targets) {
      if (expectedExtensionId && !target.url.startsWith(`chrome-extension://${expectedExtensionId}/`)) {
        continue;
      }
      const client = await connectCdp(target.webSocketDebuggerUrl);
      const details = await evaluate(client, `(() => {
        const manifest = globalThis.chrome?.runtime?.getManifest?.();
        return {
          url: location.href,
          extensionId: globalThis.chrome?.runtime?.id || new URL(location.href).host,
          hasStorage: !!globalThis.chrome?.storage?.local,
          manifest
        };
      })()`);
      seen.set(details.extensionId, {
        url: details.url,
        extensionId: details.extensionId,
        hasStorage: details.hasStorage,
        manifest: details.manifest
          ? {
              name: details.manifest.name,
              version: details.manifest.version,
              background: details.manifest.background,
              options_page: details.manifest.options_page,
              action: details.manifest.action,
              permissions: details.manifest.permissions,
              host_permissions: details.manifest.host_permissions
            }
          : null
      });
      if (expectedExtensionId && details.extensionId === expectedExtensionId) {
        return { extensionId: details.extensionId, serviceWorker: client };
      }
      if (
        details.manifest?.version === "0.2.0" &&
        details.manifest?.options_page === "src/options.html" &&
        details.manifest?.action?.default_popup === "src/popup.html"
      ) {
        return { extensionId: details.extensionId, serviceWorker: client };
      }
    }

    await delay(250);
  }
  throw new Error(`Timed out finding Yeyi service worker. Candidates: ${JSON.stringify([...seen.values()], null, 2)}\nChrome logs:\n${chromeLogs.join("").slice(-6000)}`);
}

async function waitForTarget(predicate) {
  const started = Date.now();
  let targets = [];
  while (Date.now() - started < 15000) {
    if (chromeExit) {
      throw new Error(`Chrome exited before target appeared: ${JSON.stringify(chromeExit)}\nChrome logs:\n${chromeLogs.join("").slice(-6000)}`);
    }
    targets = await listTargets();
    const target = targets.find(predicate);
    if (target?.webSocketDebuggerUrl) return target;
    await delay(250);
  }
  throw new Error(`Timed out waiting for target. Targets: ${JSON.stringify(targets, null, 2)}`);
}

async function connectCdp(webSocketDebuggerUrl, options = {}) {
  const socket = new WebSocket(webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  const state = { socket, nextId: 1, pending: new Map() };
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (!message.id) return;
    const pending = state.pending.get(message.id);
    if (!pending) return;
    state.pending.delete(message.id);
    if (message.error) pending.reject(new Error(`${pending.method} failed: ${message.error.message}`));
    else pending.resolve(message.result);
  });
  if (options.runtime === true) {
    await send(state, "Runtime.enable");
  }
  return state;
}

function send(client, method, params = {}) {
  const transport = client.transport || client;
  const id = transport.nextId++;
  const message = { id, method, params };
  if (client.sessionId) message.sessionId = client.sessionId;
  transport.socket.send(JSON.stringify(message));
  return new Promise((resolve, reject) => {
    transport.pending.set(id, { resolve, reject, method });
    setTimeout(() => {
      if (!transport.pending.has(id)) return;
      transport.pending.delete(id);
      reject(new Error(`CDP timeout: ${method}`));
    }, 10000);
  });
}

async function evaluate(client, expression) {
  const result = await send(client, "Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text || "Runtime evaluation failed");
  }
  return result.result.value;
}

async function waitForPageReady(page) {
  await waitForCondition(page, () => `document.readyState === "complete" || document.readyState === "interactive"`);
}

async function waitForCondition(client, expressionFactory) {
  const started = Date.now();
  while (Date.now() - started < 10000) {
    if (await evaluate(client, expressionFactory())) return;
    await delay(250);
  }
  throw new Error(`Timed out waiting for condition: ${expressionFactory()}`);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
