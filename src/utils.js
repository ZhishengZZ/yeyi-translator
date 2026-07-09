// src/utils.js — 跨页面共享工具（popup / options / background 使用）
// content.js 因 classic script 限制无法 import，在内联副本顶部标注来源 = 此文件。
import { cleanHost, mergeSettings } from "./shared.js";

// 域名匹配：支持子域，cleanHost 已做协议/路径清理与小写化。
export function matchesHost(host, list) {
  const target = cleanHost(host);
  return (Array.isArray(list) ? list : []).some((pattern) => {
    const item = cleanHost(pattern);
    return item && (target === item || target.endsWith(`.${item}`));
  });
}

export function uniqueHosts(list) {
  return Array.from(new Set((Array.isArray(list) ? list : []).map(cleanHost).filter(Boolean)));
}

export function removeHost(list, host) {
  return (Array.isArray(list) ? list : []).filter((item) => !matchesHost(host, [item]));
}

export function withTimeout(promise, ms, message) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms))
  ]);
}

// 后台消息封装：统一超时与错误归一。预览环境（无 chrome.runtime）给兜底返回。
export async function runtime(message, timeoutMs = 3500) {
  if (!globalThis.chrome?.runtime?.sendMessage) {
    if (message?.type === "YEYI_GET_SETTINGS") return mergeSettings({});
    if (message?.type === "YEYI_SAVE_SETTINGS") return mergeSettings({ ...(message.settings || {}) });
    return {};
  }
  const response = await withTimeout(
    chrome.runtime.sendMessage(message),
    message?.type === "YEYI_TEST_PROVIDER" ? 65000 : timeoutMs,
    "后台暂未响应。"
  );
  if (!response?.ok) throw new Error(response?.error || "请求失败。");
  return response.payload;
}
