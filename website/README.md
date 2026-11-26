# Animal Island 图标站

936 枚手绘图标的浏览器，同时挂载 React / Vue / Svelte 运行时验证各框架包的运行状态。

技术栈：Astro 7 静态构建 + naive-icons 的视觉资产（LXGW Yozai 字体、手绘风样式）。

选型过程、方案对比与技术约束见 [`WEBSITE_PLAN.md`](./WEBSITE_PLAN.md)。

## 本地开发

```sh
# 首次需要先生成图标组件（dist 不进 git）
pnpm build:icons

# 启动开发服务器
pnpm --filter @animal-island/website dev
```

`dev` / `build` 都会先跑 `scripts/build-data.mjs`，把 `icons/*.svg` +
`icons/*.json` + `categories/*.json` 合成 `src/data/icons.json`。

## 构建

```sh
pnpm --filter @animal-island/website build
```

产物在 `website/dist/`。

## 部署到 Cloudflare Pages

| 设置项 | 值 |
| --- | --- |
| 构建命令 | `pnpm install && pnpm build:icons && pnpm --filter @animal-island/website build` |
| 输出目录 | `website/dist` |
| Node 版本 | `22.23.4` 或更高（Astro 7 要求），在环境变量里设 `NODE_VERSION` |

注意构建命令里必须带 `pnpm build:icons` —— 图标包的 `dist` 不进 git，
新检出的仓库里没有这些文件，站点构建会失败。

## 结构

```
website/
  astro.config.mjs        三个框架集成（Solid 见下）
  scripts/build-data.mjs  SVG + 元数据 → src/data/icons.json
  public/fonts/           LXGW Yozai（SIL OFL 1.1）与 Dynamix
  src/
    components/           React / Vue / Svelte 图标挂载组件 + Solid 占位
    i18n/messages.js      中英双语文案
    layouts/BaseLayout    顶栏、页脚（含 naive-icons 署名与导流）
    pages/index.astro     Explorer + 运行时验证 + 详情弹窗
    scripts/site.js       语言/主题/搜索/筛选/弹窗/运行时切换
    styles/               naive.css（复刻） + site.css（本站补充）
```

## 关于 Solid

`@astrojs/solid-js` 已发布版本（7.1.6）的 peer 是 `solid-js ^1.9.13`，而本仓库的
`@animal-island/solid-icons` 面向 Solid 2。上游 main 分支已改为 `^2.0.0`，但尚未发版。

因此站点上 Solid 标签页是占位说明，不挂载运行时。Solid 图标包本身可用，已通过
`@solidjs/vite-plugin` 编译与 SSR 渲染校验。

待 `@astrojs/solid-js` 支持 Solid 2 后，把 `astro.config.mjs` 加上 `solid()` 集成，
并在 `index.astro` 里把 `SolidPlaceholder` 换成真实的 Solid 组件即可。

## 图标来源

全部图标设计与 SVG 来自 [Naive Icons](https://github.com/guokaigdg/naive-icons)，
MIT 许可。字体 LXGW Yozai 遵循 SIL OFL 1.1。本站仅做多框架封装与展示。
