# 发布说明

四个图标包发布到 npm 的 scope `@animal-island`：

| 包 | 框架 |
| --- | --- |
| `@animal-island/react-icons` | React 18+ |
| `@animal-island/vue-icons` | Vue 3.3+ |
| `@animal-island/svelte-icons` | Svelte 5 |
| `@animal-island/solid-icons` | Solid 2 |

## 产物形态

四个包都**只发布构建产物**（`files: ["dist"]`），不含 `src`、不含 `icons/*.svg`。
`dist` 由 `pnpm build:icons` 生成，不进 git。

| 包 | 产物 | 说明 |
| --- | --- | --- |
| react | `dist/*.js` + `.d.ts` | JSX 已编译成 `createElement` |
| vue | `dist/*.js` + `.d.ts` | 纯 `h()`，无 JSX |
| solid | `dist/*.js` / `*.jsx` + `.d.ts` | 保留 JSX（`jsx: preserve`），由消费方的 Solid 插件编译 |
| svelte | `dist/*.svelte` + `.svelte.d.ts` | 由 `svelte-package` 产出，消费方编译 |

源码里的 import 刻意不带扩展名（`from '../types'`）。编译成 ESM 后 Node 需要完整
说明符，所以构建末尾跑 `fix-esm-extensions` 补 `.js` / `.jsx` / `.svelte`。这一步
是必须的，删掉会导致 `ERR_MODULE_NOT_FOUND`。

## tsconfig 分层

每个包两份配置，职责分开：

| 文件 | 用途 | 特点 |
| --- | --- | --- |
| `tsconfig.json` | IDE / 编辑器 | `noEmit`，供 VSCode、WebStorm 等自动发现 |
| `tsconfig.build.json` | 构建与 typecheck | extends 前者，只管 emit |

两者都 extends 仓库共享的 `packages/tsconfig.json`，所以 `strict`、
`verbatimModuleSyntax`、`noUnusedLocals` 等规则只有一份。`build` 只覆盖
emit 相关的选项。

`target` / `lib` 刻意在 `tsconfig.build.json` 里重复声明为 `ES2020`，不继承开发
配置的 `ESNext`。这是发布产物的兼容性承诺，不应随开发配置漂移。

三个覆盖点，都来自实际报错：

- `allowImportingTsExtensions: false` —— 基础配置开了它，但它只在 `noEmit`
  时合法，直接 emit 会报 TS5096
- `rootDir: "src"` —— 不给会让产物落到 `dist/src/`（TS5011）
- `types: []` —— 基础配置带 `types: ["vitest/globals"]`，图标包没有测试，
  不该依赖 vitest。`svelte` 包例外，用 `types: ["svelte"]`，因为要注入
  svelte 的全局声明供 IDE 解析 `.svelte` 文件

`packages/icons/vue/src/createIcon.ts` 里有一处 `slots['default']` 而非
`slots.default` —— 基础配置开了 `noPropertyAccessFromIndexSignature`，
Vue 的 `Slots` 带索引签名，点号访问会被判为错误。

## 发布前检查

```sh
pnpm build:icons          # 生成 936×4 组件 + tsc 编译 + 补扩展名
pnpm typecheck:icons      # 四个包 tsc --noEmit
pnpm check:icons          # 图标数据与元数据校验
pnpm check:icons:exports  # exports / files 是否都指向真实文件
```

`check:icons:exports` 会把 `exports` 里的每个通配模式换成 `bear` 做样本，确认命中
真实文件。这类错误在发布后才会被消费者发现，所以在发布前拦一次。

试打包看内容（不发布）：

```sh
pnpm pack:icons           # 产物在仓库根的 .packs/
tar -tzf .packs/animal-island-react-icons-*.tgz | head
```

预期：约 3763 个文件（dist + `package.json` + `README.md` + `LICENSE`），
不含任何 `src/`。

## 发布

```sh
npm login                 # 需要 @animal-island scope 的发布权限
pnpm publish:icons        # 等价于 pnpm -r --filter "./packages/icons/*" publish --access public
```

`publishConfig.access: public` 已写在每个包里，scoped 包默认 restricted，这一项保证
是公开包。`prepack` 会先跑一次完整构建，因此即使忘了 `build:icons` 也不会发空包。

只发某一个：

```sh
pnpm --filter @animal-island/react-icons publish --access public
```

## 版本策略

四个包版本各自独立（当前都是 `1.0.0`），但图标集是同一份，建议同步升级：

```sh
pnpm -r --filter "./packages/icons/*" exec npm version patch --no-git-tag-version
```

`npm version` 不改 git tag（`--no-git-tag-version`），由发布者自己打 tag。

## 图标来源

图标来自 [naive-icons](https://github.com/guokaigdg/naive-icons)（MIT）。上游更新后：

```sh
pnpm sync:icons           # 看差异
pnpm sync:icons:apply     # 同步 SVG + 元数据
pnpm build:icons          # 重新构建
```

发布前建议跑一次 `pnpm sync:icons` 确认没有落后于上游。

## 常见问题

**`ERR_PNPM_GIT_UNCLEAN`**：pnpm publish 默认要求工作区干净。先提交改动，或加
`--no-git-checks`（不推荐，会跳过"待发布内容是否已提交"的检查）。

**`svelte-package` 报 TypeScript 7 不兼容**：`packages/icons/svelte` 固定用
`typescript ^6`，因为 `svelte2tsx` 的 d.ts 生成不支持 TS 7。其余三个包用 TS 7。

**tarball 里出现 `0.0.0` 的 devDependency**：`workspace:*` 在打包时会被替换成实际
版本号。devDependencies 不会被消费者安装，无实际影响。
