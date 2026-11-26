# 图标站点规划

> **状态：已实施。** 站点就在本目录，使用 Astro 7 + naive-icons 视觉资产。
> 本文保留作为**选型依据与决策过程**的记录；日常开发与部署见同目录的
> [`README.md`](./README.md)。
>
> 实际采用的决定：站内 workspace、Astro 挂 3 个运行时 + Solid 占位、
> 单页 Explorer、双语切换、复刻 naive-icons 手绘风。
>
> 第 2～4 节是选型时的分析，仍然有效；第 5、6 节已改成实际结果。

## 1. 现状盘点（调研时）

> 下表是 2026-11-26 调研时的情况。站点已建成，实际结构见 [`README.md`](./README.md)。

| 项 | 现状 |
| --- | --- |
| 图标 | 936 个 SVG，48×48，多色插画 |
| 元数据 | 936 个 `icons/*.json`（`zh` 中文名 + `categories`） |
| 分类 | 20 个，含 `title` / `titleZh` / `description` / `icon` / `weight` |
| Schema | `icon.schema.json`、`category.schema.json`（draft 2020-12） |
| 框架包 | React / Vue / Svelte / Solid 四个，已可 `npm pack` |
| 站点骨架 | 调研时 `website/`、`apps/docs/` **只有空 package.json** |
| 上游参考 | `naive-icons/website`：445 行 HTML + 781 行原生 JS，零依赖（1.5 MB 目录主要是字体） |

分类分布（合计 936）：

```
interface 100  objects 109  media 77  food 66  places 54
devices   50   navigation 47  action 46  transport 45  animals 42
nature    40   health 40       communication 39  sports 39  emoji 39
tools     32   office 30       finance 26  dev 9  ai 6
```

## 2. 需求拆解：「同时展示 4 个框架的效果」有三种理解

这一句可以指向三件成本差异极大的事，必须先定下来。

**理解 A：页面上真的同时挂载 4 个框架运行时**

同一页里 React、Vue、Svelte、Solid 的组件各渲染一次，可以交互（调 size、
对比行为）。

**理解 B：展示统一的视觉结果 + 每个框架的引入代码**

图片只渲染一次（内联 SVG），旁边用 tab 切换该图标的
`import { Bear } from '@animal-island/react-icons'` 等四种写法。

**理解 C：只展示代码**

不渲染，纯文档。

### 关键事实：四个包的渲染输出逐字节一致

上一轮已验证（`compareIcon` 逐节点比对，8 个代表性图标 × 4 框架）：
React / Vue / Svelte / Solid 渲染出的 SVG 属性与源文件完全相同。

原因是四个包共享同一份 `{ name, viewBox, root, node }` 数据，差异只在渲染函数。
**所以理解 A 在视觉上不会比理解 B 多提供任何信息**，它证明的只是「每个包都能装
上并跑起来」，而这件事更适合由文档和可复制的代码片段来承担。

### 且理解 A 存在硬阻碍（见第 3 节）

## 3. 技术约束（均有实测证据）

### 3.1 Solid 2 尚无已发布的 Astro 集成 —— 理解 A 的主要障碍

**已发布版**（npm 上的 `@astrojs/solid-js@7.1.6`）：

```json
{ "solid-js": "^1.9.13", "solid-devtools": "^0.34.5" }   // peerDependencies
{ "vite-plugin-solid": "^2.11.15", ... }                      // dependencies
```

查了该包全部 **100 个稳定版**（7.0.2 → 7.1.6），peer 无一支持 Solid 2。

**main 分支**（`packages/integrations/solid/package.json`，版本号也写作 7.1.6）：

```json
{ "@solidjs/web": "^2.0.0", "solid-js": "^2.0.0" }          // peerDependencies
{ "@solidjs/vite-plugin": "^3.0.1", ... }                     // dependencies
```

同一个版本号、内容却完全不同 —— 说明 **main 上支持 Solid 2 的改动尚未发布**。
已经移到 Solid 2 的依赖栈（`@solidjs/vite-plugin@^3.0.1`、`@solidjs/web`），
与我们 `packages/icons/solid` 的配置一致，方向是对的。

但要注意三点：

1. 这是 **breaking change**（peer 从 Solid 1 改为 Solid 2），落地时会是一次 major
   bump，不是补丁版本。
2. 无法从 git 直接安装：Astro 是 monorepo，该子包依赖 `workspace:^` 协议，且会拆出
   `@astrojs/solid-js-renderer`。
3. 等待只能解锁「理解 A」（同页面挂载 4 个运行时），而本站并不需要它 —— 见第 2 节，
   四个包的渲染输出逐字节一致。

对照其余三个集成（均已发布且兼容）：

