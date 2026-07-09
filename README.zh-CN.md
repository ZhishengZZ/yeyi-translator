# 雅译 · Yeyi — Chrome AI 网页翻译扩展

[English](./README.md) | **简体中文**

![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)
![Version](https://img.shields.io/badge/version-0.4.0--preview-orange)
![Chrome MV3](https://img.shields.io/badge/Chrome-MV3-brightgreen)

雅译是一个轻量、开源的 Chrome AI 网页翻译扩展。你填自己的 OpenAI 兼容 API Key，
雅译就在网页里对文章、博客、文档做**段落级翻译**。

> **0.4.0 预览版。** 原生 JavaScript，Manifest V3，无构建步骤、无第三方依赖。

## 为什么用雅译

- **原生 Chrome 风格界面。** 弹窗、设置页、新标签页共用同一套 Chrome Settings
  设计语言——一致的字体、圆角、按钮、卡片与列表行。新标签页原生复刻了 Google
  搜索胶囊（语音 + Lens）、彩色 Google Logo 和常用磁贴，用起来像浏览器自带的
  一部分，而不是外挂面板。
- **能翻译的搜索框。** 在新标签页搜索框输入中文，雅译会给出可直接搜索的英文
  查询词——不离开搜索框就能跨语言搜索。（实验功能，需手动开启。）
- **六档精心区分的翻译风格。** `信达雅` 是招牌默认风格：忠实、通达、雅致，基于
  大量翻译理论资料打磨（严复「信达雅」、奈达功能对等）。另有 `精准忠实`、
  `自然中文`、`技术文档`、`商务正式`、`文学润色`，各自在忠实度、语气和术语
  边界上真正不同。
- **不漏字的引擎。** 0.4 把每个可见文本节点聚类到最近的「块拥有者」，任意
  div/span 深层套娃（React/Vue/Next 应用、文档站、新闻站）都能完整收录——不漏段，
  也不因包裹容器产生重复译块。
- **默认双语对照。** 原文 + 译文并排，或替换模式（按快照恢复原文）。译文里的
  链接依然可点。
- **按需上下文精翻。** 手动触发的二次校准，会把页面大纲、标题路径、前后段和
  上一版译文送去重译，专治难啃的专业长文、术语、指代和习语。
- **你的 Key，你的数据。** 不内置任何模型或 Key。API Key 只存在
  `chrome.storage.local`，不注入页面，导出配置也不含 Key。

## 安装（开发者模式）

1. 下载或克隆本仓库。
2. 打开 `chrome://extensions/`。
3. 开启**开发者模式**。
4. 点「**加载已解压的扩展程序**」→ 选本仓库文件夹（含 `manifest.json` 的那层）。

## 配置

打开设置页填写：

- **接口地址** — 你的 OpenAI 兼容 base URL（内置 DeepSeek、Qwen、混元等预设起步）
- **模型名称** — 按服务商文档填写
- **API Key** — 你的模型服务密钥（不内置、不导出）
- 推荐：目标语言 `简体中文`，默认 `双语对照`，并发 `4`，深度思考关闭（优先速度）。

术语表——每行一个——会进入提示词和缓存键：

```text
prompt = 提示词
agent = 智能体
```

## 翻译风格

`信达雅` 为默认招牌；其余风格用显式提示词边界隔开，在忠实度、中文读感、术语
稳定性、正式语体和文学节奏上真正区分。详见 [docs/PRODUCT.md](./docs/PRODUCT.md)。

## 署名与许可

雅译的 DOM 翻译引擎**移植并改编自 [Read Frog](https://github.com/mengxi-ream/read-frog)**
（GPL-3.0）。因此**雅译整体以 GNU GPL v3.0 开源**。完整署名与改动清单见
[CREDITS.md](./CREDITS.md)，许可证全文见 [LICENSE](./LICENSE)。

感谢 Read Frog 项目及其作者 **mengxi-ream** 提供的开源引擎。

## 状态

0.4.0 **预览版**——可用但属预发布，仍有毛边。欢迎提 Issue 和 PR。
