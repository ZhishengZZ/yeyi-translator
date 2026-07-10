<div align="center">

<img src="./src/assets/yeyi-icon-128.png" width="96" height="96" alt="雅译" />

# 雅译 · Yeyi

**网页翻译，交给你自己的模型 —— 自带 Key、原地读全文、还讲究信达雅。**

[![License](https://img.shields.io/badge/许可证-GPLv3-4c8eda?style=flat-square)](./LICENSE)
[![Release](https://img.shields.io/badge/版本-0.6.0-f0883e?style=flat-square)](https://github.com/ZhishengZZ/yeyi-translator/releases)
[![Chrome MV3](https://img.shields.io/badge/Chrome-Manifest%20V3-3fb950?style=flat-square)](#-安装)
[![Dependencies](https://img.shields.io/badge/依赖-零-8957e5?style=flat-square)](#)

[English](./README.md) · **简体中文**

</div>

---

机翻常逼你二选一：要么被圈在别人家会偷偷上报的围墙里，要么装个插件却满屏漏译、还一股机器腔。**雅译**是第三条路——一个轻到几乎没存在感的 Chrome 扩展，接上*你自己的* OpenAI 兼容模型，在原页面上把整页干干净净地译好，连译文的味道都交到你手里，招牌的 `信达雅` 模式更是照着翻译理论一点点磨出来的。

不注册、不内置 Key、不上报数据。就你的模型、你的页面、你说了算。

## ✨ 凭什么值得装

🎛️ **像 Chrome 自带的，不像外挂。**
弹窗、设置页、新标签页都说着 Chrome 自己那套设计语言；新标签页干脆把原生 Google 搜索栏——语音、Lens、彩色 Logo、常用磁贴——照着复刻了一遍，没有一处看着是硬塞进去的。

🔎 **一个会替你说英文的搜索框。**
在新标签页搜索框里敲中文，雅译顺手递回一条地道的英文查询词，直接拿去搜。跨语言搜索，不打断手感。*（需手动开启。）*

🖱️ **划词即译。**
选中任意一句，旁边冒出一个 **译** 小气泡——点一下就地显示译文，按你选的风格来，还能一键复制。*（需手动开启。）*

🎭 **六种译笔，不止一种腔调。**
`信达雅` 是招牌——忠实、通顺、还带点雅致，底子是严复和奈达的对等理论。想换个味儿？**精准忠实 / 自然中文 / 技术文档 / 商务正式 / 文学润色** 随你切，每种在忠实度、语气和术语上都各有各的规矩。

🧩 **一个不漏字的引擎。**
雅译把每个可见文字都归到它真正所属的块上，还会钻进 **iframe 和 open Shadow DOM**——再深的套娃布局（React/Vue/Next 应用、文档站、小说阅读页）也能整段译全，不漏段、不重块。顽固站点交给站点规则收拾。

📖 **默认双语对照，难句还能再抠。**
原文译文并排读，或者原地替换、一键还原。碰上啃不动的长难句？点一下，就带着页面大纲、标题层级和前后段再精译一遍。

🔐 **你的 Key 不出浏览器。**
只存在 `chrome.storage.local`，不注入页面，导出配置里也翻不出来。

## 🚀 安装

> 暂无商店版，用「加载已解压的扩展程序」装。

1. 下载 [最新 Release 压缩包](https://github.com/ZhishengZZ/yeyi-translator/releases)（或克隆本仓库）。
2. 打开 `chrome://extensions/`，右上角开启**开发者模式**。
3. 点**加载已解压的扩展程序**，选中**直接含 `manifest.json` 的那层文件夹**。

## ⚙️ 配置

设置页里填三样：

| 项 | 填什么 |
| :-- | :-- |
| **接口地址** | 你的 OpenAI 兼容 base URL（可从 DeepSeek / Qwen / 混元 预设起步） |
| **模型名称** | 按服务商文档填 |
| **API Key** | 你自己的 Key——不内置、不导出 |

推荐默认：目标语言 **简体中文**、**双语对照**、并发 **4**、深度思考**关**（更快）。

术语表——每行一个，会一起进提示词和缓存键：

```text
prompt = 提示词
agent = 智能体
```

## 🎭 翻译风格

`信达雅` 保持默认。其余几档不是换了名字的同一套提示词——每一档在忠实度、中文节奏、术语稳定性、正式程度、以及给模型多少润色空间上，都划了硬边界。详见 [docs/PRODUCT.md](./docs/PRODUCT.md)。

## 🙏 署名与许可

雅译的 DOM 翻译引擎**移植并改编自 [Read Frog](https://github.com/mengxi-ream/read-frog)**（GPL-3.0）。因此**雅译整体以 GNU GPL v3.0 开源**——完整署名与改动清单见 [CREDITS.md](./CREDITS.md)，许可证全文见 [LICENSE](./LICENSE)。

特别感谢 **[@mengxi-ream](https://github.com/mengxi-ream)** 和 Read Frog 项目，雅译正是站在它的引擎之上。🐸

## 🧪 版本状态

**0.6.0** —— 日常阅读已相当完备（iframe 与 Shadow DOM 内翻译、站点规则、划词即译），但仍属 1.0 前版本。欢迎提 Issue 和 PR。
