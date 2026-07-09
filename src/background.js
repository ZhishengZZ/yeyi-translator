import {
  DEFAULT_SETTINGS,
  QUALITY_LABELS,
  STORAGE_KEYS,
  clampNumber,
  glossaryToText,
  mergeSettings,
  normalizeBaseUrl,
  normalizeHostList,
  nowDayKey,
  providerCapabilities,
  shortHash
} from "./shared.js";

const runtimeCache = new Map();
const inflightTabs = new Set();
let cacheLoaded = false;
let cacheDirty = false;
let cacheWriteTimer = 0;
const CACHE_DIRTY_KEY = "yeyi.cacheDirty";

const STYLE_GUIDES = {
  balanced: [
    "信：先守住原文事实、逻辑关系、语气和信息密度，不擅自增删判断。",
    "达：中文要明白、顺畅、可一口气读懂；允许按中文习惯调整语序、拆分长句、补足必要衔接。",
    "雅：不是堆砌文采，而是用词得体、克制、凝练；网页内容读起来像认真编辑过的中文稿。",
    "遇到双关、梗、俚语、习语和固定表达，先判断上下文含义，再译成中文里功能相近的说法；不要逐词硬译。",
    "专名、数字、代码、术语和 <tN>...</tN> 占位标签必须保真。"
  ].join("\n"),
  precise: [
    "目标是忠实校勘式翻译：尽量保留原文信息顺序、概念边界、限定词和因果/转折关系。",
    "允许轻度调整语序让中文可读，但不要重写作者风格，不要合并或删减关键限定。",
    "术语、专名、数字、引用、条件、范围、否定和模态词要严格对应；必要时可括注原文关键词。",
    "俚语和习语仍按语义翻译，但要避免过度本土化导致原文语气失真。"
  ].join("\n"),
  fluent: [
    "目标是自然中文：像中文网页、专栏、博客或新闻正文里原生写出来的内容。",
    "优先按中文阅读节奏重组句子，去掉翻译腔和英文语序残留；长句可拆，短句可自然衔接。",
    "把英文中的代词、被动、名词化结构、插入语转换成中文更常见的表达。",
    "俚语、口语、梗和轻松表达要译出语气和场景感，可用中文里自然的等效说法，但不能偏离事实。",
    "不要过度文学化，不要像公告或论文腔。"
  ].join("\n"),
  technical: [
    "目标是技术文档式翻译：准确、清楚、可执行。",
    "API、命令、路径、文件名、类名、函数名、配置项、错误码、协议名和代码符号不翻译。",
    "术语使用行业通行译法，同一页面保持一致；必要时保留英文原词。",
    "步骤、条件、限制、输入输出、风险和边界要说清楚；不要文学化，也不要随意润色。",
    "技术俚语按技术社区常用说法翻译，例如 edge case、fallback、breaking change 等要译成自然的技术中文。"
  ].join("\n"),
  business: [
    "目标是商务正式：稳妥、清晰、专业，适合邮件、公告、报告、产品说明和管理材料。",
    "保留责任主体、时间、金额、条件、范围、承诺和风险提示，不弱化也不夸大。",
    "语气要礼貌、明确、可信，避免网络口语和文学化修饰。",
    "俚语或幽默表达要转换为符合商务场景的中文含义，不保留不合时宜的玩笑感。"
  ].join("\n"),
  literary: [
    "目标是文学表达：保留意象、节奏、叙述视角和情绪张力。",
    "可更灵活地调整句式，让中文有韵律和画面感，但不能改写情节、立场或信息。",
    "比喻、双关、俚语和文化典故要优先译出功能和审美效果；无法兼顾时，意义优先，文采随后。",
    "不要堆砌华丽词，不要把朴素原文翻成过度抒情。"
  ].join("\n")
};

const CONTEXT_REFINE_GUIDE = [
  "这是一次上下文精翻/校准任务，面向专业、高难度、上下文依赖强的文本。",
  "把页面标题、大纲、当前段前后文和已有译文作为校准依据，重新确认术语、代词指代、逻辑关系、俚语/习语含义和语体一致性。",
  "优先修正：错译、漏译、直译腔、语境不合、术语前后不一致、俚语硬译、代词指代不明、长句逻辑断裂。",
  "可以以 previousTranslation 为草稿，但不要被草稿绑架；若草稿不准，以原文和上下文为准。",
  "输出仍必须只翻译当前 text 字段，不翻译 before/after/context 字段本身。",
  "保持 <tN>...</tN> 占位标签及其中内容对应关系，不得删除、改名或打乱标签。"
].join("\n");

chrome.runtime.onInstalled.addListener(async () => {
  const stored = await chrome.storage.local.get([
    STORAGE_KEYS.settings,
    STORAGE_KEYS.stats
  ]);
  const existing = stored[STORAGE_KEYS.settings];
  if (!existing) {
    await chrome.storage.local.set({ [STORAGE_KEYS.settings]: DEFAULT_SETTINGS });
  } else {
    const migrated = clearUnkeyedProviderDefaults(existing);
    if (migrated !== existing) {
      await chrome.storage.local.set({ [STORAGE_KEYS.settings]: migrated });
    }
  }
  if (!stored[STORAGE_KEYS.stats]) {
    await chrome.storage.local.set({ [STORAGE_KEYS.stats]: emptyStats() });
  }
});

