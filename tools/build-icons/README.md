# @animal-island/build-icons

把 `icons/*.svg` 生成四个框架的图标组件。设计参考 lucide 的
`tools/build-icons`，但只保留当前图标集需要的部分，且不依赖 lucide 的包。

## 用法

四个图标包通过 workspace 依赖引入本工具，不写相对路径：

```json
"devDependencies": { "@animal-island/build-icons": "workspace:*" },
"scripts": { "build": "build-icons --targets=react" }
```

```sh
# 安装后才会创建 node_modules/.bin/build-icons
pnpm install

# 生成全部四个框架（根脚本，走 pnpm -r）
pnpm build:icons

# 只做数据校验，不写文件
pnpm check:icons

# 单个包
pnpm --filter @animal-island/react-icons build

# 直接调用（不依赖 cwd，输入输出路径都基于工具自身位置）
packages/icons/react/node_modules/.bin/build-icons --targets=react
```

CLI 参数的完整写法：

```sh
build-icons --targets=react,vue --input=icons --out-root=packages/icons
```

产物：

```
packages/icons/react/src/icons/*.ts     + index.ts
packages/icons/vue/src/icons/*.ts       + index.ts
packages/icons/svelte/src/icons/*.svelte + index.ts
packages/icons/solid/src/icons/*.ts     + index.ts
```

运行时组件（`createIcon.tsx` / `Icon.svelte` / `types.ts`）是手写源码，
生成器只覆盖 `src/icons/` 和 `src/index.ts`，不会碰它们。

## 生成物不入库

`src/icons/` 下的产物全部由生成器产出，不提交到 git（做法与 lucide 一致）：

- `.gitignore` 按后缀忽略：`packages/icons/*/src/icons/*.ts` 和 `*.svelte`
- 目录本身靠 `src/icons/.gitkeep` 保留，生成器清理时只删生成后缀，保留占位文件

代价是刚 clone 下来时 `src/icons/` 只有 `.gitkeep`，`src/index.ts` 里
`export * from './icons'` 会找不到目标。所以类型检查和测试前都必须先
`pnpm build:icons`。

## 新增图标

1. 把 SVG 放进 `icons/<name>.svg`，文件名用 kebab-case。
2. 跑 `pnpm build:icons`。
3. 生成器会校验 `viewBox` 是否存在、PascalCase 是否撞名，并把 iconData
   还原成 SVG 树与源文件逐节点比对；不一致会直接失败且不写文件。

## 和 lucide 的对应关系

| lucide | 这里 |
| --- | --- |
| `tools/build-icons/render/renderIconsObject.ts` | `src/parseSvg.mjs` |
| `build-icons/cli.ts` + `building/generateIconFiles.ts` | `src/cli.mjs` |
| `packages/*/scripts/exportTemplate.mts` | `src/emit.mjs` 里的四个 emit 函数 |
| `packages/vue/src/Icon.ts` | `packages/icons/vue/src/createIcon.ts` |
| `packages/svelte/src/Icon.svelte` | `packages/icons/svelte/src/Icon.svelte` |
| `@lucide/shared` 的 icon node 类型 | 各包自己的 `types.ts` |

## 有意的差异

- **保留根 `<svg>` 属性。** lucide 只取 `children`，因为它的图标统一是
  24×24、`stroke="currentColor"`、`stroke-width="2"`。Animal Island 是
  48×48 彩色插画，根上的 `fill` / `stroke` / `stroke-width` /
  `stroke-linecap` / `stroke-linejoin` 必须随数据下发给运行时，否则
  `link.svg`、`snowflake.svg`、`scooter.svg`、`unlink.svg` 会丢失描边。
- **不做单色语义。** 不提供 `color` / `strokeWidth` / `absoluteStrokeWidth`
  / `nonScalingStroke` 这些 prop，颜色写在 SVG 子元素上。
- **不需要元数据 json。** lucide 的 `getIconMetaData` 会无条件读取同名
  `.json`（缺失就抛错），这里没有 aliases / categories / groups 概念。
- **不需要 `--renderUniqueKey`。** 图标最大深度只有 2 层，子元素没有重复。
- **属性大小写。** React 输出 camelCase（`strokeWidth`）；Vue / Svelte /
  Solid 保持连字符，因为这三种运行时按 DOM 原样 `setAttribute`。

## 默认值

- `size` 默认 24，`width` / `height` 跟随 `size`。
- 默认不设置 `aria-hidden` 的条件：存在 `aria-*` / `role` / `title`，或
  传入了子节点（Svelte 用 children snippet，React/Vue/Solid 用 children）。
  其余情况输出 `aria-hidden="true"`。
- `class` / `className` 透传；其余未知属性透传到根 `<svg>`，并可以覆盖
  根上的默认表现属性。
