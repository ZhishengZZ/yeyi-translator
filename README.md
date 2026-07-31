<div align="center">

<img src="./src/assets/yeyi-icon-128.png" width="96" height="96" alt="Yeyi logo" />

# Yeyi · 雅译

**AI webpage translation you actually control — bring your own key, read anything, in your own words.**

[![License](https://img.shields.io/badge/License-GPLv3-4c8eda?style=flat-square)](./LICENSE)
[![Release](https://img.shields.io/badge/release-0.7.1-f0883e?style=flat-square)](https://github.com/ZhishengZZ/yeyi-translator/releases)
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

🧠 **Summarize first, then keep asking.**
AI page summary extracts the current page, produces an overview and key points, and supports follow-up questions grounded in that page. Answers safely render common Markdown such as bold text, lists, and inline code instead of exposing raw `**` markers. *(Opt-in.)*

🖱️ **Select-to-translate.**
Highlight any sentence and a small **译** bubble appears — one click shows the translation right there, in your chosen style, ready to copy. *(Opt-in.)*

🎭 **Six translation voices, not one.**
`信达雅` is the house style — faithful, fluent, and quietly elegant, shaped by Yan Fu and Nida's work on equivalence. Want a different register? Flip to **Precise**, **Natural**, **Technical**, **Business**, or **Literary** — each with its own rules for fidelity, tone, and terminology.

🧩 **An engine that doesn't drop text.**
Yeyi clusters every visible text node onto the block it really belongs to — and reaches into **iframes and open Shadow DOM** too — so deeply nested apps, docs sites, and reader pages get translated in full, with no skipped paragraphs and no duplicate blocks. Per-site rules handle the stubborn cases.

📖 **Bilingual by default, surgical on demand.**
Read the original and the translation side by side, or replace in place and restore with one click. Hit a dense passage? One tap runs a context-aware second pass using the page outline, headings, and neighboring paragraphs.

🔐 **Your key never leaves your browser.**
It lives in `chrome.storage.local`, is never injected into the page, and never shows up in an exported config.

## 🚀 Install

> Load it unpacked — no Web Store build yet.

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

The glossary is optional and empty by default. It enters prompts and cache keys only after you add content, avoiding unnecessary context usage. Add one term per line:

```text
prompt = 提示词
agent = 智能体
```

## 🧠 AI Page Summary

Enable AI page summary under **Settings -> Reading aids**, then open it from the extension to summarize the current page:

- Extracts the main page content and produces an overview, key points, and useful details.
- Supports follow-up questions in the same sidebar using the current page as context.
- Safely renders common Markdown, including bold text, lists, and inline code.
- Interacting inside the right-hand panel keeps it open; click the dimmed page area or the top-right `×` to close it.

This feature uses the model service configured in the extension and therefore consumes the corresponding API quota.

**0.7.1** - brings select-to-translate, AI page summary and Streaming Follow-Translate out of Labs as official features. Streaming Follow-Translate (off by default) keeps translating new content as you scroll infinite-feed sites like X/Twitter, with no re-clicking needed, idles down to save quota when scrolling stops, and ships with a built-in site rule for X (x.com). Existing page translation, new tab, AI summary, select-to-translate, context refinement and bilingual mode are unchanged. Still pre-1.0; issues and PRs are welcome.
