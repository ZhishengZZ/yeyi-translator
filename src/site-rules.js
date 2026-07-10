// 内置站点规则(精简子集)。结构与语义对齐 read-frog 的
// utils/site-rules/built-in/rules.json(GPL-3.0,见 CREDITS.md):
//   matches / excludeMatches       — 网址匹配模式(支持 *;可带路径,如 "example.com/docs/*")
//   includeSelectors               — 白名单闸门:声明后只翻译命中区域内的段落
//   excludeSelectors               — 排除区域(命中 include 的子树会被重新纳入)
//   forceBlockSelectors / forceInlineSelectors — 强制块级/行内处理
//   minCharacters / minWords       — 忽略过短文本(minWords 只约束纯拉丁文本)
//   injectedCss                    — 翻译期间注入页面的 CSS(如放开 line-clamp 截断)
//
// 注:施工单原定 site-rules.json。改为 .js 模块是有意取舍——MV3 里 JSON 要么
// fetch + web_accessible_resources(暴露扩展指纹面)、要么 import attributes(兼容
// 风险),内置常量模块最稳且 background/options 都能直接 import。
// 用户自定义规则在设置页"站点规则"里以 JSON 数组填写,优先于内置规则生效。

export const BUILT_IN_SITE_RULES = [
  {
    id: "wikipedia",
    matches: ["*.wikipedia.org"],
    excludeSelectors: [
      ".mw-editsection",
      ".mw-cite-backlink",
      "#p-lang-btn",
      "#right-navigation",
      "#p-associated-pages",
      ".vector-header",
      ".lazy-image-placeholder"
    ],
    forceInlineSelectors: [".chemf", ".mwe-math-element", "[role=math]", ".nowrap"],
    minCharacters: 4,
    minWords: 2,
    injectedCss: ".mwe-popups-extract {max-height:unset!important;height:unset!important;}"
  },
  {
    id: "shopee",
    matches: ["seller.shopee.*", "shopee.*"],
    injectedCss: ".WBVL_7,.ellipsis-content {-webkit-line-clamp:unset!important;}"
  }
];
