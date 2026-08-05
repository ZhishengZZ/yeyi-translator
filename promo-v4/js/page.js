const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];

const nav = $(".site-nav");
let navTicking = false;
function updateNav() {
  nav?.classList.toggle("is-scrolled", window.scrollY > 12);
  navTicking = false;
}
window.addEventListener("scroll", () => {
  if (navTicking) return;
  navTicking = true;
  requestAnimationFrame(updateNav);
}, { passive: true });
updateNav();

const toast = $("#toast");
let toastTimer;
function showToast(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 1600);
}
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast("已复制到剪贴板");
  } catch {
    showToast("已选中，可手动复制");
  }
}

const heroCopy = $("#hero-copy-demo");
const languageToggle = $("#hero-language");
languageToggle?.addEventListener("click", () => {
  const originalOnly = heroCopy?.classList.toggle("is-original") ?? false;
  languageToggle.setAttribute("aria-pressed", String(!originalOnly));
  languageToggle.textContent = originalOnly ? "EN" : "中 / EN";
});
$("#hero-replay")?.addEventListener("click", (event) => {
  if (!heroCopy) return;
  heroCopy.classList.add("is-original");
  event.currentTarget.textContent = "翻译中…";
  window.setTimeout(() => {
    heroCopy.classList.remove("is-original");
    event.currentTarget.textContent = "已完成";
    window.setTimeout(() => { event.currentTarget.textContent = "重译"; }, 900);
  }, 650);
});

const selectionResult = $("#selection-result");
$$('.selectable-text').forEach((button) => {
  button.addEventListener("click", () => {
    $$('.selectable-text').forEach((item) => item.classList.toggle("is-selected", item === button));
    if (selectionResult) selectionResult.textContent = button.dataset.translation || "";
  });
});
$("#copy-translation")?.addEventListener("click", () => copyText(selectionResult?.textContent || ""));

const summaries = {
  brief: {
    overview: "文章讨论了开放网络的价值：可链接、可验证、可由用户掌控，而不是被封闭平台替代。",
    points: ["链接让知识可以被追溯与组合", "开放标准降低了发布与访问门槛", "用户应拥有工具与数据的选择权"]
  },
  detail: {
    overview: "作者从链接机制、开放标准和用户自主权三个层面说明开放网络为何仍然重要，并指出封闭平台虽然便利，却会削弱内容的可迁移性和长期可访问性。",
    points: ["超链接建立了跨站点的知识关系，也让论据可以被复核", "HTML、URL 等开放标准允许任何人发布和访问内容", "本地优先工具让用户保留模型、数据与工作流的控制权", "设计应减少平台锁定，并保留导出和迁移路径"]
  }
};
let summaryDepth = "brief";
function renderSummary() {
  const output = $("#summary-output");
  if (!output) return;
  const data = summaries[summaryDepth];
  output.innerHTML = `<p class="summary-overview">${data.overview}</p><ul>${data.points.map((point) => `<li>${point}</li>`).join("")}</ul>`;
}
$$('.summary-depth').forEach((button) => button.addEventListener("click", () => {
  summaryDepth = button.dataset.depth || "brief";
  $$('.summary-depth').forEach((item) => item.classList.toggle("is-active", item === button));
  renderSummary();
}));
$("#generate-summary")?.addEventListener("click", (event) => {
  const output = $("#summary-output");
  if (!output) return;
  event.currentTarget.disabled = true;
  output.classList.add("is-loading");
  output.textContent = "✦ 正在阅读并整理这张网页…";
  window.setTimeout(() => {
    output.classList.remove("is-loading");
    renderSummary();
    event.currentTarget.disabled = false;
  }, 750);
});
$("#ask-form")?.addEventListener("submit", (event) => {
  event.preventDefault();
  const input = $("#ask-input");
  if (!input?.value.trim()) return;
  const output = $("#summary-output");
  if (output) {
    output.innerHTML = `<p class="summary-overview"><strong>根据当前网页：</strong>开放网络最关键的优势，是内容可以被链接、验证和迁移，用户不必把阅读与数据永久交给单一平台。</p>`;
  }
  input.value = "";
});

