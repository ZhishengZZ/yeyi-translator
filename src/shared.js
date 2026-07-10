// 雅译 Yeyi · 张枳生制作

// 默认术语表:挑「模型经常译错/译得不统一」的高频词,覆盖 AI、开发、互联网、
// 商业新闻四类常读内容;刻意避开一词多义会误伤的词(如 issue/release)。
export const DEFAULT_GLOSSARY = [
  // AI / 模型
  "LLM = 大语言模型",
  "AI agent = AI 智能体",
  "agent = 智能体",
  "prompt = 提示词",
  "token = Token",
  "context window = 上下文窗口",
  "inference = 推理",
  "fine-tuning = 微调",
  "embedding = 向量嵌入",
  "RAG = 检索增强生成",
  "hallucination = 幻觉",
  "multimodal = 多模态",
  "benchmark = 基准测试",
  "open-source = 开源",
  // 开发 / 技术文档
  "repository = 仓库",
  "pull request = PR",
  "commit = 提交",
  "branch = 分支",
  "cache = 缓存",
  "endpoint = 端点",
  "API key = API 密钥",
  "rate limit = 速率限制",
  "latency = 延迟",
  "throughput = 吞吐量",
  "deprecated = 已弃用",
  "breaking change = 破坏性变更",
  "changelog = 更新日志",
  "roadmap = 路线图",
  // 互联网 / 日常阅读
  "cookie = Cookie",
  "paywall = 付费墙",
  "podcast = 播客",
  "newsletter = 邮件简报",
  "subscription = 订阅",
  "terms of service = 服务条款",
  "privacy policy = 隐私政策",
  // 商业 / 新闻
  "stakeholder = 利益相关方",
  "revenue = 营收",
  "valuation = 估值",
  "startup = 初创公司",
  "venture capital = 风险投资"
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
    maxTokens: 8000,
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
    maxTokens: 8000,
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
    maxTokens: 8000,
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
    maxTokens: 8000,
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
    maxTokens: 8000,
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
    maxTokens: 8000,
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
    maxTokens: 8000,
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
    maxTokens: 8000,
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
  // maxTokens 提到 8000 后,大批次响应 30s 偶发掐头;40s 与预设档位更匹配。
  requestTimeoutMs: 40000,
  maxRetries: 1,
  // 默认 4 路并发:1 路在长文页面慢得难以接受;主流服务商个人档都扛得住 4,
  // 限速严的用户可在设置页降回 1。
  concurrency: 4,
  showFloatingBall: true,
  bilingualStyle: "none",
  searchBoxTranslate: false,
  searchBoxTranslateMode: "suggest",
  selectionTranslate: true,
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
