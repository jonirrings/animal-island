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
2. 新增 `icons/<name>.json` 元数据（见下节，`zh` + `categories` 必填）。
3. 跑 `pnpm build:icons`。
4. 生成器会校验：`viewBox` 是否存在、PascalCase 是否撞名、JSON 是否
   符合 schema、分类引用是否存在、SVG 与 JSON 是否一一对应。全部通过
   才会写文件；任何一项失败都不写。

## 元数据与 JSON Schema

参照 lucide 的做法，每个图标配一份同名 JSON，分类单独成文件：

```
icons/bear.svg          icons/bear.json              categories/animals.json
categories/*.json
icon.schema.json        category.schema.json
```

`icons/bear.json`：

```json
{
  "$schema": "../icon.schema.json",
  "zh": "小熊",
  "categories": ["animals"]
}
```

`categories/animals.json`：

```json
{
  "$schema": "../category.schema.json",
  "title": "Animals",
  "titleZh": "动物",
  "description": "动物、宠物、昆虫与海洋生物。",
  "icon": "bear",
  "weight": 70
}
```

两个 schema 都是 JSON Schema draft 2020-12，放在仓库根目录：

- `icon.schema.json`：`zh`（中文名）与 `categories`（分类 id 数组）必填，
  `tags` / `deprecated` / `deprecationReason` 可选；`additionalProperties:
  false`，多余字段直接报错；`deprecated` 必须与 `deprecationReason` 成对
  出现（`dependentRequired`）。
- `category.schema.json`：`title` / `titleZh` / `description` / `icon` /
  `weight` 全部必填；`icon` 必须属于本分类，`weight` 用于文档站排序。

校验器在 `src/validateSchema.mjs`，只实现这两个 schema 用到的 draft
2020-12 子集（`type` / `required` / `additionalProperties` / `items` /
`minLength` / `minItems` / `uniqueItems` / `pattern` / `const` / `enum` /
`dependentRequired` / `minimum`），不引第三方依赖。schema 是唯一真相源，
校验逻辑不重复描述字段。

`src/meta.mjs` 负责 schema 表达不了的那部分交叉校验：

- 每个 `.svg` 必须有同名 `.json`，反之亦然
- `categories` 里引用的分类必须在 `categories/` 下存在
- 分类的 `icon` 必须存在且归入该分类
- 不允许有分类一个图标都没有

## 从 naive-icons 同步元数据

分类与中文名原本写在 naive-icons 的 `scripts/build_website.py`
（`CATEGORIES` / `ICON_CATEGORY` / `ZH_NAMES`）。下面这个脚本直接 import
那个文件取真实数据，转成上述 JSON：

```sh
python3 tools/build-icons/scripts/import-naive-meta.py --source ../naive-icons
```

脚本幂等，会覆盖同名 JSON 并删除不再对应 SVG 的旧 JSON。分类的英文名、
描述、代表图标、排序权重写在脚本的 `CATEGORY_DETAILS` 里（naive-icons
只提供了 id 和中文名），新增分类时要同步补一条。

## 同步上游 SVG

上游（naive-icons）改完图标后，用 `sync-icons.py` 把 SVG 拉过来。默认只
报告不写文件：

```sh
# 看差异（dry-run）
pnpm sync:icons

# 实际同步（新增 + 更新，不删除）
pnpm sync:icons:apply
```

输出按三类分组，变更项带简短摘要：

```
共 936 个 SVG：新增 2、变更 1、删除 0、一致 933

新增（上游有、这里没有）（2）
  graph-path
  hole

变更（1）
  bear                         stroke="none" 0→3
```

### 三个开关

| 参数 | 作用 |
| --- | --- |
| `--write` | 实际落盘（不加则只报告） |
| `--prune` | 删除上游已不存在的 SVG。**默认不删**，因为这是唯一不可逆的操作 |
| `--check` | 有差异即退出 1，供 CI 检测“有没有落后于上游” |

删除项必须显式加 `--prune` 才会执行：

```sh
python3 tools/build-icons/scripts/sync-icons.py --source ../naive-icons --write --prune
```

