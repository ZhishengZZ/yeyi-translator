export const DEFAULT_GLOSSARY = [
  "LLM = 大语言模型",
  "large language model = 大语言模型",
  "AI agent = AI 智能体",
  "agent = 智能体",
  "prompt = 提示词",
  "prompt engineering = 提示词工程",
  "alignment = 对齐",
  "inference = 推理",
  "reasoning = 推理",
  "context window = 上下文窗口",
  "token = Token",
  "embedding = 嵌入",
  "fine-tuning = 微调",
  "RAG = 检索增强生成",
  "hallucination = 幻觉",
  "benchmark = 基准测试",
  "throughput = 吞吐量",
  "latency = 延迟",
  "rate limit = 速率限制",
  "open-source = 开源"
].join("\n");

export const SITE_HOST_PRESETS = {
  always: [
    "www.google.com",
    "google.com",
    "scholar.google.com",
    "www.forbes.com",
    "www.reddit.com",
    "community.openai.com",
    "arxiv.org",
    "docs.github.com",
    "developer.mozilla.org",
    "medium.com"
  ],
  never: [
    "mail.google.com",
    "accounts.google.com",
    "bank.example.com",
    "pay.example.com"
  ]
};

export const PROVIDER_PRESETS = [
  {
    id: "deepseek-flash",
    label: "DeepSeek V4 Flash",
    providerName: "DeepSeek",
    baseUrl: "https://api.deepseek.com",
    model: "deepseek-v4-flash",
    maxTokens: 6000,
    temperature: 0.2,
    requestTimeoutMs: 30000,
    thinkingMode: "disabled"
  },
  {
    id: "deepseek-pro",
    label: "DeepSeek V4 Pro",
    providerName: "DeepSeek",
    baseUrl: "https://api.deepseek.com",
    model: "deepseek-v4-pro",
    maxTokens: 6000,
    temperature: 0.2,
    requestTimeoutMs: 45000,
    thinkingMode: "disabled"
  },
  {
    id: "qwen37-max",
    label: "Qwen3.7 Max",
    providerName: "Qwen / 阿里云百炼",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    model: "qwen3.7-max",
    maxTokens: 6000,
    temperature: 0.2,
    requestTimeoutMs: 45000,
    thinkingMode: "disabled"
  },
  {
    id: "qwen37-plus",
    label: "Qwen3.7 Plus",
    providerName: "Qwen / 阿里云百炼",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    model: "qwen3.7-plus",
    maxTokens: 6000,
    temperature: 0.2,
    requestTimeoutMs: 40000,
    thinkingMode: "disabled"
  },
  {
    id: "qwen36-flash",
    label: "Qwen3.6 Flash",
    providerName: "Qwen / 阿里云百炼",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    model: "qwen3.6-flash",
    maxTokens: 6000,
    temperature: 0.2,
    requestTimeoutMs: 30000,
    thinkingMode: "disabled"
  },
  {
    id: "glm52",
    label: "GLM-5.2",
    providerName: "Z.AI / GLM",
    baseUrl: "https://api.z.ai/api/paas/v4/",
    model: "glm-5.2",
    maxTokens: 6000,
    temperature: 0.2,
    requestTimeoutMs: 45000,
    thinkingMode: "disabled"
  },
  {
    id: "mimo25-pro",
    label: "MiMo v2.5 Pro",
    providerName: "小米 MiMo",
    baseUrl: "https://api.xiaomimimo.com/v1",
    model: "mimo-v2.5-pro",
    maxTokens: 6000,
    temperature: 0.2,
    requestTimeoutMs: 45000,
    thinkingMode: "disabled"
  },
  {
    id: "hunyuan-turbos",
    label: "腾讯混元 TurboS Latest",
    providerName: "腾讯混元",
    baseUrl: "https://api.hunyuan.cloud.tencent.com/v1",
    model: "hunyuan-turbos-latest",
    maxTokens: 6000,
    temperature: 0.2,
    requestTimeoutMs: 45000,
    thinkingMode: "disabled"
  }
];

