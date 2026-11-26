# @animal-island/svelte-icons

[Naive Icons](https://github.com/guokaigdg/naive-icons) 的 Svelte 5 封装 —— 936 枚手绘
naive folk art 风格图标，48×48 画布，多色插画。

图标设计与 SVG 版权归 **Naive Icons**（MIT）。本包负责把它们转成 Svelte 组件并按
框架打包分发，组件代码同样以 MIT 发布。

## 安装

```sh
pnpm add @animal-island/svelte-icons
# 或 npm install / yarn add / bun add
```

`svelte >= 5` 是 peer 依赖（Svelte 4 不支持，因为组件用了 runes 与 snippets）。

## 用法

```svelte
<script>
  import { Bear, MapPin } from '@animal-island/svelte-icons';
</script>

<Bear size={48} />
<MapPin size={32} class="text-accent" />
```

按需深层导入（只需一个图标时更省）：

```svelte
<script>
  import Bear from '@animal-island/svelte-icons/icons/bear';
</script>
```

## Props

| 名称 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `size` | `number \| string` | `24` | 宽高等值。图标原始画布是 48×48，传 48 可得到 1:1 像素 |
| `class` | `string` | — | 透传到根 `<svg>` |
| `children` | `Snippet` | — | 追加到 `<svg>` 末尾，可用于加 `<title>` |

其余属性透传到根 `<svg>`，可覆盖根上的 `fill` / `stroke` 等默认值。

可访问性：未传 `aria-*` / `role` / `title` / 子 snippet 时，自动加上
`aria-hidden="true"`；否则交给调用方负责。

## 图标是彩色的

每个图标自带配色（`fill="#8B5E3C"` 之类），不是 lucide 那种 `currentColor`
单色描边。因此本包**不提供** `color` / `strokeWidth` 这类 prop —— 颜色是图标本身
的组成部分。

## 分类与元数据

936 枚图标分 20 类，中文名与分类在仓库的 `icons/*.json` 与 `categories/*.json`
中，schema 见 `icon.schema.json`。

## 许可

MIT，见 [LICENSE](./LICENSE)。图标来源与版权：[Naive Icons](https://github.com/guokaigdg/naive-icons)。
