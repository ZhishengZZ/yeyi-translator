# Yeyi Product Plan

## Positioning

Yeyi is a lightweight AI webpage translation extension for readers who want high-control translation with their own provider key. The product-grade target is stable, paragraph-level translation of ordinary articles, blogs, documentation, and long-read pages.

The product design and UI are original. The DOM translation engine, however, is **ported and adapted from Read Frog** (https://github.com/mengxi-ream/read-frog, GPL-3.0) — see `../CREDITS.md`. Because of that, Yeyi as a whole is licensed under GPL-3.0. Yeyi does not copy branding, UI, or paid behavior from existing products.

## 0.2 Scope

- MV3 extension with native JavaScript only.
- Paragraph-level translation units instead of text-node fragments.
- Bilingual-first reading experience, with replace mode still available.
- Inline placeholder protocol for links, emphasis, and inline code.
- IntersectionObserver scheduling with MutationObserver for dynamic content.
- Provider calls only from the service worker; content script receives no API Key.
- Concurrent background translation requests with throttled local cache persistence.
- Site rules wired end to end: default, always translate, never translate.
- Compact popup, single-column options page, and a right-edge floating ball.
- Experimental search-box Chinese-to-English helper, isolated from the page translation flow.
- Chinese UI copy and local smoke checks.

## 0.4 Scope (Translation completion · usability · Settings-style search page)

- Text-node clustering collection: every visible text node is grouped to its nearest block owner, so arbitrary div/span nesting (React/Vue/Next, docs, news sites) is fully collected while pure wrapper containers produce no duplicate blocks.
- Long-unit split tolerance: assemble whatever sentence parts returned instead of blanking a whole paragraph on a single dropped part; auto per-segment re-translation for omitted ids and for truncation (finish_reason=length); default maxTokens raised to 8000.
- Non-CJK and mixed CN/EN paragraphs are no longer silently discarded; only echo/empty counts as "no translation needed" and is reported separately.
- Free-tier throughput: fewer, larger batches with an honest "rate-limited, queuing" status instead of pretending completion.
- Failure visibility: enlarged retry hit-area plus one-click "retry failed segments" from the popup and the floating-ball menu.
- Floating ball is fully visible at the bottom-right, no longer pushed half off-screen.
- Popup, options, and new tab search use one Chrome Settings-style UI system: matching typography, radius, buttons, cards, and list rows. The new tab page keeps Google search, voice, Lens, topSites tiles, and an optional omnibox-style Chinese-to-English suggestion.
- Translation style presets are intentionally distinct: `信达雅` remains the default signature mode; `自然中文` prioritizes native Chinese web-reading rhythm; precise, technical, business, and literary modes have separate terminology, tone, and rewriting boundaries.
- Manual context refinement adds a second-pass path for difficult professional text. It is never auto-enabled; the popup and floating menu trigger a batch that sends page outline, neighboring paragraphs, heading path, and previous translation as calibration context.

## Acceptance Criteria

- Chrome can load the folder as an unpacked MV3 extension.
- Missing API key is handled clearly and routes to settings.
- DeepSeek connection can be tested from options.
- Ordinary webpages translate by paragraph, not by text-node fragments.
- Bilingual mode inserts one translation block per paragraph unit.
- Links in translated paragraphs remain clickable.
- Replace mode can restore original DOM snapshots.
- Chinese paragraphs are skipped when target language is Chinese.
- Search-box helper only runs when the experimental option is enabled and does not mutate page text.
- Buttons, inputs, editable areas, code blocks, and hidden content are skipped.
- Dynamic content added after page load is collected automatically.
- Content nested inside div/span wrappers is collected and translated, with no duplicate block from the outer wrapper.
- A long unit split into ordered parts still shows the assembled translation when some parts are missing.
- The new tab page renders the colored Google logo image, the native search capsule (mic/Lens, no blue arrow), and topSites tiles.
- Translation failures do not destroy source page content.
- API Key is not injected into the page DOM and is not exported in config.
- Context refinement preserves the existing translation if the provider omits a refined segment.

## Later Ideas

- IndexedDB cache with TTL and larger quota handling.
- Provider profiles for DeepSeek, OpenRouter, Ollama, Gemini-compatible proxies, and local endpoints.
- Cost estimates using provider pricing settings.
- PDF, OCR, subtitles, or hover translation are out of the 0.2 scope.
