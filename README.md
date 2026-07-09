# Yeyi · 雅译 — AI Webpage Translation for Chrome

**English** | [简体中文](./README.zh-CN.md)

![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)
![Version](https://img.shields.io/badge/version-0.4.0--preview-orange)
![Chrome MV3](https://img.shields.io/badge/Chrome-MV3-brightgreen)

Yeyi (雅译) is a lightweight, open-source AI webpage-translation extension for
Chrome. You bring your own OpenAI-compatible API key; Yeyi translates ordinary
articles, blogs, and documentation **paragraph by paragraph, right in the page**.

> **0.4.0 preview.** Native JavaScript, Manifest V3, no build step, no third-party dependencies.

## Why Yeyi

- **Native Chrome-style UI.** The popup, options page, and new-tab page share one
  Chrome Settings design language — the same typography, radius, buttons, cards,
  and rows. The new-tab page faithfully recreates the native Google search capsule
  (voice + Lens), the colored Google logo, and your most-visited tiles. It feels
  like part of the browser, not a bolted-on panel.
- **A search box that translates.** Type Chinese in the new-tab search box and
  Yeyi suggests an English query you can drop straight into search — cross-language
  searching without leaving the box. (Experimental, opt-in.)
- **Six deliberate translation styles.** `信达雅` (Xin-Da-Ya) is the signature
  default — a faithful / expressive / elegant mode tuned from a lot of
  translation-theory research (Yan Fu; Nida's functional equivalence). Plus
  `精准忠实` (precise), `自然中文` (natural), `技术文档` (technical),
  `商务正式` (business), and `文学润色` (literary) — each with its own fidelity,
  tone, and terminology boundaries.
- **An engine that doesn't miss text.** 0.4 clusters every visible text node to
  its nearest "block owner", so deeply nested div/span structures (React/Vue/Next
  apps, docs sites, news) are fully collected — no missed paragraphs, and no
  duplicate blocks from wrapper containers.
- **Bilingual by default.** Original + translation side by side, or replace mode
  with snapshot restore. Links inside translations stay clickable.
- **Context refinement, on demand.** A manual second pass sends the page outline,
  heading path, neighboring paragraphs, and previous draft back to the model to
  re-calibrate hard professional text, terminology, pronouns, and idioms.
- **Your key, your data.** No model or key is bundled. Your API key lives in
  `chrome.storage.local`, is never injected into the page, and is never included
  in exported config.

## Install (unpacked)

1. Download or clone this repo.
2. Open `chrome://extensions/`.
3. Enable **Developer mode**.
4. **Load unpacked** → select the repo folder (the one containing `manifest.json`).

## Configure

Open the options page and fill in:

- **API endpoint** — your OpenAI-compatible base URL (presets for DeepSeek, Qwen, Hunyuan, … to start from)
- **Model** — per your provider's docs
- **API key** — your provider key (never bundled, never exported)
- Good defaults: target `简体中文`, display `双语对照` (bilingual), concurrency `4`, deep-thinking off (for speed).

Glossary — one term per line — is fed into the prompt and the cache key:

```text
prompt = 提示词
agent = 智能体
```

## Translation styles

`信达雅` stays the default signature style; the others are separated by explicit
prompt boundaries so they genuinely differ in fidelity, natural Chinese rhythm,
terminology stability, formality, and literary latitude. See
[docs/PRODUCT.md](./docs/PRODUCT.md).

## Credits & License

Yeyi's DOM translation engine is **ported and adapted from
[Read Frog](https://github.com/mengxi-ream/read-frog)** (GPL-3.0). Because of that,
**Yeyi as a whole is released under the GNU GPL v3.0**. Full attribution and the
list of modifications are in [CREDITS.md](./CREDITS.md); the license text is in
[LICENSE](./LICENSE).

Thanks to the Read Frog project and its author **mengxi-ream** for the open-source
engine Yeyi builds on.

## Status

**0.4.0 preview** — usable but pre-release; expect rough edges. Issues and PRs welcome.