chrome.commands?.onCommand.addListener(async (command) => {
  if (command !== "toggle-translation") return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  chrome.tabs.sendMessage(tab.id, { type: "YEYI_TOGGLE" }).catch(() => {});
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender)
    .then((payload) => sendResponse({ ok: true, payload }))
    .catch((error) => sendResponse({ ok: false, error: formatError(error) }));
  return true;
});

async function handleMessage(message, sender) {
  switch (message?.type) {
    case "YEYI_GET_SETTINGS":
      return getSettings();
    case "YEYI_GET_CONTENT_SETTINGS":
      return publicContentSettings(await getSettings());
    case "YEYI_GET_GLOBAL_STATE":
      return getGlobalState();
    case "YEYI_SET_GLOBAL_TRANSLATE":
      return setGlobalTranslate(Boolean(message.enabled));
    case "YEYI_SAVE_SETTINGS":
      return saveSettings(message.settings);
    case "YEYI_TRANSLATE_BATCH":
      return translateBatch(message.items || [], message.settingsOverride || {}, sender);
    case "YEYI_CONTEXT_REFINE_BATCH":
      return contextRefineBatch(message.items || [], message.settingsOverride || {}, sender);
    case "YEYI_TRANSLATE_SEARCH_QUERY":
      return translateSearchQuery(message.text || "");
    case "YEYI_TEST_PROVIDER":
      return testProvider(message.settingsOverride || {});
    case "YEYI_CLEAR_CACHE":
      runtimeCache.clear();
      cacheLoaded = true;
      cacheDirty = false;
      clearTimeout(cacheWriteTimer);
      await chrome.storage.local.set({ [STORAGE_KEYS.cache]: {}, [CACHE_DIRTY_KEY]: false });
      return { cleared: true };
    case "YEYI_GET_STATS":
      return getStats();
    case "YEYI_CLEAR_STATS":
      await chrome.storage.local.set({ [STORAGE_KEYS.stats]: emptyStats() });
      return emptyStats();
    case "YEYI_OPEN_OPTIONS":
      await chrome.runtime.openOptionsPage();
      return { opened: true };
    case "YEYI_STATUS":
      // content 主动上报状态，无需处理；静默接收避免落入 default 抛错。
      return null;
    default:
      throw new Error("未知请求。");
  }
}

async function getSettings() {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.settings);
  const clean = sanitizeSettings(stored[STORAGE_KEYS.settings]);
  return {
    ...clean,
    hasApiKey: Boolean(clean.apiKey?.trim())
  };
}

function clearUnkeyedProviderDefaults(settings) {
  if (!settings || settings.apiKey?.trim()) return settings;
  if (!settings.providerName && !settings.baseUrl && !settings.model) return settings;
  return {
    ...settings,
    providerName: "",
    baseUrl: "",
    model: ""
  };
}

async function saveSettings(nextSettings) {
  const current = await getSettings();
  const clean = sanitizeSettings({ ...current, ...(nextSettings || {}) });
  await chrome.storage.local.set({ [STORAGE_KEYS.settings]: clean });
  return clean;
}

function sanitizeSettings(settings) {
  const merged = mergeSettings(settings);
  return {
    ...merged,
    baseUrl: normalizeBaseUrl(merged.baseUrl),
    batchSize: clampNumber(merged.batchSize, 3, 40, DEFAULT_SETTINGS.batchSize),
    maxCharsPerItem: clampNumber(
      merged.maxCharsPerItem,
      120,
      3000,
      DEFAULT_SETTINGS.maxCharsPerItem
    ),
    temperature: clampNumber(merged.temperature, 0, 1, DEFAULT_SETTINGS.temperature),
    maxTokens: clampNumber(merged.maxTokens, 512, 16000, DEFAULT_SETTINGS.maxTokens),
    requestTimeoutMs: clampNumber(
      merged.requestTimeoutMs,
      10000,
      120000,
      DEFAULT_SETTINGS.requestTimeoutMs
    ),
    maxRetries: clampNumber(merged.maxRetries, 0, 4, DEFAULT_SETTINGS.maxRetries),
    concurrency: clampNumber(merged.concurrency, 1, 8, DEFAULT_SETTINGS.concurrency),
    showFloatingBall: Boolean(merged.showFloatingBall),
    bilingualStyle: ["none", "leftLine", "underline", "softBlock"].includes(merged.bilingualStyle)
      ? merged.bilingualStyle
      : DEFAULT_SETTINGS.bilingualStyle,
    searchBoxTranslate: Boolean(merged.searchBoxTranslate),
    searchBoxTranslateMode: ["suggest", "replace"].includes(merged.searchBoxTranslateMode)
      ? merged.searchBoxTranslateMode
      : DEFAULT_SETTINGS.searchBoxTranslateMode,
    enableNewTabOverride: merged.enableNewTabOverride !== false,
    theme: ["auto", "light", "dark"].includes(merged.theme) ? merged.theme : "auto",
    alwaysTranslateHosts: normalizeHostList(merged.alwaysTranslateHosts),
    neverTranslateHosts: normalizeHostList(merged.neverTranslateHosts)
  };
}

