import { cleanHost } from "./shared.js";
import { matchesHost, removeHost, runtime, uniqueHosts, withTimeout } from "./utils.js";
import { applyTheme, nextTheme, themeLabel } from "./theme.js";

const elements = {
  providerLine: document.querySelector("#providerLine"),
  mainAction: document.querySelector("#mainAction"),
  popupControls: document.querySelector("#popupControls"),
  onboardCard: document.querySelector("#onboardCard"),
  onboardGo: document.querySelector("#onboardGo"),
  contextRefine: document.querySelector("#contextRefine"),
  modeButtons: Array.from(document.querySelectorAll("[data-mode]")),
  quality: document.querySelector("#quality"),
  siteRule: document.querySelector("#siteRule"),
  progressBlock: document.querySelector("#progressBlock"),
  progressText: document.querySelector("#progressText"),
  progressCount: document.querySelector("#progressCount"),
  progressBar: document.querySelector("#progressBar"),
  errorLine: document.querySelector("#errorLine"),
  goSettings: document.querySelector("#goSettings"),
  retryFailed: document.querySelector("#retryFailed"),
  openOptions: document.querySelector("#openOptions"),
  hintText: document.querySelector("#hintText"),
  themeToggle: document.querySelector("#themeToggle")
};

let settings = {
  apiKey: "",
  hasApiKey: false,
  providerName: "",
  model: "",
  quality: "balanced",
  theme: "auto"
};
let activeTab = null;
let activeHost = "";
let currentStatus = {
  active: false,
  translatedCount: 0,
  totalCount: 0,
  errorCount: 0,
  pendingCount: 0,
  queuedCount: 0,
  contextRefining: false,
  error: ""
};

init();

async function init() {
  elements.openOptions.addEventListener("click", () => chrome.runtime.openOptionsPage());
  elements.onboardGo.addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
  });
  elements.goSettings.addEventListener("click", () => chrome.runtime.openOptionsPage());
  elements.retryFailed.addEventListener("click", retryFailedSegments);
  elements.mainAction.addEventListener("click", handleMainAction);
  elements.contextRefine.addEventListener("click", contextRefinePage);
  elements.quality.addEventListener("change", savePopupSettings);
  elements.siteRule.addEventListener("change", saveSiteRule);
  elements.themeToggle.addEventListener("click", toggleTheme);
  for (const button of elements.modeButtons) {
    button.addEventListener("click", () => setMode(button.dataset.mode));
  }

  renderSettings();
  try {
    settings = await runtime({ type: "YEYI_GET_SETTINGS" });
    activeTab = await getActiveTab();
    activeHost = hostFromTab(activeTab);
    applyTheme(settings.theme);
    renderThemeButton();
    renderSettings();
    await refreshStatus();
  } catch (error) {
    renderError(error?.message || "后台暂未响应。");
  }

  chrome.runtime?.onMessage?.addListener?.((message) => {
    if (message?.type === "YEYI_STATUS") renderStatus(message.status);
  });
}

function renderThemeButton() {
  elements.themeToggle.textContent = themeLabel(settings.theme);
  elements.themeToggle.title = `主题：${themeLabel(settings.theme)}（点击切换）`;
}

async function toggleTheme() {
  settings.theme = nextTheme(settings.theme);
  applyTheme(settings.theme);
  renderThemeButton();
  try {
    settings = await runtime({ type: "YEYI_SAVE_SETTINGS", settings: { theme: settings.theme } });
  } catch {
    // 保存失败不阻塞本地切换。
  }
}

function renderSettings() {
  const hasKey = Boolean(settings.hasApiKey ?? settings.apiKey);
  elements.providerLine.textContent = hasKey
    ? `${settings.providerName} · ${settings.model || "未设置模型"}`
    : "未配置模型";
  elements.onboardCard.hidden = hasKey;
  elements.mainAction.hidden = !hasKey;
  elements.contextRefine.hidden = !hasKey;
  elements.popupControls.hidden = !hasKey;
  elements.quality.value = settings.quality || "balanced";
  renderModeButtons();
  renderSiteRule();
  if (hasKey) {
    elements.hintText.textContent = "点击主按钮即可翻译当前页面。";
  } else {
    elements.hintText.textContent = "配置 API Key 后即可开始翻译。";
  }
}

function renderModeButtons() {
  for (const button of elements.modeButtons) {
    button.dataset.active = button.dataset.mode === settings.mode ? "true" : "false";
  }
}