// Provider 能力特化：决定是否注入 response_format / thinking，避免不兼容字段导致 400。
// 按 providerName + baseUrl 中的关键词匹配，命中即采用该能力；未命中走 OpenAI 兼容默认。
export const PROVIDER_CAPABILITIES = {
  deepseek: { supportsResponseFormat: true, supportsThinking: true, thinkingField: "thinking" },
  qwen: { supportsResponseFormat: true, supportsThinking: false, thinkingField: "thinking" },
  dashscope: { supportsResponseFormat: true, supportsThinking: false, thinkingField: "thinking" },
  "z.ai": { supportsResponseFormat: true, supportsThinking: true, thinkingField: "thinking" },
  glm: { supportsResponseFormat: true, supportsThinking: true, thinkingField: "thinking" },
  bigmodel: { supportsResponseFormat: true, supportsThinking: true, thinkingField: "thinking" },
  hunyuan: { supportsResponseFormat: false, supportsThinking: false, thinkingField: "thinking" },
  mimo: { supportsResponseFormat: false, supportsThinking: false, thinkingField: "thinking" },
  xiaomi: { supportsResponseFormat: false, supportsThinking: false, thinkingField: "thinking" }
};

// 返回当前配置对应的 provider 能力。优先按关键词精确匹配，未命中走兼容默认。
export function providerCapabilities(settings) {
  const haystack = `${settings?.providerName || ""} ${settings?.baseUrl || ""}`.toLowerCase();
  for (const [key, caps] of Object.entries(PROVIDER_CAPABILITIES)) {
    if (haystack.includes(key)) return caps;
  }
  return { supportsResponseFormat: true, supportsThinking: false, thinkingField: "thinking" };
}

export const DEFAULT_SETTINGS = {
  providerName: "",
  baseUrl: "",
  model: "",
  apiKey: "",
  targetLanguage: "简体中文",
  sourceLanguage: "自动检测",
  mode: "bilingual",
  quality: "balanced",
  autoTranslate: false,
  enableCache: true,
  batchSize: 10,
  maxCharsPerItem: 1200,
  temperature: 0.2,
  maxTokens: 8000,
  thinkingMode: "disabled",
  glossary: DEFAULT_GLOSSARY,
  requestTimeoutMs: 30000,
  maxRetries: 1,
  concurrency: 1,
  showFloatingBall: true,
  bilingualStyle: "none",
  searchBoxTranslate: false,
  searchBoxTranslateMode: "suggest",
  enableNewTabOverride: true,
  theme: "auto",
  alwaysTranslateHosts: [],
  neverTranslateHosts: [],
  customSiteRules: ""
};

export const QUALITY_LABELS = {
  precise: "精准忠实",
  balanced: "信达雅",
  fluent: "自然中文",
  technical: "技术文档",
  business: "商务正式",
  literary: "文学润色"
};

export const STORAGE_KEYS = {
  settings: "yeyi.settings",
  cache: "yeyi.cache",
  stats: "yeyi.stats",
  globalState: "yeyi.globalState"
};

export function mergeSettings(value) {
  return { ...DEFAULT_SETTINGS, ...(value || {}) };
}

export function normalizeBaseUrl(baseUrl) {
  return (baseUrl || DEFAULT_SETTINGS.baseUrl).trim().replace(/\/+$/, "");
}

export function clampNumber(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

export function normalizeHostList(value) {
  if (Array.isArray(value)) {
    return value.map(cleanHost).filter(Boolean);
  }
  return String(value || "")
    .split(/\r?\n|,/)
    .map(cleanHost)
    .filter(Boolean);
}

export function hostListToText(value) {
  return normalizeHostList(value).join("\n");
}

export function cleanHost(value) {
  return String(value || "")
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "")
    .toLowerCase();
}

export function glossaryToText(glossary) {
  const lines = String(glossary || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 80);

  if (!lines.length) return "No glossary terms.";
  return lines
    .map((line) => {
      const [source, target] = line.split(/\s*=>\s*|\s*=\s*/);
      if (!target) return `- ${line}`;
      return `- ${source.trim()} => ${target.trim()}`;
    })
    .join("\n");
}

// 解析设置页"站点规则"文本(JSON 数组)。background 下发与 options 校验共用。
// 宽容处理:非法 JSON / 非数组 / 缺 matches 的条目 → 忽略并给出人话错误,不炸流程。
export function parseCustomSiteRules(text) {
  const trimmed = String(text || "").trim();
  if (!trimmed) return { rules: [], error: "" };
  let parsed;
  try {
    parsed = JSON.parse(trimmed);
  } catch (error) {
    return { rules: [], error: `站点规则 JSON 解析失败：${error?.message || error}` };
  }
  if (!Array.isArray(parsed)) return { rules: [], error: "站点规则需为 JSON 数组。" };
  const rules = parsed.filter((rule) => rule && typeof rule === "object" && rule.matches);
  const dropped = parsed.length - rules.length;
  return { rules, error: dropped > 0 ? `${dropped} 条规则缺少 matches 字段，已忽略。` : "" };
}

export function shortHash(input) {
  let hash = 2166136261;
  const text = String(input);
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function nowDayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}
