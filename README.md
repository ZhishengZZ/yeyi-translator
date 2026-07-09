<div align="center">

<img src="./src/assets/yeyi-icon-128.png" width="96" height="96" alt="Yeyi logo" />

# Yeyi · 雅译

**AI webpage translation you actually control — bring your own key, read anything, in your own words.**

[![License](https://img.shields.io/badge/License-GPLv3-4c8eda?style=flat-square)](./LICENSE)
[![Release](https://img.shields.io/badge/release-0.4.0--preview-f0883e?style=flat-square)](https://github.com/ZhishengZZ/yeyi-translator/releases)
[![Chrome MV3](https://img.shields.io/badge/Chrome-Manifest%20V3-3fb950?style=flat-square)](#-install)
[![Dependencies](https://img.shields.io/badge/dependencies-zero-8957e5?style=flat-square)](#)

**English** · [简体中文](./README.zh-CN.md)

</div>

---

Machine translation usually forces a choice: a walled garden that phones home, or a browser add-on that drops half the paragraphs and reads like a robot. **Yeyi** is the third option — a featherweight Chrome extension that plugs into *your* OpenAI-compatible model, translates whole pages cleanly in place, and hands you the dial on *how* the translation reads, right down to a `信达雅` mode built from real translation theory.

No account. No bundled key. No telemetry. Just your model, your page, your call.

## ✨ Why you'll like it

🎛️ **It feels like Chrome, not a plugin.**
The popup, options, and new-tab page all speak Chrome's own design language. The new tab even rebuilds the native Google search bar — voice, Lens, the colored logo, your most-visited tiles — so nothing looks bolted on.

🔎 **A search box that speaks English for you.**
Type Chinese into the new-tab search box and Yeyi hands back a clean English query to search with. Cross-language search without breaking your stride. *(Opt-in.)*

🎭 **Six translation voices, not one.**
`信达雅` is the house style — faithful, fluent, and quietly elegant, shaped by Yan Fu and Nida's work on equivalence. Want a different register? Flip to **Precise**, **Natural**, **Technical**, **Business**, or **Literary** — each with its own rules for fidelity, tone, and terminology.

🧩 **An engine that doesn't drop text.**
Yeyi clusters every visible text node onto the block it really belongs to, so deeply nested layouts (React/Vue/Next apps, docs sites, news) get translated in full — no skipped paragraphs, no duplicate blocks spat out by wrapper `<div>`s.

📖 **Bilingual by default, surgical on demand.**
Read the original and the translation side by side, or replace in place and restore with one click. Hit a dense passage? One tap runs a context-aware second pass using the page outline, headings, and neighboring paragraphs.

🔐 **Your key never leaves your browser.**
It lives in `chrome.storage.local`, is never injected into the page, and never shows up in an exported config.

## 🚀 Install

> Preview build — load it unpacked.

1. Grab the [latest release zip](https://github.com/ZhishengZZ/yeyi-translator/releases) (or clone this repo).
2. Open `chrome://extensions/` and switch on **Developer mode** (top-right).
3. Click **Load unpacked** and choose the folder that directly contains **`manifest.json`**.

## ⚙️ Configure

Open the options page and fill in three things:

| Field | What to enter |
| :-- | :-- |
| **Endpoint** | Your OpenAI-compatible base URL (DeepSeek / Qwen / Hunyuan presets to start from) |
| **Model** | Whatever your provider lists |
| **API key** | Your key — never bundled, never exported |

Good defaults: target **简体中文**, **bilingual** display, concurrency **4**, deep-thinking **off** for speed.

Glossary — one term per line, fed into both the prompt and the cache key:

```text
prompt = 提示词
agent = 智能体
```

## 🎭 Translation styles

`信达雅` stays the default. The rest aren't just relabeled prompts — each draws a hard line on fidelity, natural rhythm, terminology, formality, and how much literary latitude the model gets. Full breakdown in [docs/PRODUCT.md](./docs/PRODUCT.md).

## 🙏 Credits & License

Yeyi's DOM translation engine is **ported and adapted from [Read Frog](https://github.com/mengxi-ream/read-frog)** (GPL-3.0). Because of that, **Yeyi is released under the GNU GPL v3.0** — full attribution and the list of changes are in [CREDITS.md](./CREDITS.md), and the license text is in [LICENSE](./LICENSE).

Big thanks to **[@mengxi-ream](https://github.com/mengxi-ream)** and the Read Frog project for the engine Yeyi stands on. 🐸

## 🧪 Status

**0.4.0 · preview** — real and usable, still pre-release, so expect a few rough edges. Issues and PRs welcome.