function renderSiteRule() {
  if (!activeHost) {
    elements.siteRule.value = "default";
    elements.siteRule.disabled = true;
    return;
  }
  elements.siteRule.disabled = false;
  if (matchesHost(activeHost, settings.neverTranslateHosts)) {
    elements.siteRule.value = "never";
  } else if (matchesHost(activeHost, settings.alwaysTranslateHosts)) {
    elements.siteRule.value = "always";
  } else {
    elements.siteRule.value = "default";
  }
}

async function setMode(mode) {
  settings = { ...settings, mode };
  renderModeButtons();
  settings = await runtime({ type: "YEYI_SAVE_SETTINGS", settings });
  renderSettings();
  if (currentStatus.active) {
    await startPageTranslation();
  }
}

async function savePopupSettings() {
  settings = { ...settings, quality: elements.quality.value };
  settings = await runtime({ type: "YEYI_SAVE_SETTINGS", settings });
  renderSettings();
  if (currentStatus.active) await startPageTranslation();
}

async function saveSiteRule() {
  if (!activeHost) return;
  const rule = elements.siteRule.value;
  const always = removeHost(settings.alwaysTranslateHosts, activeHost);
  const never = removeHost(settings.neverTranslateHosts, activeHost);
  if (rule === "always") always.push(activeHost);
  if (rule === "never") never.push(activeHost);
  settings = await runtime({
    type: "YEYI_SAVE_SETTINGS",
    settings: {
      alwaysTranslateHosts: uniqueHosts(always),
      neverTranslateHosts: uniqueHosts(never)
    }
  });
  renderSettings();
}

async function handleMainAction() {
  clearError();
  if (currentStatus.active) {
    await restoreCurrentPage();
    return;
  }
  if (!settings.hasApiKey && !settings.apiKey) {
    renderError("请先配置 API Key。");
    chrome.runtime.openOptionsPage();
    return;
  }
  await startPageTranslation();
}

async function startPageTranslation() {
  elements.mainAction.disabled = true;
  try {
    await tabMessage(
      { type: "YEYI_START", settings: { mode: settings.mode, quality: settings.quality } },
      { injectOnFail: true }
    );
    await refreshStatus();
  } catch (error) {
    renderError(error?.message || "翻译启动失败。");
  } finally {
    elements.mainAction.disabled = false;
  }
}

async function restoreCurrentPage() {
  elements.mainAction.disabled = true;
  try {
    await tabMessage({ type: "YEYI_RESTORE" }, { injectOnFail: false });
    await refreshStatus();
  } catch (error) {
    renderError(error?.message || "恢复失败。");
  } finally {
    elements.mainAction.disabled = false;
  }
}

async function retryFailedSegments() {
  elements.retryFailed.disabled = true;
  try {
    await tabMessage({ type: "YEYI_RETRY_FAILED" }, { injectOnFail: false });
    await refreshStatus();
  } catch (error) {
    renderError(error?.message || "重试失败。");
  } finally {
    elements.retryFailed.disabled = false;
  }
}

async function contextRefinePage() {
  clearError();
  if (!settings.hasApiKey && !settings.apiKey) {
    renderError("请先配置 API Key。");
    chrome.runtime.openOptionsPage();
    return;
  }
  elements.contextRefine.disabled = true;
  try {
    await tabMessage({ type: "YEYI_CONTEXT_REFINE" }, { injectOnFail: true });
    await refreshStatus();
  } catch (error) {
    renderError(error?.message || "上下文精翻启动失败。");
  } finally {
    elements.contextRefine.disabled = Boolean(currentStatus.contextRefining) ||
      currentStatus.pendingCount > 0 ||
      currentStatus.queuedCount > 0;
  }
}

async function refreshStatus() {
  try {
    // injectOnFail:true —— 慢站/刚注入的页也能取到状态，不再显示空白进度。
    const result = await tabMessage({ type: "YEYI_GET_STATUS" }, { injectOnFail: true });
    renderStatus(result);
  } catch {
    renderStatus({
      active: false,
      translatedCount: 0,
      totalCount: 0,
      errorCount: 0,
      pendingCount: 0,
      queuedCount: 0,
      contextRefining: false,
      error: ""
    });
  }
}

