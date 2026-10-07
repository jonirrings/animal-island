import type { JSX } from '@solidjs/web';

/** 图标的紧凑节点表示：`[标签, 属性]`，有子元素时是 `[标签, 属性, 子节点列表]`。 */
export type IconNode =
  | [name: string, attributes: Record<string, string>]
  | [name: string, attributes: Record<string, string>, children: IconNode[]];

export interface IconData {
  name: string;
  viewBox: string;
  /** 根 `<svg>` 上的表现属性（fill / stroke / stroke-width / ...）。 */
  root: Record<string, string>;
  node: IconNode[];
}

export type IconProps = Partial<JSX.SvgSVGAttributes<SVGSVGElement>> & {
  /** 渲染尺寸（宽高一致），默认 24。 */
  size?: number | string;
  class?: string;
};
