import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");

const checks = [
  {
    file: "src/popup.html",
    mustInclude: ["雅译", "翻译此页", "双语", "替换", "本站自动翻译"],
    mustNotInclude: ["Translate page", ">Restore<", ">Settings<", "Current page", "Target language"]
  },
  {
    file: "src/options.html",
    mustInclude: ["雅译设置", "模型服务", "翻译偏好", "速度与并发", "实验室功能", "搜索框中译英", "测试连接", "已保存"],
    mustNotInclude: ["Yeyi Settings", "Model service", "Translation preferences", "Performance", "Test connection"]
  },
  {
    file: "src/popup.js",
    mustInclude: ["正在翻译", "已翻译", "请先配置 API Key"],
    mustNotInclude: ["Translating", "Translated", "Configure API key"]
  },
  {
    file: "src/options.js",
    mustInclude: ["正在测试连接", "连接成功", "配置已导出"],
    mustNotInclude: ["Testing connection", "Connection OK", "Config exported"]
  },
  {
    file: "src/content.js",
    mustInclude: ["雅译：点击翻译当前页面", "雅译正在翻译", "当前网站已加入永不翻译列表"],
    mustNotInclude: ["Yeyi is translating", "Restore</button>", "never-translate list"]
  },
  {
    file: "src/shared.js",
    mustInclude: ['targetLanguage: "简体中文"', 'sourceLanguage: "自动检测"', 'mode: "bilingual"'],
    mustNotInclude: ['targetLanguage: "Chinese (Simplified)"', 'mode: "replace"']
  }
];

const failures = [];

for (const check of checks) {
  const text = await readFile(resolve(root, check.file), "utf8");
  for (const expected of check.mustInclude) {
    if (!text.includes(expected)) {
      failures.push(`${check.file} 缺少：${expected}`);
    }
  }
  for (const forbidden of check.mustNotInclude) {
    if (text.includes(forbidden)) {
      failures.push(`${check.file} 仍包含英文旧文案：${forbidden}`);
    }
  }
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("UI Chinese/default-experience checks passed.");
