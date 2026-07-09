// 主题引擎：auto 跟随系统，light/dark 手动锁定。各页面读 settings.theme 后调 applyTheme。
const VALID_THEMES = ["auto", "light", "dark"];
let currentTheme = "auto";
let mediaQuery = null;

export function applyTheme(theme) {
  currentTheme = VALID_THEMES.includes(theme) ? theme : "auto";
  paint();
  if (currentTheme === "auto") attachMedia();
  else detachMedia();
}

// 三态循环：auto → light → dark → auto，给切换按钮用。
export function nextTheme(theme) {
  if (theme === "auto") return "light";
  if (theme === "light") return "dark";
  return "auto";
}

export function themeLabel(theme) {
  if (theme === "light") return "浅色";
  if (theme === "dark") return "暗色";
  return "跟随系统";
}

function paint() {
  document.documentElement.dataset.theme = resolve();
}

function resolve() {
  if (currentTheme === "light" || currentTheme === "dark") return currentTheme;
  return prefersDark() ? "dark" : "light";
}

function prefersDark() {
  return globalThis.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

function attachMedia() {
  if (mediaQuery || !globalThis.matchMedia) return;
  mediaQuery = matchMedia("(prefers-color-scheme: dark)");
  mediaQuery.addEventListener?.("change", paint);
}

function detachMedia() {
  if (!mediaQuery) return;
  mediaQuery.removeEventListener?.("change", paint);
  mediaQuery = null;
}