function renderStatus(status) {
  currentStatus = { ...currentStatus, ...(status || {}) };
  const total = currentStatus.totalCount || 0;
  const translated = currentStatus.translatedCount || 0;
  const errorCount = currentStatus.errorCount || 0;
  const percent = total ? Math.round((translated / total) * 100) : 0;
  const refining = Boolean(currentStatus.contextRefining);
  const working = refining || currentStatus.pendingCount > 0 || currentStatus.queuedCount > 0;
  const unresolved = Math.max(0, total - translated - errorCount);

  elements.mainAction.textContent = currentStatus.active ? "恢复原文" : "翻译此页";
  elements.contextRefine.textContent = refining ? "正在上下文精翻…" : "上下文精翻";
  elements.contextRefine.disabled = refining || currentStatus.pendingCount > 0 || currentStatus.queuedCount > 0;
  elements.progressCount.textContent = `${translated} / ${total}`;
  elements.progressBar.style.width = `${Math.min(100, percent)}%`;
  elements.progressBlock.hidden = !working;

  if (currentStatus.error) {
    renderError(currentStatus.error);
  } else {
    clearError();
  }

  if (working) {
    if (refining) {
      elements.progressText.textContent = "正在上下文精翻";
    } else {
      elements.progressText.textContent = currentStatus.pendingCount > 0 ? "正在翻译" : "等待处理";
    }
  }

  // 有失败段才显示「重试失败段」按钮。
  elements.retryFailed.hidden = !(currentStatus.active && errorCount > 0);

  const skipped = currentStatus.skippedCount || 0;
  const skippedNote = skipped > 0 ? `其中 ${skipped} 段无需翻译。` : "";
  if (currentStatus.active && translated > 0 && !working) {
    if (errorCount > 0) {
      elements.hintText.textContent = `有 ${errorCount} 段翻译失败，可点「重试失败段」重试。`;
    } else if (unresolved > 0) {
      elements.hintText.textContent = `还有 ${unresolved} 段未完成，滚动页面或稍等会继续处理。`;
    } else {
      elements.hintText.textContent = `已翻译。${skippedNote}专业长文可点「上下文精翻」统一校准。`;
    }
  } else if (!currentStatus.active) {
    elements.hintText.textContent = settings.hasApiKey || settings.apiKey
      ? "点击主按钮即可翻译当前页面。"
      : "配置 API Key 后即可开始翻译。";
  }
}

function renderError(message) {
  elements.errorLine.hidden = false;
  elements.errorLine.textContent = message;
  elements.goSettings.hidden = !/API Key|设置|接口|模型|授权|权限/.test(message);
}

function clearError() {
  elements.errorLine.hidden = true;
  elements.errorLine.textContent = "";
  elements.goSettings.hidden = true;
}

async function tabMessage(message, options = {}) {
  if (!globalThis.chrome?.tabs?.sendMessage) {
    return {
      active: false,
      translatedCount: 0,
      totalCount: 0,
      pendingCount: 0,
      error: "预览模式不能操作网页，请加载 Chrome 扩展后使用。"
    };
  }
  if (!activeTab?.id) throw new Error("没有可用的当前标签页。");

  try {
    return await sendTabMessage(message);
  } catch (error) {
    if (!options.injectOnFail) throw error;
    await ensureContentScript(activeTab);
    return sendTabMessage(message);
  }
}

async function sendTabMessage(message) {
  const response = await withTimeout(
    chrome.tabs.sendMessage(activeTab.id, message),
    4000,
    "页面脚本暂未响应。"
  );
  if (!response?.ok) throw new Error(response?.error || "页面脚本没有响应。");
  return response.payload;
}

async function ensureContentScript(tab) {
  if (!canInject(tab?.url)) throw new Error("此页面不支持翻译。");
  if (!globalThis.chrome?.scripting?.executeScript) {
    throw new Error("当前浏览器不支持按需注入页面脚本。");
  }
  try {
    await chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: ["src/content.css"] });
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["src/content.js"] });
  } catch {
    throw new Error("此页面不支持翻译。");
  }
}

async function getActiveTab() {
  if (!globalThis.chrome?.tabs?.query) return null;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function canInject(url) {
  try {
    const parsed = new URL(url || "");
    if (!["http:", "https:"].includes(parsed.protocol)) return false;
    if (parsed.hostname === "chrome.google.com" && parsed.pathname.startsWith("/webstore")) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function hostFromTab(tab) {
  try {
    return cleanHost(new URL(tab?.url || "").host);
  } catch {
    return "";
  }
}