function publicContentSettings(settings) {
  const clean = sanitizeSettings(settings);
  const { apiKey, ...safe } = clean;
  return getGlobalState().then((globalState) => ({
    ...safe,
    // content 只知道是否已配置 Key，拿不到 Key 本体。
    hasApiKey: Boolean(apiKey?.trim()),
    globalTranslateActive: Boolean(globalState.enabled)
  }));
}

async function getGlobalState() {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.globalState);
  return {
    enabled: Boolean(stored[STORAGE_KEYS.globalState]?.enabled),
    updatedAt: stored[STORAGE_KEYS.globalState]?.updatedAt || ""
  };
}

async function setGlobalTranslate(enabled) {
  const next = { enabled, updatedAt: new Date().toISOString() };
  await chrome.storage.local.set({ [STORAGE_KEYS.globalState]: next });
  return next;
}

// 同一标签页的批次互斥：避免快速点击 / 滚动触发多个并行批次打爆 provider 速率限制。
async function translateBatch(items, settingsOverride, sender) {
  const tabId = sender?.tab?.id || 0;
  if (inflightTabs.has(tabId)) {
    return { translations: {}, errors: {}, cached: 0, requested: 0, busy: true };
  }
  inflightTabs.add(tabId);
  try {
    return await runTranslateBatch(items, settingsOverride, sender);
  } finally {
    inflightTabs.delete(tabId);
  }
}

async function contextRefineBatch(items, settingsOverride, sender) {
  const tabId = sender?.tab?.id || 0;
  if (inflightTabs.has(tabId)) {
    return { translations: {}, errors: {}, cached: 0, requested: 0, busy: true };
  }
  inflightTabs.add(tabId);
  try {
    return await runContextRefineBatch(items, settingsOverride, sender);
  } finally {
    inflightTabs.delete(tabId);
  }
}

async function runTranslateBatch(items, settingsOverride, sender) {
  const settings = sanitizeSettings({ ...(await getSettings()), ...settingsOverride });
  ensureConfigured(settings);
  await ensureHostPermission(settings);

  const normalized = normalizeItems(items, settings);
  if (!normalized.length) return { translations: {}, cached: 0, requested: 0 };

  const translations = {};
  const partBuckets = new Map();
  const uncached = [];
  let cachedChars = 0;

  await ensureCacheLoaded(settings);

  for (const item of normalized) {
    const key = cacheKey(settings, item.text);
    const value = settings.enableCache ? runtimeCache.get(key) : undefined;
    if (value) {
      recordTranslation(item, value, translations, partBuckets);
      cachedChars += item.text.length;
    } else {
      uncached.push({ ...item, cacheKey: key });
    }
  }

  let requestedChars = 0;
  const tokenUsage = emptyTokenUsage();
  const errors = {};
  const resolvedIds = new Set();
  const chunks = chunkByBudget(uncached, settings);
  await mapWithConcurrency(chunks, settings.concurrency, async (chunk) => {
    requestedChars += chunk.reduce((sum, item) => sum + item.text.length, 0);
    const translatedChunk = await translateChunkWithFallback(chunk, settings);
    addTokenUsage(tokenUsage, translatedChunk.__usage);
    for (const item of chunk) {
      const translated = translatedChunk[item.id];
      if (!translated) {
        errors[item.parentId || item.id] = errors[item.parentId || item.id] || "模型没有返回该段译文。";
        continue;
      }
      recordTranslation(item, translated, translations, partBuckets);
      resolvedIds.add(item.id);
      if (settings.enableCache) {
        runtimeCache.set(item.cacheKey, translated);
        cacheDirty = true;
      }
    }
  });

  // A5：模型「返回了但少了几个 id」也补——对既非缓存命中、又没落到 translations/partBuckets 的段，
  // 再发一轮逐段请求（并发 ≤ min(concurrency,3)，不叠加 withRetry）。补到就写入并入缓存，仍缺才判 error。
  const missing = uncached.filter((item) => !resolvedIds.has(item.id));
  if (missing.length) {
    await mapWithConcurrency(missing, Math.min(settings.concurrency, 3), async (item) => {
      try {
        const retried = await callTranslationApi([item], settings);
        addTokenUsage(tokenUsage, retried.__usage);
        const translated = retried[item.id];
        if (!translated) return;
        recordTranslation(item, translated, translations, partBuckets);
        resolvedIds.add(item.id);
        delete errors[item.parentId || item.id];
        if (settings.enableCache) {
          runtimeCache.set(item.cacheKey, translated);
          cacheDirty = true;
        }
      } catch {
        // 逐段补翻仍失败：保留已设 error，content 侧会显示可点重试的失败标记。
      }
    });
  }

  if (settings.enableCache && uncached.length) {
    scheduleCacheWrite();
  }

  for (const [parentId, parts] of partBuckets.entries()) {
    // 有几片拼几片：只有 0 片返回才判 error；1/3、2/3 也照拼照显示，
    // 某一片抖动不再让整段空白。expectedParts 仅留作内部日志，不再据此丢弃。
    if (!parts.length) {
      errors[parentId] = errors[parentId] || "模型未返回该段译文。";
      continue;
    }
    translations[parentId] = parts
      .sort((a, b) => a.index - b.index)
      .map((part) => part.text)
      .join(" ");
    delete errors[parentId];
  }

  await updateStats({
    providerName: settings.providerName,
    model: settings.model,
    host: hostFromSender(sender),
    requestedItems: uncached.length,
    cachedItems: normalized.length - uncached.length,
    requestedChars,
    cachedChars,
    promptTokens: tokenUsage.promptTokens,
    completionTokens: tokenUsage.completionTokens,
    totalTokens: tokenUsage.totalTokens
  });

  return {
    translations,
    errors,
    cached: normalized.length - uncached.length,
    requested: uncached.length
  };
}

