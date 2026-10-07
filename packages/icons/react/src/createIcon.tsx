import { createElement, forwardRef, type ReactNode } from 'react';

import type { IconData, IconNode, IconProps } from './types';

/** SVG 在 React 里使用 camelCase 属性，如 `stroke-width` -> `strokeWidth`。 */
const toCamelCase = (key: string): string =>
  key.replace(/-([a-z])/g, (_, char: string) => char.toUpperCase());

const toReactAttributes = (attributes: Record<string, string>): Record<string, string> =>
  Object.fromEntries(
    Object.entries(attributes).map(([key, value]) => [toCamelCase(key), value]),
  );

const hasA11yProp = (props: Record<string, unknown>): boolean =>
  Object.entries(props).some(
    ([key, value]) =>
      (key.startsWith('aria-') || key === 'role' || key === 'title') && value != null,
  );

const renderNodes = (nodes: IconNode[], keyPrefix = 'icon'): ReactNode[] =>
  nodes.map(([tag, attributes, children], index) => {
    const key = `${keyPrefix}-${index}`;
    return createElement(
      tag,
      { key, ...toReactAttributes(attributes) },
      Array.isArray(children) ? renderNodes(children, key) : null,
    );
  });

/**
 * 用图标数据创建一个 React 组件。
 *
 * 和 lucide 一致：每个图标文件只保存数据，渲染逻辑集中在 `Icon`。
 * 区别在于根属性（viewBox / fill / stroke / stroke-width）由数据携带，
 * 因为 Animal Island 的图标是 48×48 的彩色插画，不是单色描边。
 */
export function createIcon(icon: IconData) {
  const Icon = forwardRef<SVGSVGElement, IconProps>(function IconComponent(
    { size = 24, className, children, ...rest },
    ref,
  ) {
    const hasA11y =
      children != null || hasA11yProp(rest as unknown as Record<string, unknown>);

    return createElement(
      'svg',
      {
        ref,
        xmlns: 'http://www.w3.org/2000/svg',
        viewBox: icon.viewBox,
        width: size,
        height: size,
        ...toReactAttributes(icon.root),
        ...(hasA11y ? {} : { 'aria-hidden': 'true' }),
        className,
        ...rest,
      },
      [...renderNodes(icon.node), children],
    );
  });

  Icon.displayName = `${icon.name}Icon`;

  return Icon;
}
