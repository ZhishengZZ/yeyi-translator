import { mergeSettings } from "./shared.js";
import { applyTheme, nextTheme, themeLabel } from "./theme.js";

const GOOGLE_SEARCH = "https://www.google.com/search?q=";
const MAX_TOP_SITES = 10;
const TILE_COLORS = ["#4285F4", "#EA4335", "#FBBC05", "#34A853", "#A142F4", "#24C1E0", "#FF6D00"];

const els = {
  form: document.querySelector("#searchForm"),
  input: document.querySelector("#queryInput"),
  omni: document.querySelector("#omni"),
  omniRow: document.querySelector("#omniRow"),
  omniText: document.querySelector("#omniText"),
  omniTag: document.querySelector("#omniTag"),
  tiles: document.querySelector("#tiles"),
  voiceBtn: document.querySelector("#voiceBtn"),
  lensBtn: document.querySelector("#lensBtn"),
  themeToggle: document.querySelector("#themeToggle"),
  disableOverride: document.querySelector("#disableOverride")
};

let settings = { theme: "auto", enableNewTabOverride: true };
let timer = 0;
let requestId = 0;
let currentSuggestion = "";
let isComposing = false;

init();

async function init() {
  try {
    settings = await runtime({ type: "YEYI_GET_SETTINGS" });
  } catch {
    // 后台未就绪时用默认。
  }
  applyTheme(settings.theme);
  renderThemeButton();
  renderSuggestionButton();

  els.form.addEventListener("submit", (event) => {
    event.preventDefault();
    submitSearch();
  });
  els.input.addEventListener("input", scheduleSuggest);
  els.input.addEventListener("compositionstart", () => { isComposing = true; });
  els.input.addEventListener("compositionend", () => { isComposing = false; scheduleSuggest(); });
  els.omniRow.addEventListener("click", () => search(currentSuggestion || els.input.value));
  els.voiceBtn.addEventListener("click", startVoiceSearch);
  els.lensBtn.addEventListener("click", () => window.open("https://lens.google.com/", "_blank", "noopener"));
  els.themeToggle.addEventListener("click", toggleTheme);
  els.disableOverride.addEventListener("click", toggleSuggestions);

  renderTiles();
}

// ---------- 常用网站磁贴（chrome.topSites） ----------

async function renderTiles() {
  let sites = [];
  try {
    if (globalThis.chrome?.topSites?.get) {
      sites = filterTopSites(await chrome.topSites.get()).slice(0, MAX_TOP_SITES);
    }
  } catch {
    // 权限或环境不支持时只保留“添加快捷方式”，不展示固定站点。
  }

  els.tiles.replaceChildren();
  for (const site of sites) els.tiles.append(buildTile(site));
  els.tiles.append(buildAddTile());
}

function filterTopSites(sites) {
  const seen = new Set();
  const result = [];
  for (const site of Array.isArray(sites) ? sites : []) {
    const url = cleanTileUrl(site.url);
    if (!url) continue;
    const key = siteKey(url);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ ...site, url });
  }
  return result;
}

function cleanTileUrl(value) {
  try {
    const url = new URL(String(value || ""));
    if (!["http:", "https:"].includes(url.protocol)) return "";
    return url.href;
  } catch {
    return "";
  }
}

function siteKey(value) {
  try {
    const url = new URL(value);
    return `${url.protocol}//${url.hostname.replace(/^www\./, "").toLowerCase()}`;
  } catch {
    return value;
  }
}

function buildTile(site) {
  const url = String(site.url || "");
  const title = String(site.title || hostOf(url) || url);
  const tile = document.createElement("a");
  tile.className = "ntp-tile";
  tile.href = url;
  tile.title = title;

  const icon = document.createElement("span");
  icon.className = "ntp-tile-icon";
  const favicon = faviconUrl(url);
  if (favicon) {
    const img = document.createElement("img");
    img.src = favicon;
    img.alt = "";
    img.width = 24;
    img.height = 24;
    // favicon 取不到时回退到首字母色块。
    img.addEventListener("error", () => icon.replaceChildren(letterBadge(title)), { once: true });
    icon.append(img);
  } else {
    icon.append(letterBadge(title));
  }

  const label = document.createElement("span");
  label.className = "ntp-tile-name";
  label.textContent = title;

  tile.append(icon, label);
  return tile;
}

function buildAddTile() {
  const tile = document.createElement("button");
  tile.type = "button";
  tile.className = "ntp-tile ntp-tile-add";
  tile.title = "添加快捷方式";
  const icon = document.createElement("span");
  icon.className = "ntp-tile-icon";
  icon.textContent = "+";
  const label = document.createElement("span");
  label.className = "ntp-tile-name";
  label.textContent = "添加快捷方式";
  tile.append(icon, label);
  tile.addEventListener("click", () => els.input.focus());
  return tile;
}