async function runContextRefineBatch(items, settingsOverride, sender) {
  const settings = sanitizeSettings({ ...(await getSettings()), ...settingsOverride });
  ensureConfigured(settings);
  await ensureHostPermission(settings);

  const normalized = normalizeContextItems(items, settings);
  if (!normalized.length) return { translations: {}, errors: {}, cached: 0, requested: 0 };

  const translations = {};
  const errors = {};
  const tokenUsage = emptyTokenUsage();
  let requestedChars = 0;
  const chunks = chunkContextItems(normalized, settings);

  await mapWithConcurrency(chunks, Math.min(settings.concurrency, 2), async (chunk) => {
    requestedChars += chunk.reduce((sum, item) => sum + item.text.length, 0);
    const refined = await withRetry(() => callContextRefineApi(chunk, settings), settings.maxRetries);
    addTokenUsage(tokenUsage, refined.__usage);
    for (const item of chunk) {
      const value = refined[item.id];
      if (value) translations[item.id] = value;
      else errors[item.id] = "模型没有返回该段精翻结果。";
    }
  });

  await updateStats({
    providerName: settings.providerName,
    model: settings.model,
    host: hostFromSender(sender),
    requestedItems: normalized.length,
    cachedItems: 0,
    requestedChars,
    cachedChars: 0,
    promptTokens: tokenUsage.promptTokens,
    completionTokens: tokenUsage.completionTokens,
    totalTokens: tokenUsage.totalTokens
  });

  return {
    translations,
    errors,
    cached: 0,
    requested: normalized.length,
    contextRefined: true
  };
}

async function translateChunkWithFallback(chunk, settings) {
  try {
    return await withRetry(() => callTranslationApi(chunk, settings), settings.maxRetries);
  } catch (error) {
    if (chunk.length <= 1) return {};
    const result = {};
    await mapWithConcurrency(chunk, Math.min(settings.concurrency, 3), async (item) => {
      try {
        // 不再二次 withRetry：content 侧已按 attempts 重试，避免叠加打爆配额。
        mergeTranslatedMaps(result, await callTranslationApi([item], settings));
      } catch {
        // content 会在该段尾显示可点击重试的失败标记。
      }
    });
    return result;
  }
}

function expectedPartCounts(items) {
  const counts = new Map();
  for (const item of items) {
    if (item.parentId) counts.set(item.parentId, (counts.get(item.parentId) || 0) + 1);
  }
  return counts;
}

function normalizeItems(items, settings) {
  return items
    .flatMap((item) => splitItem(item, settings.maxCharsPerItem))
    .filter((item) => item.id && item.text.trim());
}

function normalizeContextItems(items, settings) {
  return (Array.isArray(items) ? items : [])
    .map((item) => ({
      id: String(item?.id || ""),
      text: String(item?.text || "").trim(),
      previousTranslation: trimContextText(item?.previousTranslation, 1200),
      headingPath: trimContextText(item?.headingPath, 240),
      before: trimContextText(item?.before, 700),
      after: trimContextText(item?.after, 700)
    }))
    .filter((item) => item.id && item.text)
    .map((item) => item.text.length <= settings.maxCharsPerItem * 2
      ? item
      : { ...item, text: item.text.slice(0, settings.maxCharsPerItem * 2) });
}

function trimContextText(value, maxLength) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function splitItem(item, maxChars) {
  const id = String(item.id || "");
  const text = String(item.text || "").trim();
  if (!id || !text) return [];
  if (text.length <= maxChars) return [{ id, text }];

  const parts = splitLongText(text, maxChars);
  return parts.map((part, index) => ({
    id: `${id}::part${index}`,
    parentId: id,
    partIndex: index,
    text: part
  }));
}

function recordTranslation(item, translated, translations, partBuckets) {
  if (!item.parentId) {
    translations[item.id] = translated;
    return;
  }
  if (!partBuckets.has(item.parentId)) partBuckets.set(item.parentId, []);
  partBuckets.get(item.parentId).push({
    index: item.partIndex || 0,
    text: translated
  });
}

function mergeTranslatedMaps(target, source) {
  addTokenUsage(target.__usage || (target.__usage = emptyTokenUsage()), source?.__usage);
  for (const [key, value] of Object.entries(source || {})) {
    if (key !== "__usage") target[key] = value;
  }
  return target;
}