| 集成 | 已发布 latest | peer | 我们的包 |
| --- | --- | --- | --- |
| `@astrojs/react` | 7.1.9 | react 18/19 | ✅ |
| `@astrojs/vue` | 7.1.6 | vue 3.x | ✅ |
| `@astrojs/svelte` | 9.1.6 | svelte ^5.43.6 | ✅ |
| `@astrojs/solid-js` | 7.1.6 | solid-js **^1.9.13** | ❌ main 已支持，未发布 |

若坚持理解 A，Solid 部分只有三条路，都有明显代价：

1. 等 `@astrojs/solid-js` 发版 —— 方向已定（main 已改），但时间不可控；
   且是 major bump，可能需要同步升 Astro 大版本
2. 用 iframe 嵌入一个独立构建的 Solid 2 页面 —— 可行，但与主站割裂、切主题困难
3. 手写 vite 插件绕过 Astro 集成 —— 与 Astro 渲染管线冲突，风险高

**「再等等就行」是否成立？**

技术上成立 —— main 分支的 peer 已改为 `solid-js: ^2.0.0`，发布后即可直接使用。
但「等」不能解决下面这个瓶颈：

- 如果站点只需要展示「同一份视觉 + 四种引入代码」（理解 B），那就**不需要跑任何框架
  运行时**，今天就能做，不必等
- 如果确实要「理解 A」（同页挂载 4 个运行时），那么 3.2 的 vite override 问题在发布后
  依然存在，需要先单独解决

两个瓶颈叠加，等 Solid 2 集成只解除了其中一个。

### 3.2 workspace 的 vite override 会影响任何基于 vite 的站点框架

```yaml
# pnpm-workspace.yaml
catalog:
  vite: npm:@voidzero-dev/vite-plus-core@8.3.8001
overrides:
  vite@*: "catalog:"
```

`overrides` 是全局的，无法按包排除。这意味着 Astro / VitePress 依赖的 `vite`
会被强制换成 `@voidzero-dev/vite-plus-core`。

我验证过它是 vite 的兼容实现，核心 API 齐全：

```
build=function, createServer=function, defineConfig=function,
resolveConfig=function, mergeConfig=function
```

**但没验证 Astro 在它之上能否完整构建**。风险点在于 Astro 及其集成会用 vite 的
内部路径（`vite/dist/node/...`），而 vite-plus-core 的 `exports` 里没有这些子路径，
且它基于 rolldown 而非 rollup，SSG 打包行为可能有差异。

#### 已确认的部分

依赖解析阶段跑通了，`pnpm-lock.yaml` 里已经能看到 override 的结果：

```
'@astrojs/react':
  version: 7.1.9(...)(@voidzero-dev/vite-plus-core@8.3.8001(...))(react-dom@19.3.1...)
astro:
  version: 7.4.13(typescript@7.0.2)(yaml@2.9.1)
```

说明两件事：

1. **override 确实作用到了 Astro 及其集成**，它们拿到的是 vite-plus-core 而非 vite 8
2. **版本解析无冲突** —— 没有 peer 报错，依赖树能成立

这比调研时前进一步：已不是「不知道 override 会不会生效」，而是「生效了，且
解析通过」。但**解析通过不等于构建通过** —— 构建时才会真正调用 vite 的 API。

#### 最终结果：构建也通过了

`astro build` 实际执行成功。override 虽然生效（Astro 拿到的是 vite-plus-core），
但并未造成构建失败 —— 调研时担心的「内部路径缺失」与「rolldown 替代 rollup」
两个风险都没有变成实际障碍。

所以这条风险已解除，不需要为此调整 workspace 结构。

判定（事后）：**实际无影响**。调研时的判断偏保守。

### 3.3 Cloudflare Pages

静态站点不需要 `@astrojs/cloudflare` 适配器，设 build command + output dir 即可。
Astro 7 要求 Node `>= 22.23.4`，需在 Cloudflare 侧配 `NODE_VERSION` 或 `.nvmrc`。
纯静态方案无此约束。

## 4. 方案对比

| | A. 纯静态（复刻 naive-icons） | B. Astro SSG | C. VitePress |
| --- | --- | --- | --- |
| 依赖 | 零 | astro + 4 集成 | vitepress + vue |
| vite override 风险 | **无**（不用 vite） | 有，需先验证 | 有，需先验证 |
| 多框架运行时 | 不需要（理解 B） | Solid 2 受阻 | 同样受阻 |
| 936 图标浏览 | 单页 JS 过滤，已验证可行 | 内容集合，同样可行 | 不适合大量交互 |
| 每图标独立页（SEO） | 需手写生成脚本 | 内置 | 可行 |
| 文档（guide/migration） | 手写 HTML，较笨 | Markdown 内置 | Markdown 最强 |
| 构建速度 | 极快（拷文件） | 慢（936 页） | 中 |
| 上手成本 | 低（无框架） | 中 | 低（Vue 熟手） |
| 与 naive-icons 一致性 | **完全一致** | 视觉可仿，结构不同 | 差异大 |

