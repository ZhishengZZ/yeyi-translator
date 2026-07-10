import {
  DEFAULT_GLOSSARY,
  DEFAULT_SETTINGS,
  PROVIDER_PRESETS,
  SITE_HOST_PRESETS,
  hostListToText,
  mergeSettings,
  normalizeHostList,
  parseCustomSiteRules
} from "./shared.js";
import { withTimeout } from "./utils.js";
import { applyTheme } from "./theme.js";

const ids = [
  "providerName",
  "baseUrl",
  "model",
  "apiKey",
  "sourceLanguage",
  "targetLanguage",
  "theme",
  "mode",
  "bilingualStyle",
  "quality",
  "showFloatingBall",
  "batchSize",
  "concurrency",
  "maxCharsPerItem",
  "requestTimeoutMs",
  "temperature",
  "maxTokens",
  "maxRetries",
  "thinkingMode",
  "enableCache",
  "autoTranslate",
  "searchBoxTranslate",
  "searchBoxTranslateMode",
  "selectionTranslate",
  "enableNewTabOverride",
  "alwaysTranslateHosts",
  "neverTranslateHosts",
  "customSiteRules",
  "glossary"
];

const form = Object.fromEntries(ids.map((id) => [id, document.querySelector(`#${id}`)]));
const providerPreset = document.querySelector("#providerPreset");
const saveToast = document.querySelector("#saveToast");
const testProvider = document.querySelector("#testProvider");
const testResult = document.querySelector("#testResult");
const clearCache = document.querySelector("#clearCache");
const clearStats = document.querySelector("#clearStats");
const fillSitePresets = document.querySelector("#fillSitePresets");
const clearSiteRules = document.querySelector("#clearSiteRules");
const fillGlossaryPreset = document.querySelector("#fillGlossaryPreset");
const clearGlossary = document.querySelector("#clearGlossary");
const exportConfig = document.querySelector("#exportConfig");
const importConfig = document.querySelector("#importConfig");
const importFile = document.querySelector("#importFile");
const statsSummary = document.querySelector("#statsSummary");
const statsGrid = document.querySelector("#statsGrid");

let settings = DEFAULT_SETTINGS;
let saveTimer = 0;
let toastTimer = 0;

init();

async function init() {
  settings = mergeSettings({});
  renderProviderPresets();
  render();

  ids.forEach((id) => {
    form[id].addEventListener("input", scheduleSave);
    form[id].addEventListener("change", scheduleSave);
  });
  providerPreset.addEventListener("change", applyProviderPreset);
  testProvider.addEventListener("click", runProviderTest);
  clearCache.addEventListener("click", clearLocalCache);
  clearStats.addEventListener("click", clearUsageStats);
  fillSitePresets.addEventListener("click", fillDefaultSiteRules);
  clearSiteRules.addEventListener("click", clearDefaultSiteRules);
  fillGlossaryPreset.addEventListener("click", fillDefaultGlossary);
  clearGlossary.addEventListener("click", clearDefaultGlossary);
  exportConfig.addEventListener("click", exportSettings);
  importConfig.addEventListener("click", () => importFile.click());
  importFile.addEventListener("change", importSettings);

  try {
    settings = mergeSettings(await runtime({ type: "YEYI_GET_SETTINGS" }));
    applyTheme(settings.theme);
    render();
    await renderStats();
  } catch (error) {
    showToast(`后台暂未响应：${error.message}`, true);
    statsSummary.textContent = "后台暂未响应，仍可先检查和填写配置。";
  }
}

function render() {
  for (const id of ids) {
    const field = form[id];
    if (!field) continue;
    if (field.type === "checkbox") {
      field.checked = Boolean(settings[id]);
    } else if (id === "alwaysTranslateHosts" || id === "neverTranslateHosts") {
      field.value = hostListToText(settings[id]);
    } else if (id === "apiKey") {
      // 只显示用户自己填过的 Key；留空表示尚未配置。
      field.value = settings[id] || "";
    } else {
      field.value = settings[id] ?? "";
    }
  }
  syncProviderPreset();
}

function renderProviderPresets() {
  providerPreset.innerHTML = [
    '<option value="">手动配置 / 保留当前</option>',
    ...PROVIDER_PRESETS.map((preset) => `<option value="${escapeHtml(preset.id)}">${escapeHtml(preset.label)}</option>`)
  ].join("");
}

function syncProviderPreset() {
  const match = PROVIDER_PRESETS.find((preset) =>
    preset.providerName === settings.providerName &&
    preset.baseUrl === settings.baseUrl &&
    preset.model === settings.model
  );
  providerPreset.value = match?.id || "";
}