function splitLongText(text, maxChars) {
  const sentences = text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?;:。！？；：])\s+/)
    .filter(Boolean);
  const chunks = [];
  let current = "";

  for (const sentence of sentences.length ? sentences : [text]) {
    if (!current) {
      current = sentence;
    } else if ((current + " " + sentence).length <= maxChars) {
      current += " " + sentence;
    } else {
      chunks.push(current);
      current = sentence;
    }

    while (current.length > maxChars) {
      chunks.push(current.slice(0, maxChars));
      current = current.slice(maxChars);
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

async function testProvider(settingsOverride) {
  const settings = sanitizeSettings({ ...(await getSettings()), ...settingsOverride });
  ensureConfigured(settings);
  await ensureHostPermission(settings);
  const startedAt = Date.now();
  const result = await withRetry(
    () =>
      callTranslationApi(
        [{ id: "probe", text: "This is a short connection test." }],
        settings
      ),
    0
  );
  return {
    latencyMs: Date.now() - startedAt,
    sample: result.probe || ""
  };
}

async function translateSearchQuery(text) {
  const settings = await getSettings();
  ensureConfigured(settings);
  await ensureHostPermission(settings);
  const query = String(text || "").replace(/\s+/g, " ").trim();
  if (!query) return { text: "" };
  if (query.length > 120) throw new Error("搜索词过长，请缩短后再试。");
  if (!hasCjk(query)) return { text: query };
  return {
    text: await callSearchQueryApi(query, settings)
  };
}

function ensureConfigured(settings) {
  if (!settings.baseUrl?.trim()) {
    throw new Error("请先配置接口地址。");
  }
  if (!settings.model?.trim()) {
    throw new Error("请先配置模型名称。");
  }
  if (!settings.apiKey?.trim()) {
    throw new Error("请先配置 API Key。");
  }
}

function resolveApiKey(settings) {
  return settings.apiKey.trim();
}

// 主机权限检测：MV3 下 fetch 跨域必须声明或动态申请 host_permissions。
// service worker 无法弹窗 request，故这里只 contains 检测；无权限时抛友好错误，
// 由 options 页在用户手势中调用 chrome.permissions.request 完成授权。
async function ensureHostPermission(settings) {
  const baseUrl = normalizeBaseUrl(settings.baseUrl);
  let origin;
  try {
    origin = new URL(baseUrl).origin;
  } catch {
    return; // 非法地址交给后续 fetch 报错
  }
  let has = true;
  try {
    has = await chrome.permissions.contains({ origins: [`${origin}/*`] });
  } catch {
    has = true; // 无法检测时乐观放行
  }
  if (!has) {
    throw new Error(
      `尚未授权访问 ${origin}。请在设置页保存接口配置触发授权，或在浏览器扩展权限中允许该域名。`
    );
  }
}

async function callTranslationApi(items, settings) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), settings.requestTimeoutMs);
  const endpoint = `${normalizeBaseUrl(settings.baseUrl)}/chat/completions`;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resolveApiKey(settings)}`
      },
      body: JSON.stringify(buildRequestBody(items, settings))
    });

    const text = await response.text();
    if (!response.ok) {
      throw new ProviderError(
        `模型服务返回 ${response.status}：${trimErrorText(text)}`,
        response.status
      );
    }

    const data = JSON.parse(text);
    const choice = data?.choices?.[0];
    const content = choice?.message?.content;
    if (!content) throw new Error("模型服务没有返回翻译内容。");
    // A6：被 max_tokens 截断（finish_reason=length）时整批 JSON 大概率残缺不可信，
    // 抛错让 translateChunkWithFallback 走逐段重发（逐段输出短，几乎不会再截断）。
    if (choice?.finish_reason === "length") {
      throw new Error("模型输出被长度限制截断，将逐段重试。");
    }
    const parsed = parseTranslationPayload(content, items);
    parsed.__usage = normalizeUsage(data?.usage);
    return parsed;
  } finally {
    clearTimeout(timeout);
  }
}

async function callContextRefineApi(items, settings) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), settings.requestTimeoutMs);
  const endpoint = `${normalizeBaseUrl(settings.baseUrl)}/chat/completions`;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resolveApiKey(settings)}`
      },
      body: JSON.stringify(buildContextRefineRequestBody(items, settings))
    });

    const text = await response.text();
    if (!response.ok) {
      throw new ProviderError(
        `模型服务返回 ${response.status}：${trimErrorText(text)}`,
        response.status
      );
    }

    const data = JSON.parse(text);
    const choice = data?.choices?.[0];
    const content = choice?.message?.content;
    if (!content) throw new Error("模型服务没有返回精翻内容。");
    if (choice?.finish_reason === "length") {
      throw new Error("模型精翻输出被长度限制截断，请减少精翻范围后重试。");
    }
    const parsed = parseTranslationPayload(content, items);
    parsed.__usage = normalizeUsage(data?.usage);
    return parsed;
  } finally {
    clearTimeout(timeout);
  }
}