const feedVariants = [
  ["A translation should feel like part of the page, not an interruption.", "好的翻译应该像页面的一部分，而不是一次打断。"],
  ["Readers trust tools that explain what is happening.", "读者会更信任那些清楚说明当前状态的工具。"],
  ["The interface becomes calmer when every element has a clear job.", "当每个元素都有明确职责时，界面自然会更平静。"]
];
let feedIndex = 0;
const streamToggle = $("#stream-toggle");
$("#add-feed")?.addEventListener("click", (event) => {
  const trigger = event.currentTarget;
  const feed = $("#stream-feed");
  const status = $("#stream-status");
  if (!feed || !status) return;
  const [original, translated] = feedVariants[feedIndex % feedVariants.length];
  feedIndex += 1;
  const item = document.createElement("article");
  item.className = "feed-item is-translating";
  item.innerHTML = `<p>${original}</p><p class="feed-translation">正在翻译…</p>`;
  feed.append(item);
  item.scrollIntoView({ behavior: "smooth", block: "nearest" });
  if (!streamToggle?.checked) {
    status.textContent = "跟译已暂停，新内容保持原文";
    item.querySelector(".feed-translation")?.remove();
    return;
  }
  trigger.disabled = true;
  status.textContent = "发现新内容，正在翻译";
  window.setTimeout(() => {
    const translation = item.querySelector(".feed-translation");
    if (translation) translation.textContent = translated;
    item.classList.remove("is-translating");
    status.textContent = "翻译完成，继续监听";
    trigger.disabled = false;
  }, 650);
});
streamToggle?.addEventListener("change", () => {
  const status = $("#stream-status");
  if (status) status.textContent = streamToggle.checked ? "正在监听新内容" : "跟译已暂停";
});

const styleCopy = {
  elegant: "好的工具守护读者的注意力，而不喧宾夺主。",
  faithful: "好的工具会保护读者的注意力，同时不占据页面的主导位置。",
  natural: "好工具应该让人专心阅读，而不是抢走页面的存在感。",
  technical: "优质工具应保护读者的注意力资源，并避免干扰页面主体。",
  business: "优秀的工具应保障读者专注，同时避免影响页面主体内容。",
  literary: "真正好用的工具，只替你守住专注，不替页面喧哗。"
};
const styleTabs = $$(".style-tab");
const styleResult = $("#style-result");
function selectStyle(tab) {
  if (!tab || !styleResult) return;
  styleTabs.forEach((item) => {
    const active = item === tab;
    item.classList.toggle("is-active", active);
    item.setAttribute("aria-selected", String(active));
    item.tabIndex = active ? 0 : -1;
  });
  styleResult.classList.add("is-changing");
  window.setTimeout(() => {
    styleResult.textContent = styleCopy[tab.dataset.style] || styleCopy.elegant;
    styleResult.classList.remove("is-changing");
  }, 120);
}
styleTabs.forEach((tab, index) => {
  tab.addEventListener("click", () => selectStyle(tab));
  tab.addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    let next = index;
    if (event.key === "ArrowLeft") next = (index - 1 + styleTabs.length) % styleTabs.length;
    if (event.key === "ArrowRight") next = (index + 1) % styleTabs.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = styleTabs.length - 1;
    styleTabs[next].focus({ preventScroll: true });
    selectStyle(styleTabs[next]);
  });
});

const queryMap = {
  "网页可访问性设计": "web accessibility design patterns for readable interfaces",
  "浏览器扩展隐私设计": "privacy-first architecture for browser extensions",
  "双语阅读界面设计": "bilingual reading interface design best practices",
  "如何设计不打扰阅读的翻译工具": "designing unobtrusive translation tools for focused reading"
};
function generateQuery() {
  const input = $("#search-input");
  const result = $("#search-query");
  if (!input || !result) return;
  const value = input.value.trim();
  result.textContent = queryMap[value] || `${value || "focused reading"} · English research query`;
}
$("#search-form")?.addEventListener("submit", (event) => { event.preventDefault(); generateQuery(); });
$$('.search-tags button').forEach((button) => button.addEventListener("click", () => {
  const input = $("#search-input");
  if (input) input.value = button.dataset.query || "";
  generateQuery();
}));
$("#copy-query")?.addEventListener("click", () => copyText($("#search-query")?.textContent || ""));
