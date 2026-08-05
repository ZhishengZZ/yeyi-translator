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
    showToast("复制失败，请手动选择文字");
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
    overview: "文章介绍了睡眠如何帮助大脑整理和巩固记忆，并解释了规律作息为何比临时补觉更有效。",
    points: ["深度睡眠有助于稳定新形成的记忆", "快速眼动睡眠参与情绪与经验的整合", "固定作息比周末集中补觉更可靠"]
  },
  detail: {
    overview: "作者从记忆形成、情绪调节和生物钟三个方面说明睡眠的重要性，并指出稳定的睡眠节律比偶尔延长睡眠时间更能支持长期记忆。",
    points: ["深度睡眠帮助大脑重新整理当天接收的信息", "快速眼动睡眠会把新经验与既有记忆联系起来", "睡眠不足会削弱注意力，使学习效率下降", "固定起床时间有助于维持稳定的睡眠节律"]
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
  output.textContent = "✦ 正在阅读并整理当前网页…";
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
    output.innerHTML = `<p class="summary-overview"><strong>根据这篇文章：</strong>睡眠不只是休息，大脑会在不同睡眠阶段整理新信息、连接已有经验，并稳定刚刚形成的记忆。</p>`;
  }
  input.value = "";
});

const feedVariants = [
  ["Small routines are easier to keep when they have a clear place in the day.", "一件小事在每天都有固定位置时，更容易长期坚持。"],
  ["Quiet spaces can restore attention more effectively than constant stimulation.", "安静的空间比持续不断的刺激更能恢复注意力。"],
  ["Good rest begins before bedtime, with the way the day is arranged.", "真正的休息在入睡前就已经开始，它取决于一天如何安排。"]
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
    status.textContent = "跟译已暂停，新内容保留原文";
    item.querySelector(".feed-translation")?.remove();
    return;
  }
  trigger.disabled = true;
  status.textContent = "正在翻译新内容";
  window.setTimeout(() => {
    const translation = item.querySelector(".feed-translation");
    if (translation) translation.textContent = translated;
    item.classList.remove("is-translating");
    status.textContent = "新内容已翻译";
    trigger.disabled = false;
  }, 650);
});
streamToggle?.addEventListener("change", () => {
  const status = $("#stream-status");
  if (status) status.textContent = streamToggle.checked ? "跟译已开启" : "跟译已暂停";
});

const styleCopy = {
  elegant: "雨意柔化了城市，每一盏街灯都化作静静的倒影。",
  faithful: "雨水让城市显得柔和，并让每一盏街灯都变成安静的倒影。",
  natural: "一场雨让城市柔和下来，街灯映在水面上，安安静静。",
  technical: "降雨降低了城市景观的视觉锐度，使各处街灯形成清晰的反射影像。",
  business: "雨后城市氛围更显柔和，街灯倒影为夜间景观增添了宁静感。",
  literary: "雨把城市轻轻放低，每一盏街灯，都在水中沉默地亮着。"
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
  "如何提高睡眠质量": "evidence-based ways to improve sleep quality",
  "睡眠与记忆的关系": "relationship between sleep and memory consolidation",
  "适合新手的城市徒步路线": "beginner-friendly urban walking routes",
  "家庭咖啡烘焙方法": "home coffee roasting methods and techniques"
};
function generateQuery() {
  const input = $("#search-input");
  const result = $("#search-query");
  if (!input || !result) return;
  const value = input.value.trim();
  result.textContent = queryMap[value] || `English sources and research about ${value || "focused reading"}`;
}
$("#search-form")?.addEventListener("submit", (event) => { event.preventDefault(); generateQuery(); });
$$('.search-tags button').forEach((button) => button.addEventListener("click", () => {
  const input = $("#search-input");
  if (input) input.value = button.dataset.query || "";
  generateQuery();
}));
$("#copy-query")?.addEventListener("click", () => copyText($("#search-query")?.textContent || ""));
