# @animal-island/solid-icons

[Naive Icons](https://github.com/guokaigdg/naive-icons) 的 Solid 2 封装 —— 936 枚手绘
naive folk art 风格图标，48×48 画布，多色插画。

图标设计与 SVG 版权归 **Naive Icons**（MIT）。本包负责把它们转成 Solid 组件并按
框架打包分发，组件代码同样以 MIT 发布。

## 安装

```sh
pnpm add @animal-island/solid-icons
# 或 npm install / yarn add / bun add
```

`solid-js >= 2.0.0-rc.0` 与 `@solidjs/web` 是 peer 依赖。Solid 1 请改用其他包。

## 用法

```tsx
import { Bear, MapPin } from '@animal-island/solid-icons';

export const Demo = () => (
  <>
    <Bear size={48} />
    <MapPin size={32} class="text-accent" />
  </>
);
```

按需深层导入（只需一个图标时更省）：

```tsx
import Bear from '@animal-island/solid-icons/icons/bear';
```

## 必须使用 Solid 工具链

本包的 `dist` 保留 JSX（`jsx: preserve`），这是 Solid 库的标准分发方式 —— Solid
的响应式转换只能由 Solid 自己的编译器完成，无法预先编译成通用 JS。请确保构建链
使用 `@solidjs/vite-plugin`（或等价的 `babel-preset-solid`）并启用 `solid`
导出条件：

```ts
// vite.config.ts
import solid from '@solidjs/vite-plugin';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [solid()],
});
```

## Props

| 名称 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `size` | `number \| string` | `24` | 宽高等值。图标原始画布是 48×48，传 48 可得到 1:1 像素 |
| `class` | `string` | — | 透传到根 `<svg>` |
| `children` | `JSX.Element` | — | 追加到 `<svg>` 末尾，可用于加 `<title>` |

其余属性透传到根 `<svg>`，可覆盖根上的 `fill` / `stroke` 等默认值。

可访问性：未传 `aria-*` / `role` / `title` / 子节点时，自动加上
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