function readForm() {
  return {
    providerName: form.providerName.value.trim() || DEFAULT_SETTINGS.providerName,
    baseUrl: form.baseUrl.value.trim() || DEFAULT_SETTINGS.baseUrl,
    model: form.model.value.trim() || DEFAULT_SETTINGS.model,
    apiKey: form.apiKey.value.trim(),
    sourceLanguage: form.sourceLanguage.value.trim() || DEFAULT_SETTINGS.sourceLanguage,
    targetLanguage: form.targetLanguage.value.trim() || DEFAULT_SETTINGS.targetLanguage,
    theme: form.theme.value,
    mode: form.mode.value,
    bilingualStyle: form.bilingualStyle.value,
    quality: form.quality.value,
    showFloatingBall: form.showFloatingBall.checked,
    batchSize: Number(form.batchSize.value),
    concurrency: Number(form.concurrency.value),
    maxCharsPerItem: Number(form.maxCharsPerItem.value),
    requestTimeoutMs: Number(form.requestTimeoutMs.value),
    temperature: Number(form.temperature.value),
    maxTokens: Number(form.maxTokens.value),
    maxRetries: Number(form.maxRetries.value),
    thinkingMode: form.thinkingMode.value,
    enableCache: form.enableCache.checked,
    autoTranslate: form.autoTranslate.checked,
    searchBoxTranslate: form.searchBoxTranslate.checked,
    searchBoxTranslateMode: form.searchBoxTranslateMode.value,
    selectionTranslate: form.selectionTranslate.checked,
    enableNewTabOverride: form.enableNewTabOverride.checked,
    alwaysTranslateHosts: normalizeHostList(form.alwaysTranslateHosts.value),
    neverTranslateHosts: normalizeHostList(form.neverTranslateHosts.value),
    customSiteRules: form.customSiteRules.value,
    glossary: form.glossary.value
  };
}

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(save, 420);
}

async function save() {
  settings = await runtime({ type: "YEYI_SAVE_SETTINGS", settings: readForm() });
  // 主题改了要立即应用到当前页。
  applyTheme(settings.theme);
  // auto-save 后不 re-render：表单已是用户输入的正确值，render 会重置光标和 textarea 位置。
  const siteRuleCheck = parseCustomSiteRules(form.customSiteRules.value);
  showToast(siteRuleCheck.error ? `已保存（站点规则：${siteRuleCheck.error}）` : "已保存");
}

async function applyProviderPreset() {
  const preset = PROVIDER_PRESETS.find((item) => item.id === providerPreset.value);
  if (!preset) return;
  const currentApiKey = form.apiKey.value.trim();
  form.providerName.value = preset.providerName;
  form.baseUrl.value = preset.baseUrl;
  form.model.value = preset.model;
  form.maxTokens.value = preset.maxTokens;
  form.temperature.value = preset.temperature;
  form.requestTimeoutMs.value = preset.requestTimeoutMs;
  form.thinkingMode.value = preset.thinkingMode;
  form.apiKey.value = currentApiKey;
  await save();
  // 切换服务时，主动请求该域名的访问权限，避免翻译时报"未授权"。
  await ensureProviderPermission(readForm());
  showToast(`已套用：${preset.label}`);
}

async function runProviderTest() {
  await save();
  testProvider.disabled = true;
  testResult.hidden = false;
  testResult.dataset.state = "loading";
  testResult.textContent = "正在测试连接...";
  try {
    await ensureProviderPermission(readForm());
    const result = await runtime({ type: "YEYI_TEST_PROVIDER", settingsOverride: readForm() });
    testResult.dataset.state = "ok";
    testResult.innerHTML = `
      <strong>连接成功</strong>
      <span>延迟 ${result.latencyMs}ms</span>
      <p>${escapeHtml(result.sample || "模型服务已返回样例译文。")}</p>
    `;
  } catch (error) {
    testResult.dataset.state = "error";
    testResult.textContent = `连接失败：${error.message}`;
  } finally {
    testProvider.disabled = false;
  }
}

async function ensureProviderPermission(nextSettings) {
  if (!globalThis.chrome?.permissions?.contains) return true;
  const origin = permissionOrigin(nextSettings.baseUrl);
  if (!origin || isLocalDevOrigin(origin)) return true;

  const origins = [`${origin}/*`];
  const hasPermission = await chrome.permissions.contains({ origins });
  if (hasPermission) return true;

  showToast(`需要授权访问 ${origin}`);
  const granted = await chrome.permissions.request({ origins });
  if (!granted) throw new Error(`你拒绝了 ${origin} 的访问权限。`);
  return true;
}

function permissionOrigin(baseUrl) {
  try {
    const url = new URL(baseUrl);
    return `${url.protocol}//${url.host}`;
  } catch {
    return "";
  }
}

function isLocalDevOrigin(origin) {
  return (
    origin === "http://localhost" ||
    origin === "http://127.0.0.1"
  );
}

async function clearLocalCache() {
  await runtime({ type: "YEYI_CLEAR_CACHE" });
  showToast("缓存已清空。");
}

async function clearUsageStats() {
  await runtime({ type: "YEYI_CLEAR_STATS" });
  await renderStats();
  showToast("用量统计已清空。");
}