## 5. 实际采用的方案

### 曾推荐纯静态，但需求变更了

调研阶段的建议是「阶段一：纯静态单页 explorer」，理由是完全绕开
3.1（Solid 集成）与 3.2（vite override）两个未知数，交付确定性最高。

但需求随后明确：**要真实验证四种运行时和四个图标库的运行状态**。
这是本文第 2 节所说的「理解 A」，纯静态方案做不到 —— 它不跑框架运行时，
只能展示内联 SVG 和代码片段。

于是改用 Astro。当时这意味着接受 3.2 的风险（vite override），换取真实挂载的能力。
后续构建成功证明这个风险没有兑现，详见 3.2 与第 7 节。

### 落地结果

| 项 | 实现 |
| --- | --- |
| 框架 | Astro 7 静态输出 |
| 运行时集成 | `@astrojs/react`、`@astrojs/vue`、`@astrojs/svelte` |
| Solid | **占位**，不挂载（3.1 未解除） |
| 形态 | 单页 Explorer，无独立图标页 |
| 语言 | 中英双语切换 |
| 视觉 | 复刻 naive-icons（LXGW Yozai 字体 + 原样式 token） |

实际结构：

```
website/
  astro.config.mjs        react / vue / svelte 三个集成
  scripts/build-data.mjs  936 SVG + 元数据 → src/data/icons.json
  public/fonts/           LXGW Yozai ×4 + Dynamix
  src/components/         ReactIcons.jsx / VueIcons.js / SvelteIcons.svelte
                          SolidPlaceholder.astro
  src/layouts/BaseLayout  顶栏、页脚（naive-icons 署名与导流）
  src/pages/index.astro   Hero + 安装 + Explorer + 运行时 + 弹窗
  src/scripts/site.js     语言/主题/搜索/筛选/弹窗/运行时切换
  src/styles/             naive.css（复刻）+ site.css
```

数据脚本用 Node 而非 Python：Cloudflare Pages 构建镜像只保证有 Node。

### Solid 占位的具体形态

Solid 标签页展示一段说明，内容包括：已发布版 `@astrojs/solid-js` 的 peer 仍为
`solid-js ^1.9.13`、上游 main 分支已改为 `^2.0.0` 但未发版、以及
`@animal-island/solid-icons` 本身可用（已通过 `@solidjs/vite-plugin` 编译与
SSR 渲染校验）。

待集成发布后的改动点：`astro.config.mjs` 加 `solid()`、`index.astro` 里把
`SolidPlaceholder` 换成真实组件。

## 6. 已确定的决策

调研时留下的五个待定项，实际答案：

1. **站点形态** → 单页 explorer
2. **每图标独立页** → 不做
3. **语言** → 中英双语切换
4. **视觉风格** → 复刻 naive-icons 手绘风（沿用其字体与样式 token）
5. **下载与导流** → 页脚署名并链接回 naive-icons 仓库；导出链接指向 npm 与
   仓库，具体域名待部署时确定

## 7. 验证情况

### 已通过

代码层面：Svelte 编译（client + server 两种模式）、Vue/React 语法、
双语文案对齐（41 键 × 2 语言）、936 图标数据完整性（分类引用、PascalCase 命名）。

依赖解析：`pnpm-lock.yaml` 已含网站全部依赖且无 peer 冲突。

**`astro build` 已成功** —— 这是建站时最大的未知数（见 3.2），现已解除：

- **override 并未阻断构建**。Astro 及其集成在拿到 `vite-plus-core` 而非 vite 8 的
  情况下，依然完成了静态构建。3.2 的担忧没有成立。
- Astro 把 vite 声明在 `dependencies`，所以全局 `overrides: vite@*` 确实作用到了它
  —— 生效了，但没造成问题。

因此不需要把 `website` 移出 workspace，也不需要收窄 `overrides`。

### 待部署时确认

- **Cloudflare Pages 的 Node 版本配置方式**（`NODE_VERSION` vs `.nvmrc`），
  需 `>= 22.23.4`
- 线上字体加载与主题切换的实际表现（本地构建通过不代表视觉上无瑕疵）

首页数据体积已实测，不是问题：

| | 原始 | gzip |
| --- | --- | --- |
| 本仓库 936 个 SVG | 453 KB | 81 KB |
| naive-icons 的 `icons.js`（含元数据） | 569 KB | 79 KB |

81 KB gzip 单文件直接内联即可，不需要分片或按需加载。