不加 `--prune` 时，孤儿 SVG 会留在 `icons/`，导致元数据同步报“未分类”。
脚本会提示这一点。

### 上游规范守卫

同步前会逐个检查上游 SVG，不通过则**中止写入、不动任何文件**：

- 文件名必须是 kebab-case
- `viewBox` 必须是 `0 0 48 48`
- 根节点必须有 `fill` / `stroke` / `stroke-width` / `stroke-linecap` /
  `stroke-linejoin`
- 必须有子元素

这些字段会被四个框架的运行时直接使用（见「有意的差异」），上游偏离会
导致四处同时渲染异常，所以在入口拦住。

### 与元数据的关系

`--write` 后会自动调用 `import-naive-meta.py` 重建 `icons/*.json` 与
`categories/*.json`。**即使 SVG 一字节未变也会重建** —— 上游可能只改了
中文名或分类。跳过元数据用 `--no-meta`。

完整流程：

```sh
pnpm sync:icons          # 1. 看差异
pnpm sync:icons:apply    # 2. 同步 SVG + 元数据
pnpm build:icons         # 3. 重新生成四框架组件
pnpm check:icons         # 4. 校验（可选，build 时已做）
```

## 和 lucide 的对应关系

| lucide | 这里 |
| --- | --- |
| `tools/build-icons/render/renderIconsObject.ts` | `src/parseSvg.mjs` |
| `build-icons/cli.ts` + `building/generateIconFiles.ts` | `src/cli.mjs` |
| `packages/*/scripts/exportTemplate.mts` | `src/emit.mjs` 里的四个 emit 函数 |
| `packages/vue/src/Icon.ts` | `packages/icons/vue/src/createIcon.ts` |
| `packages/svelte/src/Icon.svelte` | `packages/icons/svelte/src/Icon.svelte` |
| `@lucide/shared` 的 icon node 类型 | 各包自己的 `types.ts` |
| `icons/*.json` + `icon.schema.json` | `icons/*.json` + `icon.schema.json` |
| `categories/*.json` + `category.schema.json` | `categories/*.json` + `category.schema.json` |
| `groups/*.json` + `$group:` / `$extends:` | 未实现（当前不需要继承与标签分组） |

## 有意的差异

- **保留根 `<svg>` 属性。** lucide 只取 `children`，因为它的图标统一是
  24×24、`stroke="currentColor"`、`stroke-width="2"`。Animal Island 是
  48×48 彩色插画，根上的 `fill` / `stroke` / `stroke-width` /
  `stroke-linecap` / `stroke-linejoin` 必须随数据下发给运行时，否则
  `link.svg`、`snowflake.svg`、`scooter.svg`、`unlink.svg` 会丢失描边。
- **不做单色语义。** 不提供 `color` / `strokeWidth` / `absoluteStrokeWidth`
  / `nonScalingStroke` 这些 prop，颜色写在 SVG 子元素上。
- **元数据 JSON 是必需的。** lucide 的 `getIconMetaData` 会无条件读取同名
  `.json`，缺失就抛 `TypeError`（且不受 `--withAliases` 控制）。这里同样
  强制要求：每个 SVG 必须有同名 JSON，`categories/` 不能为空，引用必须
  存在。好处是分类信息不会和图标集脱节；代价是新增图标必须同时写元数据。
- **不需要 `--renderUniqueKey`。** 实测 936 个图标最大嵌套只有 2 层
  （`g > path`），子元素无重复，不需要像 lucide 那样给子节点打 hash key。
- **属性大小写。** React 输出 camelCase（`strokeWidth`）；Vue / Svelte /
  Solid 保持连字符，因为这三种运行时按 DOM 原样 `setAttribute`。

## 默认值

- `size` 默认 24，`width` / `height` 跟随 `size`。
- 默认不设置 `aria-hidden` 的条件：存在 `aria-*` / `role` / `title`，或
  传入了子节点（Svelte 用 children snippet，React/Vue/Solid 用 children）。
  其余情况输出 `aria-hidden="true"`。
- `class` / `className` 透传；其余未知属性透传到根 `<svg>`，并可以覆盖
  根上的默认表现属性。
