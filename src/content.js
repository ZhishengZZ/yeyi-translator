(() => {
  if (window.__YEYI_CONTENT_LOADED__) return;
  window.__YEYI_CONTENT_LOADED__ = true;

  // 是否顶层帧。子帧(iframe)只做翻译，不挂悬浮球 / 搜索助翻等可视 UI。
  const IS_TOP = (window.top === window);

  // ─────────────────────────────────────────────────────────────────────────
  // 引擎移植自 read-frog（walk-and-label 段落检测 + block/inline 分类 + wrapper
  // 插入）。相较旧版「文本节点按块拥有者聚类」，改为先递归遍历整棵子树打标签、
  // 识别「段落」触发单元，再按 block/inline 决定译文是另起一行还是行内接排。
  // 批量翻译、悬浮球、搜索框助翻、状态上报沿用雅译原有实现，background 契约不变。
  // ─────────────────────────────────────────────────────────────────────────

  // 强制块级：无论 display 计算值如何都当块级（标题/列表/表单控件等）。
  const FORCE_BLOCK_TAGS = new Set([
    "BODY", "H1", "H2", "H3", "H4", "H5", "H6", "BR", "FORM", "SELECT",
    "BUTTON", "LABEL", "UL", "OL", "LI", "BLOCKQUOTE", "PRE", "ARTICLE",
    "SECTION", "FIGURE", "FIGCAPTION", "HEADER", "FOOTER", "MAIN", "NAV"
  ]);
  // MathML：整棵公式子树不进入、也不作为文本抽取。
  const MATH_TAGS = new Set([
    "math", "maction", "annotation", "annotation-xml", "menclose", "merror",
    "mfenced", "mfrac", "mi", "mmultiscripts", "mn", "mo", "mover", "mpadded",
    "mphantom", "mprescripts", "mroot", "mrow", "ms", "mspace", "msqrt",
    "mstyle", "msub", "msubsup", "msup", "mtable", "mtd", "mtext", "mtr",
    "munder", "munderover", "semantics"
  ]);
  // 既不进入、也不抽取文本的标签（脚本/媒体/表单输入/公式等）。
  // 与 read-frog 有意分歧:BUTTON/SELECT/OPTION 雅译整个跳过(read-frog 按行内翻译),
  // 按钮/下拉译了容易破坏控件布局,阅读场景收益低。要对齐时把三者移去 FORCE_INLINE。
  const DONT_WALK_AND_TRANSLATE_TAGS = new Set([
    "HEAD", "TITLE", "HR", "INPUT", "TEXTAREA", "IMG", "VIDEO", "AUDIO",
    "CANVAS", "SOURCE", "TRACK", "META", "SCRIPT", "NOSCRIPT", "STYLE",
    "LINK", "RT", "RP", "PRE", "BUTTON", "SELECT", "OPTION", "svg", ...MATH_TAGS
  ]);
  // 不进入内部遍历、但作为父段落文本的一部分翻译（代码/时间等原子块）。
  const DONT_WALK_BUT_TRANSLATE_TAGS = new Set(["CODE", "TIME"]);
  // 译文强制按行内排版（但不改变该节点自身 block/inline 判定）。
  const FORCE_INLINE_TRANSLATION_TAGS = new Set(["A", "BUTTON", "SELECT", "OPTION", "SPAN"]);
  const PLACEHOLDER_TAGS = new Set([
    "A", "ABBR", "B", "BDI", "BDO", "CITE", "CODE", "DATA", "DFN", "EM",
    "I", "KBD", "MARK", "Q", "S", "SAMP", "SMALL", "SPAN", "STRONG",
    "SUB", "SUP", "TIME", "U", "VAR"
  ]);

  // DOM 标签属性/类名（雅译命名空间）。
  const WALKED_ATTR = "data-yeyi-walked";
  const PARAGRAPH_ATTR = "data-yeyi-paragraph";
  const BLOCK_ATTR = "data-yeyi-block";
  const INLINE_ATTR = "data-yeyi-inline";
  const MODE_ATTR = "data-yeyi-mode";
  const WRAPPER_CLASS = "yeyi-content-wrapper";
  const NOTRANSLATE_CLASS = "notranslate";
  const WALK_ATTRS = [WALKED_ATTR, PARAGRAPH_ATTR, BLOCK_ATTR, INLINE_ATTR];

  // 搜索框助翻用：识别不可翻译输入框时复用。
  const NON_NEWLINE_WS = /[^\S\n]/;

  const state = {
    active: false,
    mode: "bilingual",
    targetLanguage: "简体中文",
    bilingualStyle: "none",
    translatedCount: 0,
    totalCount: 0,
    pendingCount: 0,
    skippedCount: 0,
    error: "",
    startedAt: 0,
    settings: null,
    walkId: "",
    units: [],
    unitedNodes: new WeakSet(),       // 已归入某单元的节点，避免 SPA 重扫时重复建单元
    originalContentMap: new Map(),    // 替换模式下容器 → 原始 innerHTML,用于还原
    shadowRoots: new Set(),           // 本轮遍历发现的 open shadow root(查段落/清理/注样式都要用)
    queue: new Set(),
    processing: false,
    contextRefining: false,
    processTimer: 0,
    mutationTimer: 0,
    statusTimer: 0,
    lastStatusSentAt: 0,
    intersectionObserver: null,
    mutationObserver: null,
    floatingRoot: null,
    floatingButton: null,
    floatingMenu: null,
    floatingRetryBtn: null,
    floatingContextBtn: null,
    hiddenForHost: false,
    siteRule: null,                   // 当前 URL 生效的站点规则(合并后),startTranslation 时计算
    nextUnitId: 1,
    searchAssistEnabled: false,
    searchAssistMode: "suggest",
    searchAssistReady: false,
    searchInput: null,
    searchPanel: null,
    searchTimer: 0,
    searchRequestId: 0,
    isComposing: false,
    booting: null
  };

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    handleMessage(message)
      .then((payload) => sendResponse({ ok: true, payload }))
      .catch((error) => sendResponse({ ok: false, error: error?.message || String(error) }));
    return true;
  });

  state.booting = boot();

  async function boot() {
    const settings = await getContentSettings().catch(() => null);
    if (settings) {
      state.settings = settings;
      state.mode = settings.mode || state.mode;
      state.targetLanguage = settings.targetLanguage || state.targetLanguage;
      state.bilingualStyle = settings.bilingualStyle || state.bilingualStyle;
      state.hiddenForHost = matchesHost(location.hostname, settings.neverTranslateHosts);
      setupSearchAssist(settings);
    }
    chrome.storage.onChanged?.addListener((changes, area) => {
      if (area !== "local" || !changes["yeyi.settings"]) return;
      const next = changes["yeyi.settings"].newValue;
      if (!next) return;
      const prevBall = state.settings?.showFloatingBall;
      const prevStyle = state.settings?.bilingualStyle;
      state.searchAssistEnabled = Boolean(next.searchBoxTranslate);
      state.searchAssistMode = next.searchBoxTranslateMode === "replace" ? "replace" : "suggest";
      state.settings = { ...state.settings, ...next };
      // 设置页刚开启搜索助翻:立即挂监听,不再要求刷新页面才生效。
      if (state.searchAssistEnabled && !state.searchAssistReady) setupSearchAssist(state.settings);
      if (prevBall !== next.showFloatingBall) renderFloatingBall();
      // 双语样式即改即生效:已翻译的译块(含 shadow 内)当场换装,无需重新翻译。
      if (next.bilingualStyle && next.bilingualStyle !== prevStyle) applyBilingualStyleLive(next.bilingualStyle);
    });
    renderFloatingBall();

    if (
      settings?.globalTranslateActive ||
      settings?.autoTranslate ||
      matchesHost(location.hostname, settings?.alwaysTranslateHosts)
    ) {
      requestIdle(() => startTranslation({ auto: true }));
    }
  }

  // 设置页改了双语样式,给页面上已有译块(含 shadow root 内)当场换装。
  function applyBilingualStyleLive(style) {
    state.bilingualStyle = style;
    if (!state.active) return;
    document.documentElement.dataset.yeyiBilingualStyle = style;
    const applyIn = (root) => {
      root.querySelectorAll?.(".yeyi-translation").forEach((node) => {
        node.dataset.style = style;
      });
    };
    applyIn(document);
    for (const shadowRoot of state.shadowRoots) applyIn(shadowRoot);
  }

  async function handleMessage(message) {
    switch (message?.type) {
      case "YEYI_START":
        return startTranslation(message.settings || {});
      case "YEYI_RESTORE":
        return restorePage({ disableGlobal: true });
      case "YEYI_GET_STATUS":
        return publicStatus();
      case "YEYI_TOGGLE_MODE":
        return restartWithMode(message.mode);
      case "YEYI_HIDE_FLOATING":
        return hideFloatingForHost();
      case "YEYI_RETRY_FAILED":
        return retryFailedUnits();
      case "YEYI_CONTEXT_REFINE":
        return contextRefinePage();
      case "YEYI_TOGGLE":
        return state.active ? restorePage({ disableGlobal: true }) : startTranslation({});
      default:
        return publicStatus();
    }
  }

  async function startTranslation(settingsOverride = {}) {
    if (state.booting) {
      try {
        await state.booting;
      } catch {
        // boot 失败不阻塞手动翻译。
      }
      state.booting = null;
    }
    if (state.active) {
      await restorePage({ keepFloating: true, keepGlobal: true });
    }

    const settings = {
      ...(await getContentSettings()),
      ...(settingsOverride || {})
    };
    const host = location.hostname.toLowerCase();
    if (matchesHost(host, settings.neverTranslateHosts)) {
      state.error = "当前网站已加入永不翻译列表。";
      renderStatus();
      return publicStatus();
    }
    if (!settings.hasApiKey) {
      state.error = "请先在设置中配置 API Key。";
      renderStatus();
      if (IS_TOP) sendRuntimeMessage({ type: "YEYI_OPEN_OPTIONS" }).catch(() => {});
      return publicStatus();
    }

    if (!settingsOverride.auto) {
      await setGlobalTranslate(true);
      settings.globalTranslateActive = true;
    }

    state.active = true;
    state.contextRefining = Boolean(settingsOverride.contextRefine);
    state.error = "";
    state.settings = settings;
    state.mode = settings.mode === "replace" ? "replace" : "bilingual";
    state.targetLanguage = settings.targetLanguage || "简体中文";
    state.bilingualStyle = settings.bilingualStyle || "none";
    state.startedAt = Date.now();
    state.translatedCount = 0;
    state.totalCount = 0;
    state.pendingCount = 0;
    state.skippedCount = 0;
    state.units = [];
    state.unitedNodes = new WeakSet();
    state.originalContentMap = new Map();
    state.shadowRoots = new Set();
    state.queue.clear();
    state.nextUnitId = 1;
    state.walkId = `w${Date.now().toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`;
    state.siteRule = computeEffectiveSiteRule(settings.siteRules, location.href);
    applySiteRuleCss();

    updatePageTheme();
    document.documentElement.dataset.yeyiMode = state.mode;
    document.documentElement.dataset.yeyiBilingualStyle = state.bilingualStyle;

    const root = document.body || document.documentElement;
    startObservers();
    // 遍历整页打标签,观察所有顶层段落;进入视口时才建单元入队(懒翻译)。
    observeTopLevelParagraphs(root);
    if (state.contextRefining) {
      collectAllContextUnits();
      queueAllUnitsForContextRefine();
    }
    renderFloatingBall();
    renderStatus();
    return publicStatus();
  }

  async function restartWithMode(nextMode) {
    const cleanMode = nextMode === "replace" ? "replace" : "bilingual";
    const nextSettings = { ...(state.settings || {}), mode: cleanMode };
    await restorePage({ keepFloating: true, keepGlobal: true });
    return startTranslation(nextSettings);
  }

  function retryFailedUnits() {
    let requeued = 0;
    for (const record of state.units) {
      if (record.status !== "error") continue;
      record.status = "failed";
      record.attempts = 0;
      record.error = "";
      state.queue.add(record);
      requeued += 1;
    }
    if (requeued) {
      state.error = "";
      scheduleProcess(0);
    }
    renderStatus();
    return publicStatus();
  }

  async function contextRefinePage() {
    if (state.booting) {
      try {
        await state.booting;
      } catch {
        // boot 失败不阻塞手动精翻。
      }
      state.booting = null;
    }
    if (state.processing) {
      state.error = "当前批次还在翻译，稍等完成后再启动上下文精翻。";
      renderStatus();
      return publicStatus();
    }
    if (!state.active) {
      await startTranslation({ contextRefine: true });
    } else {
      state.contextRefining = true;
      state.error = "";
      collectAllContextUnits();
      queueAllUnitsForContextRefine();
      scheduleProcess(0);
      renderStatus();
    }
    return publicStatus();
  }

  function collectAllContextUnits() {
    const root = document.body || document.documentElement;
    if (!root || !state.active || !state.walkId) return;
    walkAndLabelElement(root, state.walkId);
    const candidates = [];
    if (root.getAttribute?.(PARAGRAPH_ATTR) !== null) candidates.push(root);
    candidates.push(...root.querySelectorAll?.(`[${PARAGRAPH_ATTR}][${WALKED_ATTR}="${cssEscape(state.walkId)}"]`) || []);
    for (const el of candidates) {
      const ancestor = el.parentElement?.closest(`[${PARAGRAPH_ATTR}]`);
      if (!ancestor || !root.contains(ancestor)) collectUnitsFromWalked(el, state.walkId);
    }
    // shadow root 内的段落单独收集;顶层判定只看同一棵 shadow 树(见 observeShadowParagraphs)。
    for (const shadowRoot of state.shadowRoots) {
      if (!shadowRoot?.host?.isConnected) continue;
      const shadowParagraphs = shadowRoot.querySelectorAll?.(`[${PARAGRAPH_ATTR}][${WALKED_ATTR}="${cssEscape(state.walkId)}"]`) || [];
      for (const el of shadowParagraphs) {
        if (!el.parentElement?.closest(`[${PARAGRAPH_ATTR}]`)) collectUnitsFromWalked(el, state.walkId);
      }
    }
  }

  function queueAllUnitsForContextRefine() {
    let queued = 0;
    for (const record of state.units) {
      if (!record.wrapper?.isConnected) continue;
      record.countedBeforeRefine = record.status === "done";
      record.status = record.status === "error" ? "failed" : "queued";
      record.attempts = 0;
      record.error = "";
      state.queue.add(record);
      queued += 1;
    }
    if (!queued) {
      state.error = "当前页面没有可精翻的段落。";
      state.contextRefining = false;
    }
  }

  // ══════════════════════════ DOM 引擎(移植 read-frog) ══════════════════════

  // shadow root 内注入的译块样式副本。页面级 content.css 与 @keyframes 都穿不过
  // shadow 边界——尤其 .yeyi-translation 默认 opacity:0 靠 yeyiFadeSlideIn 淡入,
  // 不注入该动画的话 shadow 内译文会永远不可见。改 content.css 译块段时同步这里。
  // 暗色主题选择器由 :root[data-yeyi-theme] 换成 :host-context([data-yeyi-theme])。
  const SHADOW_CSS = `
.yeyi-content-wrapper { font: inherit; color: inherit; line-height: inherit; letter-spacing: inherit; word-spacing: inherit; }
.yeyi-translation-only { font: inherit; color: inherit; line-height: inherit; letter-spacing: inherit; word-spacing: inherit; }
.yeyi-translation { display: block; box-sizing: border-box; max-width: 100%; margin: 0.32em 0 0; padding: 0; border: 0; background: transparent; color: inherit; font: inherit; line-height: inherit; letter-spacing: inherit; word-spacing: inherit; opacity: 0; transform: translateY(4px); animation: yeyiFadeSlideIn 200ms cubic-bezier(0, 0, 0, 1) forwards; }
.yeyi-translation-inline { display: inline; margin: 0; }
.yeyi-translation[data-style="leftLine"] { padding-left: 0.72em; border-left: 2px solid color-mix(in srgb, currentColor 30%, transparent); opacity: 1; transform: none; }
.yeyi-translation[data-style="underline"] { padding-bottom: 0.08em; border-bottom: 1px dashed color-mix(in srgb, currentColor 38%, transparent); }
.yeyi-translation[data-style="softBlock"] { margin-top: 0.34em; padding: 0.38em 0.52em; border-radius: 8px; background: color-mix(in srgb, currentColor 6%, transparent); }
:host-context([data-yeyi-theme="dark"]) .yeyi-translation[data-style="softBlock"] { background: color-mix(in srgb, currentColor 10%, transparent); }
h1 .yeyi-translation, h2 .yeyi-translation, h3 .yeyi-translation, h4 .yeyi-translation, h5 .yeyi-translation, h6 .yeyi-translation { margin-top: 0.2em; }
.yeyi-pending { display: inline-flex; align-items: baseline; gap: 0.18em; margin-left: 0.28em; color: inherit; opacity: 0.55; vertical-align: baseline; }
.yeyi-pending .yeyi-dot { display: inline-block; width: 0.22em; height: 0.22em; border-radius: 999px; background: currentColor; animation: yeyiDotPulse 900ms ease-in-out infinite; }
.yeyi-pending .yeyi-dot:nth-child(2) { animation-delay: 140ms; }
.yeyi-pending .yeyi-dot:nth-child(3) { animation-delay: 280ms; }
.yeyi-error { display: inline-block; box-sizing: content-box; width: 8px; height: 8px; margin: 0 0 0 0.15em; padding: 4px; border: 0; border-radius: 999px; background: color-mix(in srgb, #d93025 60%, transparent); background-clip: content-box; color: transparent; cursor: pointer; font: 0/0 system-ui; vertical-align: middle; transition: transform 100ms cubic-bezier(0.2, 0, 0, 1), background-color 100ms cubic-bezier(0.2, 0, 0, 1); }
.yeyi-error:hover { transform: scale(1.25); background-color: #d93025; }
:host-context([data-yeyi-theme="dark"]) .yeyi-error { background-color: color-mix(in srgb, #f28b82 60%, transparent); }
:host-context([data-yeyi-theme="dark"]) .yeyi-error:hover { background-color: #f28b82; }
@keyframes yeyiFadeSlideIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
@keyframes yeyiDotPulse { 0%, 80%, 100% { opacity: 0.25; transform: scale(0.8); } 40% { opacity: 1; transform: scale(1); } }
@media (prefers-reduced-motion: reduce) { .yeyi-translation, .yeyi-pending .yeyi-dot { animation: none; transition: none; } .yeyi-translation { opacity: 1; transform: none; } }
`;

  // 记录发现的 open shadow root:加入清理/查段落名册,并补挂 MutationObserver
  // (body 上的观察器看不到 shadow 内部的动态新增节点)。
  function recordShadowRoot(root) {
    if (!root || state.shadowRoots.has(root)) return;
    state.shadowRoots.add(root);
    try {
      state.mutationObserver?.observe(root, { subtree: true, childList: true });
    } catch {
      // 个别宿主环境不允许观察该 root,忽略即可(初始内容仍已翻译)。
    }
  }

  // 若节点落在 open shadow root 内,注入一份译块样式(幂等)。
  function ensureShadowStylesFor(node) {
    const root = node.getRootNode?.();
    // shadow root = DOCUMENT_FRAGMENT_NODE(11) 且带 host;不用 instanceof,跨 iframe realm 不可靠。
    if (!root || root.nodeType !== 11 || !root.host) return;
    if (root.querySelector('style[data-yeyi-shadow-css]')) return;
    const style = (root.host.ownerDocument || document).createElement("style");
    style.setAttribute("data-yeyi-shadow-css", "1");
    style.dataset.yeyi = "1";
    style.textContent = SHADOW_CSS;
    root.appendChild(style);
  }

  // ─────────────── 站点规则(移植 read-frog filter.ts + site-rules) ───────────────
  // 规则由 background 下发(settings.siteRules:用户自定义在前、内置在后),
  // 此处按当前 URL 合并出生效规则:选择器组取并集,minCharacters/minWords 取最大,
  // injectedCss 拼接。用户选择器可能非法,所有 matches/closest 都走 try/catch。

  function globToRegExp(glob) {
    const escaped = String(glob).replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
    return new RegExp(`^${escaped}$`, "i");
  }

  // 匹配一条 pattern:含 "://" 按整 URL 通配;否则按 "host[/path]" 通配。
  function matchSitePattern(pattern, url) {
    const p = String(pattern || "").trim();
    if (!p) return false;
    try {
      if (p.includes("://")) return globToRegExp(p).test(url.href);
      const slash = p.indexOf("/");
      const hostPattern = slash === -1 ? p : p.slice(0, slash);
      const pathPattern = slash === -1 ? "" : p.slice(slash);
      if (!globToRegExp(hostPattern).test(url.hostname)) return false;
      if (!pathPattern) return true;
      return globToRegExp(pathPattern.endsWith("*") ? pathPattern : `${pathPattern}*`).test(url.pathname);
    } catch {
      return false;
    }
  }

  function toPatternList(value) {
    if (Array.isArray(value)) return value;
    return value ? [value] : [];
  }

  function ruleMatchesUrl(rule, url) {
    if (!toPatternList(rule.matches).some((pattern) => matchSitePattern(pattern, url))) return false;
    if (toPatternList(rule.excludeMatches).some((pattern) => matchSitePattern(pattern, url))) return false;
    return true;
  }

  // 合并所有命中规则 → 生效规则(read-frog getEffectiveSiteRule 语义:无 include 声明时为 null=全放行)。
  function computeEffectiveSiteRule(rules, href) {
    if (!Array.isArray(rules) || !rules.length) return null;
    let url;
    try {
      url = new URL(href);
    } catch {
      return null;
    }
    const joinSelectors = (lists) => {
      const flat = lists.flat().map((s) => String(s || "").trim()).filter(Boolean);
      return flat.length ? flat.join(", ") : null;
    };
    const matched = rules.filter((rule) => rule && ruleMatchesUrl(rule, url));
    if (!matched.length) return null;
    return {
      includeSelector: joinSelectors(matched.map((r) => r.includeSelectors || [])),
      excludeSelector: joinSelectors(matched.map((r) => r.excludeSelectors || [])),
      forceBlockSelector: joinSelectors(matched.map((r) => r.forceBlockSelectors || [])),
      forceInlineSelector: joinSelectors(matched.map((r) => r.forceInlineSelectors || [])),
      minCharacters: Math.max(0, ...matched.map((r) => Number(r.minCharacters) || 0)),
      minWords: Math.max(0, ...matched.map((r) => Number(r.minWords) || 0)),
      injectedCss: matched.map((r) => String(r.injectedCss || "").trim()).filter(Boolean).join("\n") || null
    };
  }

  function safeMatches(element, selector) {
    if (!selector) return false;
    try {
      return !!element.matches?.(selector);
    } catch {
      return false;
    }
  }

  function safeClosest(element, selector) {
    if (!selector) return null;
    try {
      return element.closest?.(selector) || null;
    } catch {
      return null;
    }
  }

  // 移植自 read-frog filter.ts isSiteRuleExcludedElement:排除优先,但元素自身或
  // 子树命中 include 时重新纳入(github 式"大范围排除+白名单捞回"依赖此优先级)。
  function isSiteRuleExcludedElement(element) {
    const rule = state.siteRule;
    if (!rule?.excludeSelector) return false;
    if (!safeMatches(element, rule.excludeSelector)) return false;
    if (rule.includeSelector) {
      if (safeMatches(element, rule.includeSelector)) return false;
      try {
        if (element.querySelector?.(rule.includeSelector)) return false;
      } catch {
        // 非法选择器当作未命中
      }
    }
    return true;
  }

  // 移植自 read-frog filter.ts isWithinIncludeScope:声明了 includeSelectors 的规则
  // 是白名单闸门,只有命中区域内的元素才能成为翻译段落;未声明则全放行。
  function isWithinIncludeScope(element) {
    const rule = state.siteRule;
    return !rule?.includeSelector || !!safeClosest(element, rule.includeSelector);
  }

  function isSiteRuleForceBlock(element) {
    return isHTMLElement(element) && safeMatches(element, state.siteRule?.forceBlockSelector);
  }

  function isSiteRuleForceInline(element) {
    return isHTMLElement(element) && safeMatches(element, state.siteRule?.forceInlineSelector);
  }

  // 按规则注入页面 CSS(如放开 line-clamp 截断);restorePage 时移除。
  function applySiteRuleCss() {
    const css = state.siteRule?.injectedCss;
    if (!css) return;
    if (document.querySelector("style[data-yeyi-site-css]")) return;
    const style = document.createElement("style");
    style.setAttribute("data-yeyi-site-css", "1");
    style.dataset.yeyi = "1";
    style.textContent = css;
    (document.head || document.documentElement).appendChild(style);
  }

  function isHTMLElement(node) {
    return !!node && node.nodeType === Node.ELEMENT_NODE && "tagName" in node && "getAttribute" in node;
  }

  function isTextNode(node) {
    return !!node && node.nodeType === Node.TEXT_NODE;
  }

  function isTransNode(node) {
    return isHTMLElement(node) || isTextNode(node);
  }

  function isInlineDisplay(display) {
    const d = String(display || "").trim().toLowerCase();
    if (!d) return false;
    if (d.startsWith("inline")) return true;
    return ["ruby", "ruby-base", "ruby-text", "ruby-base-container", "ruby-text-container"].includes(d);
  }

  // 浅判定:节点自身是否行内翻译节点(文本节点带字,或行内元素)。移植自 read-frog filter.ts。
  function isShallowInlineTransNode(node) {
    if (isTextNode(node) && node.textContent?.trim()) return true;
    if (isHTMLElement(node)) return isShallowInlineHTMLElement(node);
    return false;
  }

  // 首字下沉(drop-cap):float:left 的大号首字母 + 后继是行内节点时按行内处理,
  // 否则会被当成独立块,把新闻站正文第一段割裂成两个单元。移植自 read-frog filter.ts。
  function isLargeInitialFloatingLetter(element) {
    const computedStyle = window.getComputedStyle(element);
    return computedStyle.float === "left" && !!element.nextSibling && isShallowInlineTransNode(element.nextSibling);
  }

  function isShallowInlineHTMLElement(element) {
    if (!element.textContent?.trim()) return false;
    if (FORCE_BLOCK_TAGS.has(element.tagName)) return false;
    if (isLargeInitialFloatingLetter(element)) return true;
    return isInlineDisplay(window.getComputedStyle(element).display);
  }

  function isShallowBlockHTMLElement(element) {
    if (FORCE_BLOCK_TAGS.has(element.tagName)) return true;
    if (isLargeInitialFloatingLetter(element)) return false;
    return !isInlineDisplay(window.getComputedStyle(element).display);
  }

  // 不进入内部遍历、但作为父段落文本一起翻译的元素(notranslate / CODE / TIME)。
  function isDontWalkIntoButTranslate(element) {
    return element.classList.contains(NOTRANSLATE_CLASS) || DONT_WALK_BUT_TRANSLATE_TAGS.has(element.tagName);
  }

  // 既不进入、也不作为文本翻译的元素(隐藏/脚本/媒体/无效标签)。
  function isDontWalkIntoAndDontTranslate(element) {
    if (DONT_WALK_AND_TRANSLATE_TAGS.has(element.tagName)) return true;
    if (element.closest?.("[data-yeyi='1']")) return true; // 雅译自身注入的 UI
    if (isSiteRuleExcludedElement(element)) return true; // 站点规则排除区域(含 include 重纳入)
    if (element.isContentEditable) return true;
    const style = window.getComputedStyle(element);
    if (style.display === "none" || style.visibility === "hidden") return true;
    if (element.hidden) return true;
    if (element.getAttribute("aria-hidden") === "true") return true;
    if (element.classList.contains("sr-only") || element.classList.contains("visually-hidden")) return true;
    return false;
  }

  function hasNoWalkAncestor(element) {
    let current = element.parentElement;
    while (current) {
      if (isDontWalkIntoButTranslate(current) || isDontWalkIntoAndDontTranslate(current)) return true;
      current = current.parentElement;
    }
    return false;
  }

  function isInlineTransNode(node) {
    if (isTextNode(node)) return true;
    return isHTMLElement(node) && node.hasAttribute(INLINE_ATTR);
  }

  function isBlockTransNode(node) {
    if (isTextNode(node)) return false;
    return isHTMLElement(node) && node.hasAttribute(BLOCK_ATTR);
  }

  function isForceInlineTranslation(node) {
    if (!isHTMLElement(node)) return false;
    return FORCE_INLINE_TRANSLATION_TAGS.has(node.tagName) ||
      window.getComputedStyle(node).display.includes("flex");
  }

  // 抽取节点纯文本:文本节点保留必要的首尾空格,<br> 视为换行,跳过不可翻译子树。
  function extractTextContent(node) {
    if (isTextNode(node)) {
      const text = node.textContent ?? "";
      const trimmed = text.trim();
      if (trimmed === "") return " ";
      const leadingWs = text.slice(0, text.length - text.trimStart().length);
      const trailingWs = text.slice(text.trimEnd().length);
      const hasLeading = NON_NEWLINE_WS.test(leadingWs);
      const hasTrailing = NON_NEWLINE_WS.test(trailingWs);
      return (hasLeading ? " " : "") + trimmed + (hasTrailing ? " " : "");
    }
    if (isHTMLElement(node) && node.tagName === "BR") return "\n";
    if (isHTMLElement(node) && isDontWalkIntoAndDontTranslate(node)) return "";
    let out = "";
    for (const child of node.childNodes) {
      if (isTextNode(child) || isHTMLElement(child)) out += extractTextContent(child);
    }
    return out;
  }

  // 递归遍历打标签:标注 walked / paragraph / block / inline。
  // 返回 { forceBlock, isInlineNode } 供父级聚合判定。
  function walkAndLabelElement(element, walkId) {
    if (isDontWalkIntoButTranslate(element) || isDontWalkIntoAndDontTranslate(element)) {
      return { forceBlock: false, isInlineNode: false };
    }

    element.setAttribute(WALKED_ATTR, walkId);

    // 移植自 read-frog: utils/host/dom/traversal.ts — open shadow root 下钻打标签。
    // shadow 子树独立成段,不参与宿主自身的段落/行内判定(返回值丢弃,与 read-frog 一致)。
    if (element.shadowRoot) {
      recordShadowRoot(element.shadowRoot);
      for (const child of element.shadowRoot.children) {
        if (isHTMLElement(child)) walkAndLabelElement(child, walkId);
      }
    }

    let hasInlineNodeChild = false;
    let forceBlock = false;

    const validChildNodes = [...element.childNodes].filter((child) => {
      if (child.nodeType === Node.TEXT_NODE) return true;
      if (isHTMLElement(child)) {
        return !(isDontWalkIntoButTranslate(child) || isDontWalkIntoAndDontTranslate(child));
      }
      return false;
    });

    for (const child of validChildNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        if (child.textContent?.trim()) hasInlineNodeChild = true;
        continue;
      }
      if (isHTMLElement(child)) {
        const result = walkAndLabelElement(child, walkId);
        forceBlock = forceBlock || result.forceBlock;
        if (result.isInlineNode) hasInlineNodeChild = true;
      }
    }

    // 有行内文本子节点 → 该元素是「段落」翻译触发单元(受站点规则 include 白名单闸门约束)。
    if (hasInlineNodeChild && isWithinIncludeScope(element)) element.setAttribute(PARAGRAPH_ATTR, "");

    forceBlock = forceBlock || FORCE_BLOCK_TAGS.has(element.tagName);

    if (element.textContent?.trim() === "" && !forceBlock) {
      return { forceBlock: false, isInlineNode: false };
    }

    const isInlineNode = isShallowInlineHTMLElement(element);
    if (isShallowBlockHTMLElement(element) || forceBlock || isSiteRuleForceBlock(element)) {
      element.setAttribute(BLOCK_ATTR, "");
    } else if (isInlineNode) {
      element.setAttribute(INLINE_ATTR, "");
    }

    return { forceBlock, isInlineNode };
  }

  // 打标签后,把顶层段落交给 IntersectionObserver(进入视口才翻译)。
  function observeTopLevelParagraphs(container) {
    const observer = state.intersectionObserver;
    if (!state.active || !state.walkId || !observer || !isHTMLElement(container)) return;
    if (hasNoWalkAncestor(container)) return;
    if (isDontWalkIntoButTranslate(container) || isDontWalkIntoAndDontTranslate(container)) return;

    walkAndLabelElement(container, state.walkId);
    // shadow root 里的段落 querySelectorAll 穿不过边界,单独收集观察(重复 observe 是 no-op)。
    observeShadowParagraphs(observer);

    if (container.getAttribute(PARAGRAPH_ATTR) !== null && container.getAttribute(WALKED_ATTR) === state.walkId) {
      observer.observe(container);
      return;
    }

    const paragraphs = [...container.querySelectorAll(`[${PARAGRAPH_ATTR}][${WALKED_ATTR}="${cssEscape(state.walkId)}"]`)];
    for (const el of paragraphs) {
      const ancestor = el.parentElement?.closest(`[${PARAGRAPH_ATTR}]`);
      // 只观察顶层段落:没有段落祖先,或段落祖先在 container 之外。
      if (!ancestor || !container.contains(ancestor)) observer.observe(el);
    }
    renderStatus();
  }

  // 遍历已记录的 open shadow root,把其中的顶层段落交给 IntersectionObserver。
  // 顶层判定只看同一棵 shadow 树(closest 不跨 shadow 边界;宿主侧单元与 shadow 内
  // 单元物理上分属两棵树,不会重复收录同一文本)。
  function observeShadowParagraphs(observer) {
    if (!state.active || !state.walkId || !observer) return;
    for (const shadowRoot of state.shadowRoots) {
      if (!shadowRoot?.host?.isConnected) continue;
      const paragraphs = shadowRoot.querySelectorAll?.(`[${PARAGRAPH_ATTR}][${WALKED_ATTR}="${cssEscape(state.walkId)}"]`) || [];
      for (const el of paragraphs) {
        if (!el.parentElement?.closest(`[${PARAGRAPH_ATTR}]`)) observer.observe(el);
      }
    }
  }

  function startObservers() {
    stopObservers();
    state.intersectionObserver = new IntersectionObserver((entries, observer) => {
      if (!state.active) return;
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const target = entry.target;
        observer.unobserve(target);
        if (isHTMLElement(target) && !target.closest(`.${WRAPPER_CLASS}`)) {
          collectUnitsFromWalked(target, state.walkId);
        }
      }
      scheduleProcess(80);
    }, { root: null, rootMargin: "600px 0px", threshold: 0.1 });

    state.mutationObserver = new MutationObserver((mutations) => {
      if (!state.active) return;
      const added = [];
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (isHTMLElement(node) && !node.closest?.("[data-yeyi='1']") && !node.closest?.(`.${WRAPPER_CLASS}`)) {
            added.push(node);
          }
        }
      }
      if (!added.length) return;
      clearTimeout(state.mutationTimer);
      state.mutationTimer = setTimeout(() => {
        if (!state.active) return;
        for (const node of added) {
          if (node.isConnected) observeTopLevelParagraphs(node);
        }
        renderStatus();
      }, 400);
    });
    state.mutationObserver.observe(document.body || document.documentElement, {
      subtree: true,
      childList: true
    });
  }

  function stopObservers() {
    state.intersectionObserver?.disconnect();
    state.mutationObserver?.disconnect();
    state.intersectionObserver = null;
    state.mutationObserver = null;
    clearTimeout(state.mutationTimer);
  }

  // 一路向下钻:当元素只有唯一 HTML 子元素、无文本子节点时,下沉到最内层,
  // 让译文尽量贴着真正承载文本的元素插入(避免包裹层制造多余缩进/边框)。
  function unwrapDeepestOnlyHTMLChild(element) {
    let current = element;
    while (current) {
      const kept = [...current.childNodes].filter((child) => {
        if (!child.textContent?.trim()) return false;
        if (child.nodeType === Node.TEXT_NODE) return true;
        return isHTMLElement(child) && !isDontWalkIntoAndDontTranslate(child);
      });
      const elems = kept.filter((c) => c.nodeType === Node.ELEMENT_NODE);
      if (!(elems.length === 1 && kept.length === 1)) break;
      if (!isHTMLElement(elems[0])) break;
      current = elems[0];
    }
    return current;
  }

  // 把一个已打标签的段落元素拆成翻译单元并入队(移植 translateWalkedElement)。
  function collectUnitsFromWalked(element, walkId) {
    if (!state.active || !isHTMLElement(element)) return;
    if (element.getAttribute(WALKED_ATTR) !== walkId) return;
    if (element.querySelector(`.${WRAPPER_CLASS}`)) return; // 已翻译过

    if (element.getAttribute(PARAGRAPH_ATTR) !== null) {
      let hasBlockChild = false;
      for (const child of element.childNodes) {
        if (isHTMLElement(child) && child.hasAttribute(BLOCK_ATTR)) { hasBlockChild = true; break; }
      }
      const isFlexParent = window.getComputedStyle(element).display.includes("flex");

      if (!hasBlockChild) {
        prepareUnit([element], false);
        return;
      }

      // 段落里夹着块级子元素:连续的行内节点合成一个单元,块级子元素各自递归。
      const children = [...element.childNodes];
      let inlineRun = [];
      for (const child of children) {
        if (isTransNode(child) && isBlockTransNode(child) && !isTextNode(child)) {
          if (inlineRun.length) prepareUnit(inlineRun, !isFlexParent);
          inlineRun = [];
          collectUnitsFromWalked(child, walkId);
        } else {
          inlineRun.push(child);
        }
      }
      if (inlineRun.length) prepareUnit(inlineRun, !isFlexParent);
    } else {
      for (const child of element.childNodes) {
        if (isHTMLElement(child)) collectUnitsFromWalked(child, walkId);
      }
      // 移植自 read-frog: translate/core/translation-walker.ts:70-76 — 下钻 open shadow root。
      if (element.shadowRoot) {
        for (const child of element.shadowRoot.children) {
          if (isHTMLElement(child)) collectUnitsFromWalked(child, walkId);
        }
      }
    }
  }

  // 由一组相邻节点建单元:算出锚点/原文/排版模式,插入带 spinner 的 wrapper,入队。
  function prepareUnit(nodes, forceBlock) {
    const transNodes = nodes.filter(isTransNode);
    if (!transNodes.length) return;
    if (transNodes.every((n) => state.unitedNodes.has(n))) return;

    const lastNode = transNodes[transNodes.length - 1];
    let targetNode = lastNode;
    if (transNodes.length === 1 && isBlockTransNode(lastNode) && isHTMLElement(lastNode)) {
      targetNode = unwrapDeepestOnlyHTMLChild(lastNode);
    }
    if (isHTMLElement(targetNode) && targetNode.querySelector?.(`.${WRAPPER_CLASS}`)) return;

    const serialized = serializeNodesForTranslation(transNodes);
    const source = serialized.text.trim();
    const plainSource = serialized.plainText.trim();
    if (!passesTextFilter(plainSource, state.targetLanguage)) return;
    // 站点规则门槛:过短文本跳过。minWords 只约束不含 CJK 的文本——CJK 无空格分词,
    // 按词数会误杀整段中文(与 read-frog 的规则本意一致,用于 wikipedia 式短碎链接)。
    const siteRule = state.siteRule;
    if (siteRule) {
      if (siteRule.minCharacters && plainSource.length < siteRule.minCharacters) return;
      if (siteRule.minWords && !/[぀-ヿ㐀-鿿가-힯]/.test(plainSource)) {
        const wordCount = (plainSource.match(/[A-Za-z0-9]+(?:['-][A-Za-z0-9]+)*/g) || []).length;
        if (wordCount < siteRule.minWords) return;
      }
    }

    transNodes.forEach((n) => state.unitedNodes.add(n));

    const record = {
      id: `u${state.nextUnitId++}_${shortHash(source)}`,
      nodes: transNodes,
      targetNode,
      source,
      plainSource,
      placeholders: serialized.placeholders,
      forceBlock,
      wrapper: null,
      replaceNodes: null,
      replaceContainer: null,
      status: "queued",
      attempts: 0,
      error: ""
    };

    if (!insertWrapper(record)) {
      transNodes.forEach((n) => state.unitedNodes.delete(n));
      return;
    }

    state.units.push(record);
    state.totalCount += 1;
    state.queue.add(record);
    scheduleProcess(120);
  }

  // 插入 wrapper(内含 spinner)。双语:插在锚点之后;替换:记录待删原节点并存原文快照。
  function insertWrapper(record) {
    const { targetNode } = record;
    if (!targetNode || !targetNode.parentNode && !isHTMLElement(targetNode)) return false;
    const ownerDoc = targetNode.ownerDocument || document;
    const wrapper = ownerDoc.createElement("span");
    wrapper.className = `${NOTRANSLATE_CLASS} ${WRAPPER_CLASS}`;
    wrapper.dataset.yeyi = "1";
    wrapper.setAttribute(MODE_ATTR, state.mode);
    wrapper.setAttribute(WALKED_ATTR, state.walkId);
    spinnerInto(wrapper);
    record.wrapper = wrapper;

    if (state.mode === "replace") {
      // 替换模式:确定「容器」与要删除的原节点,并按 read-frog 语义存父级原文快照。
      let container;
      let replaceNodes;
      if (record.nodes.length === 1 && isHTMLElement(record.nodes[0])) {
        container = targetNode; // 已是下钻后的最内层元素
        replaceNodes = [...container.childNodes];
      } else {
        container = targetNode.parentElement;
        replaceNodes = record.nodes;
      }
      if (!container) return false;
      record.replaceContainer = container;
      record.replaceNodes = replaceNodes;
      if (!state.originalContentMap.has(container) && !container.querySelector(`.${WRAPPER_CLASS}`)) {
        state.originalContentMap.set(container, container.innerHTML);
      }
      wrapper.style.display = "contents";
      const anchor = replaceNodes[replaceNodes.length - 1] || targetNode;
      anchor.parentNode?.insertBefore(wrapper, anchor.nextSibling);
      if (wrapper.isConnected) ensureShadowStylesFor(wrapper);
      return wrapper.isConnected;
    }

    // 双语模式:文本锚点或多节点单元 → 插到锚点之后;单一块级元素 → 追加到其内部末尾。
    if (isTextNode(targetNode) || record.nodes.length > 1) {
      if (!targetNode.parentNode) return false;
      targetNode.parentNode.insertBefore(wrapper, targetNode.nextSibling);
    } else {
      targetNode.appendChild(wrapper);
    }
    if (wrapper.isConnected) ensureShadowStylesFor(wrapper);
    return wrapper.isConnected;
  }

  function spinnerInto(wrapper) {
    wrapper.textContent = "";
    const pending = wrapper.ownerDocument.createElement("span");
    pending.className = "yeyi-pending";
    pending.dataset.yeyi = "1";
    pending.setAttribute("aria-label", "雅译正在翻译");
    pending.innerHTML = '<span class="yeyi-dot"></span><span class="yeyi-dot"></span><span class="yeyi-dot"></span>';
    wrapper.appendChild(pending);
  }

  // ══════════════════════════ 批量翻译队列(沿用雅译) ════════════════════════

  function scheduleProcess(delayMs = 0) {
    if (!state.active) return;
    clearTimeout(state.processTimer);
    state.processTimer = setTimeout(() => processQueue().catch((error) => {
      state.error = error?.message || String(error);
      state.processing = false;
      clearPending();
      renderStatus();
      if (state.active && state.queue.size) scheduleProcess(200);
    }), delayMs);
  }

  async function processQueue() {
    if (!state.active || state.processing) return;
    const records = takeNextBatch();
    if (!records.length) {
      state.pendingCount = 0;
      pruneQueue();
      renderStatus();
      return;
    }

    const refining = state.contextRefining;
    const requestItems = refining
      ? buildContextRefineItems(records)
      : records.map((record) => ({ id: record.id, text: record.source }));

    state.processing = true;
    state.error = "";
    for (const record of records) {
      record.status = "pending";
      record.attempts += 1;
      if (record.wrapper?.isConnected) spinnerInto(record.wrapper);
    }
    state.pendingCount = records.length;
    renderStatus();

    try {
      const payload = await sendRuntimeMessage({
        type: refining ? "YEYI_CONTEXT_REFINE_BATCH" : "YEYI_TRANSLATE_BATCH",
        items: requestItems,
        settingsOverride: buildSettingsOverride(refining)
      });
      const translations = payload.translations || {};
      const errors = payload.errors || {};
      for (const record of records) {
        if (!record.wrapper?.isConnected) continue;
        const translation = translations[record.id];
        if (translation !== undefined && translation !== null && translation !== "") {
          fillUnit(record, translation, { contextRefined: refining });
        } else if (refining && record.previousTranslationForRefine) {
          fillUnit(record, record.previousTranslationForRefine, { contextRefined: true });
        } else {
          markFailed(record, errors[record.id] || (refining ? "模型没有返回该段精翻结果。" : "模型没有返回该段译文。"));
        }
      }
    } catch (error) {
      for (const record of records) {
        if (refining && record.previousTranslationForRefine) {
          fillUnit(record, record.previousTranslationForRefine, { contextRefined: true });
        } else {
          markFailed(record, error?.message || String(error));
        }
      }
    } finally {
      state.pendingCount = 0;
      state.processing = false;
      if (state.contextRefining && !state.queue.size) state.contextRefining = false;
      renderStatus();
      if (state.active && state.queue.size) scheduleProcess(40);
    }
  }

  function buildSettingsOverride(refining) {
    return {
      mode: state.mode,
      targetLanguage: state.targetLanguage,
      sourceLanguage: state.settings?.sourceLanguage,
      quality: state.settings?.quality,
      batchSize: state.settings?.batchSize,
      maxRetries: state.settings?.maxRetries,
      requestTimeoutMs: state.settings?.requestTimeoutMs,
      maxCharsPerItem: state.settings?.maxCharsPerItem,
      temperature: state.settings?.temperature,
      maxTokens: state.settings?.maxTokens,
      thinkingMode: state.settings?.thinkingMode,
      glossary: state.settings?.glossary,
      concurrency: state.settings?.concurrency,
      pageContext: pageContext(),
      contextRefine: refining
    };
  }

  function buildContextRefineItems(records) {
    const ordered = state.units.filter((record) => record.wrapper?.isConnected);
    return records.map((record) => {
      const index = ordered.indexOf(record);
      const before = ordered.slice(Math.max(0, index - 2), index)
        .map((item) => item.plainSource || item.source)
        .join("\n");
      const after = ordered.slice(index + 1, index + 3)
        .map((item) => item.plainSource || item.source)
        .join("\n");
      const previousTranslation = currentTranslationText(record);
      record.previousTranslationForRefine = previousTranslation;
      return {
        id: record.id,
        text: record.source,
        previousTranslation,
        headingPath: headingPathForRecord(record),
        before,
        after
      };
    });
  }

  function currentTranslationText(record) {
    const wrapper = record.wrapper;
    if (!wrapper?.isConnected) return "";
    const nodes = wrapper.querySelectorAll(".yeyi-translation, .yeyi-translation-only");
    return normalizeText([...nodes].map((node) => node.textContent || "").join("\n"));
  }

  function elementSourceText(element) {
    if (!isHTMLElement(element)) return "";
    const clone = element.cloneNode(true);
    clone.querySelectorAll?.("[data-yeyi='1']").forEach((node) => node.remove());
    return normalizeText(clone.textContent || "");
  }

  function headingPathForRecord(record) {
    const target = isTextNode(record.targetNode) ? record.targetNode.parentElement : record.targetNode;
    if (!isHTMLElement(target)) return "";
    const headings = [...document.querySelectorAll("h1,h2,h3")]
      .filter((heading) => elementSourceText(heading));
    return headings
      .filter((heading) => heading === target || (heading.compareDocumentPosition(target) & Node.DOCUMENT_POSITION_FOLLOWING))
      .slice(-3)
      .map((heading) => `${heading.tagName}: ${elementSourceText(heading).slice(0, 120)}`)
      .join(" > ");
  }

  function takeNextBatch() {
    const queued = Array.from(state.queue)
      .filter((record) => record.wrapper?.isConnected && (record.status === "queued" || record.status === "failed"));
    const firstBatch = state.translatedCount === 0;
    const batchSize = state.contextRefining
      ? Math.min(4, Math.max(1, Number(state.settings?.batchSize) || 4))
      : (firstBatch ? Math.min(6, Math.max(4, Number(state.settings?.batchSize) || 6)) : Math.max(1, Number(state.settings?.batchSize) || 10));
    const maxChars = state.contextRefining
      ? 3200
      : (firstBatch ? 2000 : 2500);
    const picked = [];
    let chars = 0;

    for (const record of queued) {
      const nextChars = chars + record.source.length + (state.contextRefining ? Math.min(800, currentTranslationText(record).length) : 0);
      if (picked.length && (picked.length >= batchSize || nextChars > maxChars)) break;
      state.queue.delete(record);
      picked.push(record);
      chars = nextChars;
    }
    return picked;
  }

  function pruneQueue() {
    for (const record of Array.from(state.queue)) {
      if (!record.wrapper?.isConnected || !["queued", "failed"].includes(record.status)) {
        state.queue.delete(record);
      }
    }
  }

  // 写入译文。回声(模型原样吐回)/空 → 判无需翻译,移除 wrapper。
  function fillUnit(record, translation, options = {}) {
    const wrapper = record.wrapper;
    if (!wrapper?.isConnected) return;
    const countedBefore = Boolean(options.contextRefined && record.countedBeforeRefine);
    let trimmed = String(translation || "").trim();
    const isEcho = normalizeText(stripPlaceholderTags(trimmed)) === normalizeText(record.plainSource || record.source);
    let usedPreviousTranslation = false;
    if (options.contextRefined && (!trimmed || isEcho) && record.previousTranslationForRefine) {
      trimmed = record.previousTranslationForRefine;
      usedPreviousTranslation = true;
    }
    if (!trimmed || (isEcho && !usedPreviousTranslation)) {
      wrapper.remove();
      record.status = "done";
      record.error = "";
      if (!countedBefore) {
        state.translatedCount += 1;
        state.skippedCount += 1;
      }
      delete record.countedBeforeRefine;
      delete record.previousTranslationForRefine;
      return;
    }

    const ownerDoc = wrapper.ownerDocument;

    if (state.mode === "replace") {
      wrapper.textContent = "";
      const node = ownerDoc.createElement("span");
      node.className = "yeyi-translation-only";
      node.dataset.yeyi = "1";
      if (options.contextRefined) node.dataset.contextRefined = "true";
      appendTranslatedContent(node, record, trimmed);
      wrapper.appendChild(node);
      // 删除原节点,只留译文(嵌套块级子单元已各自成单元,不在 replaceNodes 内)。
      for (const original of record.replaceNodes || []) {
        if (original !== wrapper && original.isConnected) original.remove();
      }
    } else {
      wrapper.textContent = "";
      const useBlock = decideBlockTranslation(record);
      const node = ownerDoc.createElement("span");
      node.className = useBlock ? "yeyi-translation" : "yeyi-translation yeyi-translation-inline";
      node.dataset.yeyi = "1";
      node.dataset.style = state.bilingualStyle;
      if (options.contextRefined) node.dataset.contextRefined = "true";
      appendTranslatedContent(node, record, trimmed);
      if (!useBlock) wrapper.appendChild(ownerDoc.createTextNode("  "));
      wrapper.appendChild(node);
    }

    record.status = "done";
    record.error = "";
    if (!countedBefore) state.translatedCount += 1;
    delete record.countedBeforeRefine;
    delete record.previousTranslationForRefine;
  }

  // 译文按块级还是行内排版(移植 insertion 优先级:强制行内 > 强制块 > 节点行内 > 节点块级)。
  function decideBlockTranslation(record) {
    const target = record.targetNode;
    // 优先级对齐 read-frog translation-insertion.ts:93 —
    // siteRuleForceBlock > forceInline(含站点规则) > forceBlock > inline > block。
    if (isSiteRuleForceBlock(target)) return true;
    if (isForceInlineTranslation(target) || isSiteRuleForceInline(target)) return false;
    if (record.forceBlock) return true;
    if (isInlineTransNode(target)) return false;
    if (isBlockTransNode(target)) return true;
    return true; // 兜底按块级,保证独占一行不挤压原文
  }

  function serializeNodesForTranslation(nodes) {
    const placeholders = [];
    let nextId = 1;

    function serialize(node) {
      if (isTextNode(node)) {
        return { text: normalizeTextNodeForModel(node.textContent || ""), plainText: normalizeTextNodeForModel(node.textContent || "") };
      }
      if (!isHTMLElement(node)) return { text: "", plainText: "" };
      if (node.tagName === "BR") return { text: "\n", plainText: "\n" };
      if (isDontWalkIntoAndDontTranslate(node)) return { text: "", plainText: "" };

      const plainText = extractTextContent(node);
      if (shouldProtectInlineNode(node)) {
        const id = String(nextId++);
        placeholders.push({ id, node });
        return {
          text: `<t${id}>${plainText}</t${id}>`,
          plainText
        };
      }

      let text = "";
      let nestedPlain = "";
      for (const child of node.childNodes) {
        const part = serialize(child);
        text += part.text;
        nestedPlain += part.plainText;
      }
      return { text, plainText: nestedPlain };
    }

    return nodes.reduce((acc, node) => {
      const part = serialize(node);
      acc.text += part.text;
      acc.plainText += part.plainText;
      return acc;
    }, { text: "", plainText: "", placeholders });
  }

  function normalizeTextNodeForModel(text) {
    const raw = String(text || "");
    const trimmed = raw.trim();
    if (!trimmed) return " ";
    const leadingWs = raw.slice(0, raw.length - raw.trimStart().length);
    const trailingWs = raw.slice(raw.trimEnd().length);
    const hasLeading = NON_NEWLINE_WS.test(leadingWs);
    const hasTrailing = NON_NEWLINE_WS.test(trailingWs);
    return (hasLeading ? " " : "") + trimmed + (hasTrailing ? " " : "");
  }

  function shouldProtectInlineNode(element) {
    if (!PLACEHOLDER_TAGS.has(element.tagName)) return false;
    if (!element.textContent?.trim()) return false;
    if (element.querySelector?.(`.${WRAPPER_CLASS}, [data-yeyi='1']`)) return false;
    if (isShallowBlockHTMLElement(element) && !DONT_WALK_BUT_TRANSLATE_TAGS.has(element.tagName)) return false;
    return true;
  }

  function appendTranslatedContent(container, record, translation) {
    const placeholders = new Map((record.placeholders || []).map((item) => [item.id, item.node]));
    if (!placeholders.size) {
      container.textContent = translation;
      return;
    }

    const doc = container.ownerDocument || document;
    const fragment = doc.createDocumentFragment();
    const source = String(translation || "");
    const pattern = /<t(\d+)>([\s\S]*?)<\/t\1>/g;
    let lastIndex = 0;
    let matched = false;
    let match;

    while ((match = pattern.exec(source))) {
      const original = placeholders.get(match[1]);
      if (!original) continue;
      appendPlainText(fragment, source.slice(lastIndex, match.index));
      const clone = original.cloneNode(false);
      clone.textContent = stripPlaceholderTags(match[2]);
      fragment.appendChild(clone);
      lastIndex = pattern.lastIndex;
      matched = true;
    }

    if (!matched) {
      container.textContent = stripPlaceholderTags(source);
      return;
    }
    appendPlainText(fragment, source.slice(lastIndex));
    container.textContent = "";
    container.appendChild(fragment);
  }

  function appendPlainText(fragment, text) {
    const clean = stripPlaceholderTags(text);
    if (clean) fragment.appendChild((fragment.ownerDocument || document).createTextNode(clean));
  }

  function stripPlaceholderTags(text) {
    return String(text || "")
      .replace(/<\/?t\d+>/g, "");
  }

  function markFailed(record, reason) {
    const wrapper = record.wrapper;
    const maxAttempts = Math.max(1, Number(state.settings?.maxRetries) || 1) + 1;
    if (record.attempts < maxAttempts) {
      record.status = "failed";
      state.queue.add(record);
      return;
    }

    record.status = "error";
    record.error = reason;
    if (!wrapper?.isConnected) return;
    wrapper.textContent = "";
    const errorNode = wrapper.ownerDocument.createElement("button");
    errorNode.type = "button";
    errorNode.className = "yeyi-error";
    errorNode.dataset.yeyi = "1";
    errorNode.title = reason;
    errorNode.setAttribute("aria-label", "译文失败，点击重试");
    errorNode.textContent = "·";
    errorNode.addEventListener("click", () => {
      record.status = "failed";
      record.attempts = 0;
      state.queue.add(record);
      scheduleProcess(0);
    });
    wrapper.appendChild(errorNode);
  }

  function clearPending() {
    for (const record of state.units) {
      if (record.status === "pending") {
        record.status = "failed";
        state.queue.add(record);
      }
    }
  }

  async function restorePage(options = {}) {
    stopObservers();
    clearTimeout(state.processTimer);
    clearTimeout(state.statusTimer);

    // 替换模式:按容器原文快照还原(会重建节点,丢失监听器,与 read-frog 一致)。
    for (const [container, html] of state.originalContentMap) {
      if (container?.isConnected) container.innerHTML = html;
    }
    state.originalContentMap.clear();
    // 双语模式(及任何残留 wrapper):直接移除译块,原文未动。
    const root = document.documentElement;
    root.querySelectorAll?.(`.${WRAPPER_CLASS}`).forEach((wrapper) => wrapper.remove());
    // 清除遍历标签,避免影响下一轮 walkId 判定。
    root.querySelectorAll?.(`[${WALKED_ATTR}]`).forEach((el) => {
      for (const attr of WALK_ATTRS) el.removeAttribute(attr);
    });
    // shadow root 内的译块/遍历标签/注入样式,light 树的 querySelectorAll 够不到,逐个清理。
    for (const shadowRoot of state.shadowRoots) {
      if (!shadowRoot?.host) continue;
      shadowRoot.querySelectorAll?.(`.${WRAPPER_CLASS}`).forEach((wrapper) => wrapper.remove());
      shadowRoot.querySelectorAll?.(`[${WALKED_ATTR}]`).forEach((el) => {
        for (const attr of WALK_ATTRS) el.removeAttribute(attr);
      });
      shadowRoot.querySelector?.("style[data-yeyi-shadow-css]")?.remove();
    }
    state.shadowRoots = new Set();
    // 站点规则注入的页面 CSS 一并移除,生效规则复位。
    document.querySelector("style[data-yeyi-site-css]")?.remove();
    state.siteRule = null;

    for (const record of state.units) record.status = "restored";

    state.active = false;
    state.processing = false;
    state.contextRefining = false;
    state.translatedCount = 0;
    state.totalCount = 0;
    state.pendingCount = 0;
    state.skippedCount = 0;
    state.error = "";
    state.units = [];
    state.unitedNodes = new WeakSet();
    state.queue.clear();
    delete document.documentElement.dataset.yeyiMode;
    delete document.documentElement.dataset.yeyiBilingualStyle;
    delete document.documentElement.dataset.yeyiTheme;
    if (options.disableGlobal && !options.keepGlobal) {
      await setGlobalTranslate(false).catch(() => {});
    }
    if (!options.keepFloating) renderFloatingBall();
    renderStatus();
    return publicStatus();
  }

  async function hideFloatingForHost() {
    const settings = await getContentSettings();
    const host = location.hostname.toLowerCase();
    const never = uniqueHosts([...(settings.neverTranslateHosts || []), host]);
    const always = (settings.alwaysTranslateHosts || []).filter((item) => !matchesHost(host, [item]));
    await sendRuntimeMessage({
      type: "YEYI_SAVE_SETTINGS",
      settings: {
        neverTranslateHosts: never,
        alwaysTranslateHosts: always
      }
    });
    state.hiddenForHost = true;
    removeFloatingBall();
    return publicStatus();
  }

  function renderStatus() {
    updateFloatingBall();
    sendStatusThrottled();
  }

  // ══════════════════════════ 搜索框助翻(沿用雅译) ══════════════════════════

  function setupSearchAssist(settings) {
    if (!IS_TOP) return; // 搜索助翻只在顶层帧
    state.searchAssistEnabled = Boolean(settings?.searchBoxTranslate);
    state.searchAssistMode = settings?.searchBoxTranslateMode === "replace" ? "replace" : "suggest";
    if (!state.searchAssistEnabled || state.searchAssistReady) return;
    state.searchAssistReady = true;
    document.addEventListener("input", handleSearchInput, true);
    document.addEventListener("focusin", handleSearchFocus, true);
    document.addEventListener("compositionstart", () => {
      state.isComposing = true;
    }, true);
    document.addEventListener("compositionend", (event) => {
      state.isComposing = false;
      handleSearchInput(event);
    }, true);
    document.addEventListener("pointerdown", handleSearchPointerDown, true);
    window.addEventListener("scroll", positionSearchPanel, { passive: true });
    window.addEventListener("resize", positionSearchPanel, { passive: true });
  }

  function handleSearchFocus(event) {
    const input = searchInputFromTarget(event.target);
    if (input) state.searchInput = input;
  }

  function handleSearchInput(event) {
    if (!state.searchAssistEnabled || state.isComposing) return;
    const input = searchInputFromTarget(event.target);
    if (!input) return;
    state.searchInput = input;
    const text = String(input.value || "").trim();
    clearTimeout(state.searchTimer);
    if (text.length < 2 || !hasCjk(text)) {
      hideSearchPanel();
      return;
    }
    state.searchTimer = setTimeout(() => {
      requestSearchSuggestion(input, text).catch((error) => {
        renderSearchPanel(input, "", error?.message || "搜索词翻译失败。", "error");
      });
    }, 650);
  }

  function handleSearchPointerDown(event) {
    if (!state.searchPanel?.isConnected) return;
    const target = event.target;
    if (state.searchPanel.contains(target) || target === state.searchInput) return;
    hideSearchPanel();
  }

  async function requestSearchSuggestion(input, text) {
    const requestId = ++state.searchRequestId;
    renderSearchPanel(input, "", "正在生成英文搜索词...", "loading");
    const result = await sendRuntimeMessage({
      type: "YEYI_TRANSLATE_SEARCH_QUERY",
      text
    });
    if (requestId !== state.searchRequestId || !input.isConnected || String(input.value || "").trim() !== text) return;
    const translated = String(result?.text || "").trim();
    if (!translated) {
      hideSearchPanel();
      return;
    }
    if (state.searchAssistMode === "replace") {
      fillSearchInput(input, translated);
      hideSearchPanel();
      return;
    }
    renderSearchPanel(input, translated, "", "ready");
  }

  function renderSearchPanel(input, text, message, status) {
    let panel = state.searchPanel;
    if (!panel?.isConnected) {
      panel = document.createElement("div");
      panel.className = "yeyi-search-suggest";
      panel.dataset.yeyi = "1";
      panel.innerHTML = `
        <div class="yeyi-search-title">英文搜索</div>
        <div class="yeyi-search-text"></div>
        <div class="yeyi-search-actions">
          <button type="button" data-action="fill">填入</button>
          <button type="button" data-action="copy">复制</button>
          <button type="button" data-action="close">关闭</button>
        </div>
      `;
      panel.addEventListener("click", (event) => {
        const action = event.target?.dataset?.action;
        if (!action) return;
        const value = panel.dataset.value || "";
        if (action === "fill" && state.searchInput) fillSearchInput(state.searchInput, value);
        if (action === "copy") copyText(value);
        if (action === "close" || action === "fill") hideSearchPanel();
      });
      document.documentElement.append(panel);
      state.searchPanel = panel;
    }

    panel.dataset.status = status;
    panel.dataset.value = text;
    panel.querySelector(".yeyi-search-text").textContent = text || message;
    panel.querySelector('[data-action="fill"]').disabled = !text;
    panel.querySelector('[data-action="copy"]').disabled = !text;
    positionSearchPanel();
  }

  function positionSearchPanel() {
    if (!state.searchPanel?.isConnected || !state.searchInput?.isConnected) return;
    const rect = state.searchInput.getBoundingClientRect();
    const panelWidth = Math.min(340, Math.max(240, rect.width || 260));
    const left = Math.min(
      window.innerWidth - panelWidth - 10,
      Math.max(10, rect.left)
    );
    const top = Math.min(window.innerHeight - 96, Math.max(10, rect.bottom + 8));
    state.searchPanel.style.width = `${panelWidth}px`;
    state.searchPanel.style.left = `${left}px`;
    state.searchPanel.style.top = `${top}px`;
  }

  function hideSearchPanel() {
    clearTimeout(state.searchTimer);
    if (state.searchPanel?.isConnected) state.searchPanel.remove();
    state.searchPanel = null;
  }

  function fillSearchInput(input, value) {
    input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    input.focus();
  }

  function copyText(value) {
    if (!value) return;
    navigator.clipboard?.writeText(value).catch(() => {});
  }

  function searchInputFromTarget(target) {
    if (!target || target.nodeType !== Node.ELEMENT_NODE) return null;
    const element = target.closest?.("input, textarea, [role='searchbox']");
    if (!element || element.closest("[data-yeyi='1']")) return null;
    if (!["INPUT", "TEXTAREA"].includes(element.tagName)) return null;
    if (shouldSkipSearchInput(element)) return null;
    return looksLikeSearchInput(element) ? element : null;
  }

  function shouldSkipSearchInput(input) {
    if (input.disabled || input.readOnly) return true;
    if (input.closest("[contenteditable='true'], [aria-hidden='true']")) return true;
    if (input.tagName === "TEXTAREA") return false;
    const type = String(input.type || "text").toLowerCase();
    if (["password", "email", "tel", "number", "url", "date", "time", "file", "checkbox", "radio", "submit", "button"].includes(type)) return true;
    return false;
  }

  function looksLikeSearchInput(input) {
    if (input.tagName === "INPUT" && String(input.type || "").toLowerCase() === "search") return true;
    if (input.getAttribute("role") === "searchbox") return true;
    if (input.closest("form[role='search'], [role='search']")) return true;
    const haystack = [
      input.name,
      input.id,
      input.className,
      input.placeholder,
      input.getAttribute("aria-label"),
      input.getAttribute("title")
    ].join(" ").toLowerCase();
    return /search|query|keyword|\bq\b|搜索|查询|关键词/.test(haystack);
  }

  function sendStatusThrottled() {
    const now = Date.now();
    const elapsed = now - state.lastStatusSentAt;
    clearTimeout(state.statusTimer);
    if (elapsed >= 500) {
      state.lastStatusSentAt = now;
      chrome.runtime.sendMessage({ type: "YEYI_STATUS", status: publicStatus() }).catch(() => {});
      return;
    }
    state.statusTimer = setTimeout(() => {
      state.lastStatusSentAt = Date.now();
      chrome.runtime.sendMessage({ type: "YEYI_STATUS", status: publicStatus() }).catch(() => {});
    }, 500 - elapsed);
  }

  // ══════════════════════════ 悬浮球(沿用雅译) ══════════════════════════════

  function renderFloatingBall() {
    if (!IS_TOP) return; // 悬浮球只在顶层帧
    const settings = state.settings || {};
    if (state.hiddenForHost || settings.showFloatingBall === false) {
      removeFloatingBall();
      return;
    }
    if (state.floatingRoot?.isConnected) {
      updateFloatingBall();
      return;
    }

    const root = document.createElement("div");
    root.className = "yeyi-floating-root";
    root.dataset.yeyi = "1";

    const button = document.createElement("button");
    button.className = "yeyi-floating-ball";
    button.dataset.yeyi = "1";
    button.type = "button";
    button.title = "雅译：点击翻译当前页面";
    button.setAttribute("aria-label", "雅译：点击翻译当前页面");
    button.innerHTML = '<span class="yeyi-ball-text">译</span><span class="yeyi-ball-ring"></span>';
    button.addEventListener("click", () => {
      if (state.active) restorePage({ keepFloating: true, disableGlobal: true });
      else startTranslation({}).catch((error) => {
        state.error = error?.message || String(error);
        renderStatus();
      });
    });

    const menu = document.createElement("div");
    menu.className = "yeyi-floating-menu";
    menu.dataset.yeyi = "1";
    menu.innerHTML = `
      <button type="button" data-action="retry" hidden>重试失败段</button>
      <button type="button" data-action="context">上下文精翻</button>
      <button type="button" data-action="restore">恢复原文</button>
      <button type="button" data-action="mode">双语⇋替换</button>
      <button type="button" data-action="hide">隐藏本站悬浮球</button>
    `;
    menu.addEventListener("click", (event) => {
      const action = event.target?.dataset?.action;
      if (action === "retry") retryFailedUnits();
      if (action === "context") contextRefinePage().catch((error) => {
        state.error = error?.message || String(error);
        renderStatus();
      });
      if (action === "restore") restorePage({ keepFloating: true, disableGlobal: true });
      if (action === "mode") restartWithMode(state.mode === "bilingual" ? "replace" : "bilingual");
      if (action === "hide") hideFloatingForHost();
    });

    root.append(menu, button);
    document.documentElement.append(root);
    state.floatingRoot = root;
    state.floatingButton = button;
    state.floatingMenu = menu;
    state.floatingRetryBtn = menu.querySelector('[data-action="retry"]');
    state.floatingContextBtn = menu.querySelector('[data-action="context"]');
    updateFloatingBall();
  }

  function removeFloatingBall() {
    if (state.floatingRoot?.isConnected) state.floatingRoot.remove();
    state.floatingRoot = null;
    state.floatingButton = null;
    state.floatingMenu = null;
    state.floatingRetryBtn = null;
    state.floatingContextBtn = null;
  }

  function updateFloatingBall() {
    if (!state.floatingButton?.isConnected) return;
    const working = state.contextRefining || state.processing || state.pendingCount > 0 || state.queue.size > 0;
    const errorCount = countUnitsByStatus("error");
    const incomplete = state.active && state.totalCount > 0 && state.translatedCount + errorCount < state.totalCount;
    const stateName = state.error || (!working && (errorCount || incomplete)) ? "error" : working ? "working" : state.active ? "done" : "idle";
    if (state.floatingRetryBtn) state.floatingRetryBtn.hidden = !(state.active && errorCount > 0);
    if (state.floatingContextBtn) {
      state.floatingContextBtn.disabled = state.contextRefining || state.processing;
      state.floatingContextBtn.textContent = state.contextRefining ? "精翻中…" : "上下文精翻";
    }
    state.floatingButton.dataset.state = stateName;
    state.floatingButton.querySelector(".yeyi-ball-text").textContent = state.contextRefining ? "精" : state.active ? "原" : "译";
    const title = state.contextRefining ? "雅译：正在上下文精翻" : state.active ? "雅译：点击恢复原文" : "雅译：点击翻译当前页面";
    state.floatingButton.title = title;
    state.floatingButton.setAttribute("aria-label", title);
  }

  function publicStatus() {
    const errorCount = countUnitsByStatus("error");
    return {
      active: state.active,
      mode: state.mode,
      targetLanguage: state.targetLanguage,
      translatedCount: state.translatedCount,
      totalCount: state.totalCount,
      errorCount,
      skippedCount: state.skippedCount,
      pendingCount: state.pendingCount || (state.processing ? 1 : 0),
      queuedCount: state.queue.size,
      contextRefining: Boolean(state.contextRefining),
      error: state.error,
      startedAt: state.startedAt
    };
  }

  function countUnitsByStatus(status) {
    let count = 0;
    for (const record of state.units) {
      if (record.status === status) count += 1;
    }
    return count;
  }

  // ══════════════════════════ 过滤 & 辅助(沿用雅译) ══════════════════════════

  function passesTextFilter(text, targetLanguage) {
    const clean = normalizeText(text);
    if (clean.length < 2) return false;
    if (/^(https?:\/\/|www\.)\S+$/i.test(clean)) return false;
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) return false;
    if (/^[\d\s.,:%+\-–—()[\]/\\|#*_~"'`]+$/.test(clean)) return false;
    // 几乎全中文才跳过:中文占比高且英文残量可忽略(中英混排段不误杀)。
    if (isTargetChinese(targetLanguage)) {
      const ratio = cjkRatio(clean);
      const latinWords = (clean.match(/[A-Za-z]{2,}/g) || []).length;
      if (ratio > 0.72 && latinWords < 4) return false;
    }
    return true;
  }

  function updatePageTheme() {
    const style = window.getComputedStyle(document.body || document.documentElement);
    document.documentElement.dataset.yeyiTheme = isDarkColor(style.backgroundColor) ? "dark" : "light";
  }

  function isDarkColor(color) {
    const match = String(color).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/i);
    if (!match) return false;
    const alpha = match[4] === undefined ? 1 : Number(match[4]);
    if (alpha < 0.2) return false;
    const red = Number(match[1]);
    const green = Number(match[2]);
    const blue = Number(match[3]);
    return (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255 < 0.42;
  }

  function pageContext() {
    const description = document.querySelector('meta[name="description"],meta[property="og:description"]')?.content || "";
    const firstHeading = document.querySelector("h1");
    const outline = [...document.querySelectorAll("h1,h2,h3")]
      .map((heading) => ({
        level: heading.tagName,
        text: elementSourceText(heading).slice(0, 160)
      }))
      .filter((item) => item.text)
      .slice(0, 20);
    return {
      title: document.title || "",
      host: location.hostname || "",
      description: normalizeText(description).slice(0, 280),
      topicHint: (firstHeading ? elementSourceText(firstHeading) : normalizeText(document.title || "")).slice(0, 120),
      outline
    };
  }

  async function getContentSettings() {
    return sendRuntimeMessage({ type: "YEYI_GET_CONTENT_SETTINGS" });
  }

  async function setGlobalTranslate(enabled) {
    return sendRuntimeMessage({ type: "YEYI_SET_GLOBAL_TRANSLATE", enabled });
  }

  async function sendRuntimeMessage(message) {
    const result = await chrome.runtime.sendMessage(message);
    if (!result?.ok) throw new Error(result?.error || "请求失败。");
    return result.payload;
  }

  function matchesHost(host, list) {
    const cleanHost = String(host || "").toLowerCase();
    return (Array.isArray(list) ? list : []).some((pattern) => {
      const clean = String(pattern || "").toLowerCase();
      return clean && (cleanHost === clean || cleanHost.endsWith(`.${clean}`));
    });
  }

  function uniqueHosts(list) {
    return Array.from(new Set((Array.isArray(list) ? list : []).map((item) => String(item || "").trim().toLowerCase()).filter(Boolean)));
  }

  function requestIdle(callback) {
    if ("requestIdleCallback" in window) {
      requestIdleCallback(callback, { timeout: 1200 });
    } else {
      setTimeout(callback, 600);
    }
  }

  // CSS.escape 兜底:属性选择器里转义 walkId(旧浏览器无 CSS.escape 时降级)。
  function cssEscape(value) {
    if (window.CSS && typeof window.CSS.escape === "function") return window.CSS.escape(value);
    return String(value).replace(/["\\\]]/g, "\\$&");
  }

  function normalizeText(text) {
    return String(text || "").replace(/\s+/g, " ").trim();
  }

  function isTargetChinese(language) {
    return /中文|汉语|簡體|繁體|Chinese|zh/i.test(String(language || ""));
  }

  function hasCjk(text) {
    return /[㐀-鿿豈-﫿]/.test(String(text || ""));
  }

  function cjkRatio(text) {
    const compact = String(text || "").replace(/\s/g, "");
    if (!compact) return 0;
    const cjk = compact.match(/[㐀-鿿豈-﫿]/g)?.length || 0;
    return cjk / compact.length;
  }

  function shortHash(input) {
    let hash = 2166136261;
    const text = String(input);
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  }
})();