async function fillDefaultSiteRules() {
  form.alwaysTranslateHosts.value = hostListToText(uniqueHostsForForm([
    ...normalizeHostList(form.alwaysTranslateHosts.value),
    ...SITE_HOST_PRESETS.always
  ]));
  form.neverTranslateHosts.value = hostListToText(uniqueHostsForForm([
    ...normalizeHostList(form.neverTranslateHosts.value),
    ...SITE_HOST_PRESETS.never
  ]));
  await save();
  showToast("已填入常用网站预设。");
}

async function clearDefaultSiteRules() {
  form.alwaysTranslateHosts.value = "";
  form.neverTranslateHosts.value = "";
  await save();
  showToast("网站规则已清空。");
}

async function fillDefaultGlossary() {
  const current = form.glossary.value.trim();
  form.glossary.value = current ? `${current}\n${DEFAULT_GLOSSARY}` : DEFAULT_GLOSSARY;
  await save();
  showToast("已填入 AI 术语预设。");
}

async function clearDefaultGlossary() {
  form.glossary.value = "";
  await save();
  showToast("术语表已清空。");
}

async function renderStats() {
  const stats = await runtime({ type: "YEYI_GET_STATS" });
  const total = stats.total || {};
  statsSummary.textContent = [
    `请求次数：${total.requests || 0}`,
    `翻译段落：${total.requestedItems || 0}`,
    `缓存命中：${total.cachedItems || 0}`,
    `模型字符：${total.requestedChars || 0}`,
    `缓存字符：${total.cachedChars || 0}`,
    `Token：${total.totalTokens || 0}`
  ].join(" · ");
  statsGrid.innerHTML = [
    statCard("总 Token", total.totalTokens || 0),
    statCard("输入 Token", total.promptTokens || 0),
    statCard("输出 Token", total.completionTokens || 0),
    statCard("模型字符", total.requestedChars || 0),
    statCard("缓存字符", total.cachedChars || 0),
    statCard("缓存命中段落", total.cachedItems || 0)
  ].join("");
}

function statCard(label, value) {
  return `<div class="stat-card"><span>${escapeHtml(label)}</span><strong>${formatNumber(value)}</strong></div>`;
}

function exportSettings() {
  const safe = { ...readForm(), apiKey: "" };
  const blob = new Blob([JSON.stringify(safe, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "yeyi-settings.json";
  link.click();
  URL.revokeObjectURL(url);
  showToast("配置已导出，文件中不包含 API Key。");
}

async function importSettings() {
  const file = importFile.files?.[0];
  if (!file) return;
  try {
    const imported = JSON.parse(await file.text());
    delete imported.apiKey;
    settings = await runtime({
      type: "YEYI_SAVE_SETTINGS",
      settings: { ...readForm(), ...imported, apiKey: readForm().apiKey }
    });
    applyTheme(settings.theme);
    render();
    showToast("配置已导入，本机 API Key 已保留。");
  } catch (error) {
    showToast(`导入失败：${error.message}`, true);
  } finally {
    importFile.value = "";
  }
}

async function runtime(message) {
  if (!globalThis.chrome?.runtime?.sendMessage) {
    return previewRuntime(message);
  }
  const response = await withTimeout(
    chrome.runtime.sendMessage(message),
    message.type === "YEYI_TEST_PROVIDER" ? 65000 : 3500,
    "后台暂未响应。"
  );
  if (!response?.ok) throw new Error(response?.error || "请求失败。");
  return response.payload;
}

function showToast(message, isError = false) {
  saveToast.textContent = message;
  saveToast.dataset.state = isError ? "error" : "ok";
  saveToast.dataset.show = "true";
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    saveToast.dataset.show = "false";
  }, 1800);
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatNumber(value) {
  return new Intl.NumberFormat("zh-CN").format(Number(value) || 0);
}

function uniqueHostsForForm(list) {
  return Array.from(new Set(normalizeHostList(list)));
}

function previewRuntime(message) {
  const key = "yeyi.preview.settings";
  const statsKey = "yeyi.preview.stats";
  const saved = JSON.parse(localStorage.getItem(key) || "null");
  if (message.type === "YEYI_GET_SETTINGS") {
    return mergeSettings(saved);
  }
  if (message.type === "YEYI_SAVE_SETTINGS") {
    const next = mergeSettings({ ...saved, ...message.settings });
    localStorage.setItem(key, JSON.stringify(next));
    return next;
  }
  if (message.type === "YEYI_CLEAR_CACHE") {
    localStorage.removeItem("yeyi.preview.cache");
    return { cleared: true };
  }
  if (message.type === "YEYI_GET_STATS") {
    return JSON.parse(localStorage.getItem(statsKey) || "null") || {
      total: { requests: 0, requestedItems: 0, cachedItems: 0, requestedChars: 0, cachedChars: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      byDay: {},
      byHost: {}
    };
  }
  if (message.type === "YEYI_CLEAR_STATS") {
    localStorage.removeItem(statsKey);
    return previewRuntime({ type: "YEYI_GET_STATS" });
  }
  if (message.type === "YEYI_TEST_PROVIDER") {
    throw new Error("预览模式不能测试模型连接，请加载 Chrome 扩展后再测试。");
  }
  return {};
}
