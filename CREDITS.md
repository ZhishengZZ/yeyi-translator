# Credits & Attribution / 署名与致谢

Yeyi (雅译) is released under the **GNU General Public License v3.0 (GPL-3.0)**.
Part of it is derived from another GPL-3.0 project. This file records that
relationship as the license requires.

雅译以 **GNU GPL v3.0** 开源。其中一部分派生自另一个 GPL-3.0 项目，本文件按
许可证要求记录这一关系。

---

## Derived from Read Frog / 引擎源自 Read Frog

The DOM translation engine in `src/content.js` (and the translated-shell styles
in `src/content.css`) was **ported and adapted from Read Frog**.

`src/content.js` 里的 DOM 翻译引擎（及 `src/content.css` 的译文外壳样式）
**移植并改编自 Read Frog**。

- Upstream / 上游项目: **Read Frog** — https://github.com/mengxi-ream/read-frog
- Website / 官网: https://readfrog.app
- Author / 作者: **mengxi-ream** and Read Frog contributors
- Upstream license / 上游许可证: **GNU GPL v3.0**

What was taken / 移植的内容:
- the "walk-and-label" paragraph & block detection approach / 「walk-and-label」段落与块检测思路
- block vs. inline node classification / 块级与行内节点分类
- wrapper-container handling that avoids duplicate translation blocks / 避免重复译块的包裹容器处理
- original-snapshot storage and restore semantics for replace mode / 替换模式的原文快照存取与还原语义

These parts were re-implemented in dependency-free native JavaScript for a
Manifest V3 extension. The ported sections are marked with in-code comments in
`src/content.js`.

以上部分在无第三方依赖的原生 JavaScript / MV3 环境里重新实现；`src/content.js`
中已用注释标出移植段落。

## Modifications (GPL-3.0 §5a) / 改动清单

This is a **modified work**. Changes on top of the Read Frog engine, in **July 2026**:

这是一个**修改后的作品**。在 Read Frog 引擎之上、于 **2026 年 7 月** 所做的改动：

- Reimplemented in plain native JS — no React, no build step, no third-party deps.
- Text-node clustering to the nearest "block owner" for arbitrary div/span nesting.
- Long-unit split tolerance + automatic per-segment re-translation for omitted / truncated parts.
- Six distinct translation-style presets, with `信达雅` (Xin-Da-Ya) as the signature default.
- Manual context-refinement second pass (page outline, heading path, neighbors, previous draft).
- Search-box Chinese→English suggestion helper.
- A Chrome Settings–style UI across popup / options / new tab, plus a native-style new tab page.
- Bring-your-own-key architecture: the API key stays in `chrome.storage.local` and never reaches the page.

Additional changes in **0.5.0 (July 2026)** / 0.5.0 追加改动:

- Translation now runs inside iframes (`all_frames` + `match_about_blank`); visible UI stays top-frame only. / 翻译进入 iframe,可视 UI 仅保留在顶层帧。
- Open Shadow DOM trees are walked, translated, restored, and observed for dynamic content — the shadow-root descent is ported from Read Frog's `utils/host/dom/traversal.ts` and `utils/host/translate/core/translation-walker.ts`. / open Shadow DOM 的下钻遍历移植自 Read Frog 上述两个文件。
- Translated-block styles (incl. keyframes) are injected into each shadow root, since page-level CSS cannot cross the shadow boundary (original work). / shadow root 内注入译块样式副本(原创实现)。

**Because of the above, the entire Yeyi project is licensed under GPL-3.0.** See `LICENSE`.

**正因如此，雅译整个项目以 GPL-3.0 开源。** 详见 `LICENSE`。

---

## Other references — no code copied / 其他参考——未复制代码

Studied only for product / architecture ideas; **no source code was copied** from these:
仅作产品/架构思路参考，**未复制任何源代码**：

Immersive Translate · Linguist · Traduzir-paginas-web · NextAI Translator ·
ChatGPT Chrome Translate Plugin · extension-summarize-translate-gemini ·
Translate-It · Kiss Translator. See `docs/SOURCES.md`.

## Translation-quality references / 翻译质量参考

严复「信、达、雅」(Yan Fu) · 奈达功能对等 (Eugene Nida, dynamic/functional
equivalence) · 以及机器翻译在习语/篇章上下文方面的若干论文。详见 `docs/SOURCES.md`。