async function callSearchQueryApi(text, settings) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), settings.requestTimeoutMs);
  const endpoint = `${normalizeBaseUrl(settings.baseUrl)}/chat/completions`;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resolveApiKey(settings)}`
      },
      body: JSON.stringify(buildSearchQueryRequestBody(text, settings))
    });

    const responseText = await response.text();
    if (!response.ok) {
      throw new ProviderError(
        `模型服务返回 ${response.status}：${trimErrorText(responseText)}`,
        response.status
      );
    }

    const data = JSON.parse(responseText);
    const content = data?.choices?.[0]?.message?.content;
    if (!content) throw new Error("模型服务没有返回翻译内容。");
    return parseSearchQueryPayload(content);
  } finally {
    clearTimeout(timeout);
  }
}

// 按 provider 能力构建请求体：response_format 与 thinking 仅对支持的 provider 注入，
// 避免给不兼容的实现（混元 / MiMo）发送未知字段导致 400。
function buildRequestBody(items, settings) {
  const caps = providerCapabilities(settings);
  const body = {
    model: settings.model.trim(),
    temperature: settings.temperature,
    max_tokens: settings.maxTokens,
    stream: false,
    messages: buildMessages(items, settings)
  };
  if (caps.supportsResponseFormat) {
    body.response_format = { type: "json_object" };
  }
  if (caps.supportsThinking) {
    body[caps.thinkingField] = { type: settings.thinkingMode === "enabled" ? "enabled" : "disabled" };
  }
  return body;
}

function buildContextRefineRequestBody(items, settings) {
  const caps = providerCapabilities(settings);
  const body = {
    model: settings.model.trim(),
    temperature: Math.min(0.35, settings.temperature),
    max_tokens: settings.maxTokens,
    stream: false,
    messages: buildContextRefineMessages(items, settings)
  };
  if (caps.supportsResponseFormat) {
    body.response_format = { type: "json_object" };
  }
  if (caps.supportsThinking) {
    body[caps.thinkingField] = { type: settings.thinkingMode === "enabled" ? "enabled" : "disabled" };
  }
  return body;
}

function buildSearchQueryRequestBody(text, settings) {
  const caps = providerCapabilities(settings);
  const body = {
    model: settings.model.trim(),
    temperature: Math.min(0.3, settings.temperature),
    max_tokens: Math.min(512, settings.maxTokens),
    stream: false,
    messages: [
      {
        role: "system",
        content:
          "You translate Chinese search queries into concise, natural English search keywords. Preserve names, brands, product terms, numbers, and code-like tokens. Output strict JSON only."
      },
      {
        role: "user",
        content: [
          "把下面的中文搜索词翻译成适合搜索引擎使用的英文关键词。",
          "只输出英文译文，不解释，不加引号，不扩写成句子。",
          '返回格式：{"text":"english query"}',
          "",
          `中文搜索词：${text}`
        ].join("\n")
      }
    ]
  };
  if (caps.supportsResponseFormat) {
    body.response_format = { type: "json_object" };
  }
  if (caps.supportsThinking) {
    body[caps.thinkingField] = { type: settings.thinkingMode === "enabled" ? "enabled" : "disabled" };
  }
  return body;
}

function buildMessages(items, settings) {
  const quality = QUALITY_LABELS[settings.quality] || QUALITY_LABELS.balanced;
  const styleGuide = STYLE_GUIDES[settings.quality] || STYLE_GUIDES.balanced;
  const context = settings.pageContext || {};
  const list = items.map((item) => ({ id: item.id, text: item.text }));

  return [
    {
      role: "system",
      content:
        [
          "You are a professional webpage translator. Your goal is idiomatic meaning-based translation, not word-by-word literal conversion.",
          "Rewrite sentence order naturally for the target language while preserving the author's intent, tone, and information density.",
          "Preserve proper nouns, brand names, product names, numbers, units, paths, commands, identifiers, code-like tokens, and paired <tN>...</tN> placeholder tags exactly.",
          "Items in the same batch come from one webpage; keep terminology, pronouns, and naming consistent across the batch.",
          "Return strict JSON only. Do not include Markdown, code fences, explanations, or reasoning."
        ].join(" ")
    },
    {
      role: "user",
      content: [
        `Target language: ${settings.targetLanguage}`,
        `Source language: ${settings.sourceLanguage}`,
        `Webpage title: ${context.title || "Unknown"}`,
        `Domain: ${context.host || "Unknown"}`,
        `Meta description: ${context.description || "None"}`,
        `Topic hint: ${context.topicHint || "None"}`,
        `Style preset: ${quality}`,
        `Style instructions: ${styleGuide}`,
        "Glossary:",
        glossaryToText(settings.glossary),
        "",
        "Translate every item in the JSON array below. Return strict JSON only, no Markdown, no code fence. Required format:",
        '{"translations":[{"id":"original id","text":"translated text"}]}',
        "",
        JSON.stringify(list)
      ].join("\n")
    }
  ];
}

function buildContextRefineMessages(items, settings) {
  const quality = QUALITY_LABELS[settings.quality] || QUALITY_LABELS.balanced;
  const styleGuide = STYLE_GUIDES[settings.quality] || STYLE_GUIDES.balanced;
  const context = settings.pageContext || {};
  const outline = Array.isArray(context.outline) && context.outline.length
    ? context.outline.slice(0, 16).map((item) => `${item.level || "H"} ${item.text}`).join("\n")
    : "None";
  const list = items.map((item) => ({
    id: item.id,
    text: item.text,
    previousTranslation: item.previousTranslation || "",
    headingPath: item.headingPath || "",
    before: item.before || "",
    after: item.after || ""
  }));

  return [
    {
      role: "system",
      content: [
        "You are a senior Chinese translation editor performing context-aware refinement.",
        "You must produce high-quality Chinese translations calibrated against page context, neighboring paragraphs, and the previous draft translation.",
        CONTEXT_REFINE_GUIDE,
        "General style strategy:",
        styleGuide,
        "Return strict JSON only. Do not include Markdown, code fences, explanations, or reasoning."
      ].join("\n")
    },
    {
      role: "user",
      content: [
        "Context refinement task.",
        `Target language: ${settings.targetLanguage}`,
        `Source language: ${settings.sourceLanguage}`,
        `Style preset: ${quality}`,
        `Webpage title: ${context.title || "Unknown"}`,
        `Domain: ${context.host || "Unknown"}`,
        `Meta description: ${context.description || "None"}`,
        `Topic hint: ${context.topicHint || "None"}`,
        "Page outline:",
        outline,
        "Glossary:",
        glossaryToText(settings.glossary),
        "",
        "For each item, use before/after/headingPath/previousTranslation only as context. Translate or refine only the text field.",
        "Return required format:",
        '{"translations":[{"id":"original id","text":"refined translated text"}]}',
        "",
        JSON.stringify(list)
      ].join("\n")
    }
  ];
}

function parseTranslationPayload(content, items) {
  const cleaned = String(content)
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
  const parsed = JSON.parse(cleaned);
  const translations = Array.isArray(parsed) ? parsed : parsed.translations;
  if (!Array.isArray(translations)) {
    throw new Error("模型服务返回格式不正确，缺少 translations 数组。");
  }

  const byId = {};
  const allowedIds = new Set(items.map((item) => item.id));
  for (const item of translations) {
    const id = String(item?.id || "");
    if (allowedIds.has(id) && typeof item.text === "string") {
      byId[id] = item.text.trim();
    }
  }

  return byId;
}

function parseSearchQueryPayload(content) {
  const cleaned = String(content)
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
  const parsed = JSON.parse(cleaned);
  const text = String(parsed?.text || parsed?.translation || parsed?.result || "")
    .replace(/\s+/g, " ")
    .replace(/^["'“”‘’]+|["'“”‘’]+$/g, "")
    .trim();
  if (!text) throw new Error("模型服务返回格式不正确，缺少英文译文。");
  return text;
}

async function ensureCacheLoaded(settings) {
  if (!settings.enableCache || cacheLoaded) return;
  const stored = await chrome.storage.local.get([STORAGE_KEYS.cache, CACHE_DIRTY_KEY]);
  runtimeCache.clear();
  for (const [key, value] of Object.entries(stored[STORAGE_KEYS.cache] || {})) {
    runtimeCache.set(key, value);
  }
  cacheLoaded = true;
  // SW 重启后若上一次有未落盘的脏标记，触发一次补偿写入。
  if (stored[CACHE_DIRTY_KEY]) {
    cacheDirty = true;
    scheduleCacheWrite(0);
  }
}

function scheduleCacheWrite(delayMs = 3000) {
  if (!cacheDirty) return;
  clearTimeout(cacheWriteTimer);
  cacheWriteTimer = setTimeout(() => writeCacheNow().catch(() => {}), delayMs);
}

// 原子化落盘：先 set 成功，再清 cacheDirty；失败保留 dirty 以便下次重试。
// 持久化 dirty 标记位用于 SW 在 await set 期间被回收的极端情况补偿。
async function writeCacheNow() {
  if (!cacheDirty) return;
  const entries = Array.from(runtimeCache.entries());
  const limited = entries.slice(Math.max(0, entries.length - 3000));
  await chrome.storage.local.set({
    [STORAGE_KEYS.cache]: Object.fromEntries(limited),
    [CACHE_DIRTY_KEY]: false
  });
  // 落盘成功后再裁剪内存（LRU），并清脏标记。
  if (limited.length < entries.length) {
    runtimeCache.clear();
    for (const [key, value] of limited) runtimeCache.set(key, value);
  }
  cacheDirty = false;
}

function cacheKey(settings, text) {
  return [
    settings.providerName,
    settings.baseUrl,
    settings.model,
    settings.targetLanguage,
    settings.quality,
    settings.thinkingMode,
    shortHash(settings.glossary),
    shortHash(text)
  ].join(":");
}

function chunkByBudget(items, settings) {
  const chunks = [];
  let chunk = [];
  let chars = 0;
  const maxChars = Math.min(8000, Math.max(settings.maxCharsPerItem, settings.maxCharsPerItem * settings.batchSize));

  for (const item of items) {
    if (
      chunk.length &&
      (chunk.length >= settings.batchSize || chars + item.text.length > maxChars)
    ) {
      chunks.push(chunk);
      chunk = [];
      chars = 0;
    }
    chunk.push(item);
    chars += item.text.length;
  }
  if (chunk.length) chunks.push(chunk);
  return chunks;
}

function chunkContextItems(items, settings) {
  const chunks = [];
  let chunk = [];
  let chars = 0;
  const maxItems = Math.max(1, Math.min(6, settings.batchSize));
  const maxChars = Math.min(9000, Math.max(2500, settings.maxCharsPerItem * 4));

  for (const item of items) {
    const estimate = item.text.length + item.before.length + item.after.length + item.previousTranslation.length;
    if (chunk.length && (chunk.length >= maxItems || chars + estimate > maxChars)) {
      chunks.push(chunk);
      chunk = [];
      chars = 0;
    }
    chunk.push(item);
    chars += estimate;
  }
  if (chunk.length) chunks.push(chunk);
  return chunks;
}

async function mapWithConcurrency(items, concurrency, worker) {
  const queue = [...items];
  const workers = Array.from({ length: Math.max(1, Math.min(concurrency, queue.length || 1)) }, async () => {
    while (queue.length) {
      const item = queue.shift();
      try {
        await worker(item);
      } catch {
        // A single failed task should not drain the remaining queue.
      }
    }
  });
  await Promise.all(workers);
}

async function withRetry(task, maxRetries) {
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      lastError = error;
      if (attempt >= maxRetries || !isRetryable(error)) break;
      await sleep(retryBackoff(error, attempt));
    }
  }
  throw lastError;
}

function isRetryable(error) {
  if (error?.name === "AbortError") return true;
  if (error instanceof ProviderError) {
    return [408, 429, 500, 502, 503, 504].includes(error.status);
  }
  return false;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 429 限速用更长退避，让服务端限速窗口恢复；其它可重试错误用常规退避。
function retryBackoff(error, attempt) {
  if (error instanceof ProviderError && error.status === 429) {
    return 3000 * 2 ** attempt + Math.random() * 1000;
  }
  return 500 * 2 ** attempt + Math.random() * 200;
}

async function getStats() {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.stats);
  return stored[STORAGE_KEYS.stats] || emptyStats();
}

async function updateStats(delta) {
  const stats = await getStats();
  const day = nowDayKey();
  const today = stats.byDay[day] || emptyStatsBucket();
  const host = delta.host || "unknown";
  const hostBucket = stats.byHost[host] || emptyStatsBucket();

  applyStats(stats.total, delta);
  applyStats(today, delta);
  applyStats(hostBucket, delta);

  stats.byDay[day] = today;
  stats.byHost[host] = hostBucket;
  stats.lastProvider = delta.providerName;
  stats.lastModel = delta.model;
  stats.updatedAt = new Date().toISOString();

  await chrome.storage.local.set({ [STORAGE_KEYS.stats]: stats });
}

function applyStats(bucket, delta) {
  bucket.requests += delta.requestedItems > 0 ? 1 : 0;
  bucket.requestedItems += delta.requestedItems;
  bucket.cachedItems += delta.cachedItems;
  bucket.requestedChars += delta.requestedChars;
  bucket.cachedChars += delta.cachedChars;
  bucket.promptTokens = (bucket.promptTokens || 0) + (delta.promptTokens || 0);
  bucket.completionTokens = (bucket.completionTokens || 0) + (delta.completionTokens || 0);
  bucket.totalTokens = (bucket.totalTokens || 0) + (delta.totalTokens || 0);
}

function emptyStats() {
  return {
    total: emptyStatsBucket(),
    byDay: {},
    byHost: {},
    lastProvider: "",
    lastModel: "",
    updatedAt: ""
  };
}

function emptyStatsBucket() {
  return {
    requests: 0,
    requestedItems: 0,
    cachedItems: 0,
    requestedChars: 0,
    cachedChars: 0,
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0
  };
}

function emptyTokenUsage() {
  return {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0
  };
}

function addTokenUsage(target, usage) {
  if (!usage) return target;
  target.promptTokens += Number(usage.promptTokens) || 0;
  target.completionTokens += Number(usage.completionTokens) || 0;
  target.totalTokens += Number(usage.totalTokens) || 0;
  return target;
}

function normalizeUsage(usage) {
  if (!usage) return emptyTokenUsage();
  const promptTokens = Number(usage.prompt_tokens ?? usage.input_tokens ?? usage.promptTokens) || 0;
  const completionTokens = Number(usage.completion_tokens ?? usage.output_tokens ?? usage.completionTokens) || 0;
  const totalTokens = Number(usage.total_tokens ?? usage.totalTokens) || promptTokens + completionTokens;
  return { promptTokens, completionTokens, totalTokens };
}

function hostFromSender(sender) {
  try {
    return new URL(sender?.tab?.url || "").host || "unknown";
  } catch {
    return "unknown";
  }
}

function trimErrorText(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .slice(0, 300);
}

function hasCjk(text) {
  return /[\u3400-\u9fff\uf900-\ufaff]/.test(String(text || ""));
}

// 错误信息人性化：按状态码与异常类型给出可执行的恢复建议，而非裸露的原始报错。
function formatError(error) {
  if (error?.name === "AbortError") {
    return "请求超时。可在设置中调小每批段落数，或稍后重试。";
  }
  if (error instanceof ProviderError) {
    switch (error.status) {
      case 401:
        return "API Key 无效或已过期，请到设置检查密钥。";
      case 403:
        return "账号无该接口权限，或所在区域/IP 被限制。";
      case 404:
        return "接口地址或模型名称不正确，请到设置核对。";
      case 422:
        return "请求参数不被服务接受，可能是模型名或字段不兼容，请检查模型与接口。";
      case 429:
        return "请求过于频繁或额度已用尽，请降低并发或在设置中减小每批段落数后重试。";
      case 500:
      case 502:
      case 503:
      case 504:
        return "模型服务暂时不可用，请稍后重试。";
      default:
        return error.message;
    }
  }
  return error?.message || String(error);
}

class ProviderError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "ProviderError";
    this.status = status;
  }
}