function letterBadge(title) {
  const badge = document.createElement("span");
  badge.className = "ntp-tile-letter";
  const ch = String(title || "?").trim().charAt(0).toUpperCase() || "?";
  badge.textContent = ch;
  badge.style.background = TILE_COLORS[ch.charCodeAt(0) % TILE_COLORS.length];
  return badge;
}

function faviconUrl(pageUrl) {
  const id = globalThis.chrome?.runtime?.id;
  if (!id || !pageUrl) return "";
  return `chrome-extension://${id}/_favicon/?pageUrl=${encodeURIComponent(pageUrl)}&size=32`;
}

// ---------- omnibox 式中译英建议 ----------

function scheduleSuggest() {
  if (isComposing) return;
  clearTimeout(timer);
  currentSuggestion = "";
  if (settings.enableNewTabOverride === false) {
    hideOmni();
    return;
  }
  const query = normalize(els.input.value);
  if (query.length < 2 || !hasCjk(query)) {
    hideOmni();
    return;
  }
  showOmni("正在生成英文搜索词…", true);
  timer = setTimeout(() => suggest(query).catch(() => hideOmni()), 520);
}

async function suggest(query) {
  const id = ++requestId;
  const result = await runtime({ type: "YEYI_TRANSLATE_SEARCH_QUERY", text: query });
  if (id !== requestId || normalize(els.input.value) !== query) return;
  currentSuggestion = normalize(result?.text);
  if (!currentSuggestion) {
    hideOmni();
    return;
  }
  showOmni(currentSuggestion, false);
}

function showOmni(text, loading) {
  els.omni.hidden = false;
  els.omniText.textContent = text;
  els.omniTag.hidden = loading;
  els.omniRow.disabled = loading;
}

function hideOmni() {
  els.omni.hidden = true;
  els.omniText.textContent = "";
  currentSuggestion = "";
}

// ---------- 搜索 / 直达 ----------

function submitSearch() {
  // 有英文建议就用英文词搜；否则用原词。
  search(currentSuggestion || els.input.value);
}

function search(value) {
  const query = normalize(value);
  if (!query) return;
  if (isUrl(query)) {
    location.href = query.startsWith("http") ? query : `https://${query}`;
    return;
  }
  location.href = `${GOOGLE_SEARCH}${encodeURIComponent(query)}`;
}

function isUrl(query) {
  if (/\s/.test(query)) return false;
  if (/^https?:\/\//i.test(query)) return true;
  // 形如 example.com、www.a.co、example.com/path：点分域名 + 字母顶级域。
  return /^([\w-]+\.)+[a-z]{2,}(\/\S*)?$/i.test(query);
}

function startVoiceSearch() {
  const Recognition = globalThis.webkitSpeechRecognition || globalThis.SpeechRecognition;
  if (!Recognition) {
    els.input.focus();
    return;
  }
  try {
    const recognition = new Recognition();
    recognition.lang = "zh-CN";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript || "";
      if (transcript) {
        els.input.value = transcript;
        els.input.dispatchEvent(new Event("input", { bubbles: true }));
        els.input.focus();
      }
    };
    recognition.start();
  } catch {
    els.input.focus();
  }
}

// ---------- 主题 / 接管开关 ----------

function renderThemeButton() {
  els.themeToggle.textContent = themeLabel(settings.theme);
  els.themeToggle.title = `主题：${themeLabel(settings.theme)}（点击切换）`;
}

function renderSuggestionButton() {
  const enabled = settings.enableNewTabOverride !== false;
  els.disableOverride.textContent = enabled ? "隐藏建议" : "显示建议";
  els.disableOverride.title = enabled
    ? "隐藏中文搜索词的英文建议"
    : "显示中文搜索词的英文建议";
}

async function toggleTheme() {
  settings.theme = nextTheme(settings.theme);
  applyTheme(settings.theme);
  renderThemeButton();
  try {
    await runtime({ type: "YEYI_SAVE_SETTINGS", settings: { theme: settings.theme } });
  } catch {
    // 保存失败不阻塞本地切换体验。
  }
}

async function toggleSuggestions() {
  settings.enableNewTabOverride = settings.enableNewTabOverride === false;
  renderSuggestionButton();
  if (settings.enableNewTabOverride === false) hideOmni();
  else scheduleSuggest();
  try {
    await runtime({ type: "YEYI_SAVE_SETTINGS", settings: { enableNewTabOverride: settings.enableNewTabOverride } });
  } catch {
    settings.enableNewTabOverride = !settings.enableNewTabOverride;
    renderSuggestionButton();
  }
}

// ---------- 工具 ----------

async function runtime(message) {
  if (!globalThis.chrome?.runtime?.sendMessage) {
    if (message.type === "YEYI_GET_SETTINGS") return mergeSettings({});
    return {};
  }
  const response = await chrome.runtime.sendMessage(message);
  if (!response?.ok) throw new Error(response?.error || "请求失败。");
  return response.payload;
}

function normalize(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function hasCjk(value) {
  return /[㐀-鿿豈-﫿]/.test(String(value || ""));
}

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}
