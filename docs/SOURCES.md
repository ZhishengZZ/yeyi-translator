# Sources

Checked on 2026-07-09.

## Official Sources

- DeepSeek API docs: https://api-docs.deepseek.com/
- DeepSeek Chat Completions: https://api-docs.deepseek.com/api/create-chat-completion
- DeepSeek Models and Pricing: https://api-docs.deepseek.com/quick_start/pricing
- Chrome extension permissions: https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions
- Chrome `activeTab`: https://developer.chrome.com/docs/extensions/develop/concepts/activeTab
- Chrome content scripts: https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts
- Chrome extension service worker lifecycle: https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle
- Chrome cross-origin requests: https://developer.chrome.com/docs/extensions/develop/concepts/network-requests

## Translation Theory and Quality References

- Yan Fu translation theory (`信、达、雅`): https://en.wikipedia.org/wiki/Yan_Fu
- Eugene Nida and dynamic/functional equivalence: https://en.wikipedia.org/wiki/Dynamic_and_formal_equivalence
- Nida, *The Theory and Practice of Translation* (closest natural equivalent principle): https://archive.org/details/theorypracticeof0000nida
- *A Stumble in the Pipeline: Is Machine Translation Getting It Right with Idioms?*: https://arxiv.org/abs/2210.04545
- *Improving Document-level Neural Machine Translation with Contextualized Word Representations*: https://arxiv.org/abs/1901.09115

## Code Derived From (GPL-3.0)

- **Read Frog**: https://github.com/mengxi-ream/read-frog (GPL-3.0). The DOM translation engine (`src/content.js`, `src/content.css`) was **ported and adapted** from this project. See `../CREDITS.md`. Because of this, Yeyi is licensed under GPL-3.0.

## GitHub References

These projects were used only as architecture/product references. No code was copied from the projects in this section.

- Immersive Translate public repo: https://github.com/immersive-translate/immersive-translate
  - Checked as a product reference. The public repo says it no longer contains source code, so the local plugin is a clean-room rewrite rather than a fork.
- Linguist: https://github.com/translate-tools/linguist
- Traduzir paginas web: https://github.com/FilipePS/Traduzir-paginas-web
- NextAI Translator: https://github.com/nextai-translator/nextai-translator
- ChatGPT Chrome Translate Plugin: https://github.com/raymondmars/chatgpt-chrome-translate-plugin
- Gemini/OpenAI-compatible summarize translate extension: https://github.com/sh2/extension-summarize-translate-gemini
- Translate-It: https://github.com/iSegaro/Translate-It
- Kiss Translator: https://github.com/fishjar/kiss-translator

## Implementation Decisions

- No model endpoint or API key is bundled. Users must configure their own OpenAI-compatible endpoint, model ID, and API Key.
- Thinking is disabled by default for translation speed and cleaner JSON.
- `response_format: { "type": "json_object" }` is used together with explicit JSON-only prompt instructions.
- Content script handles DOM only; background service worker handles API key, provider requests, cache, retries, and stats.
- `信达雅` remains the default signature style. Other styles are separated by explicit prompt boundaries so they differ in fidelity, natural Chinese rhythm, terminology handling, formality, and literary latitude.
- Manual context refinement uses page outline, heading path, neighboring paragraphs, and previous draft translations to reduce term drift, pronoun ambiguity, idiom literalism, and paragraph-level inconsistency.
