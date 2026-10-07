import { h, type FunctionalComponent, type VNode } from 'vue';

import type { IconData, IconNode, IconProps } from './types';

const hasA11yProp = (props: Record<string, unknown>): boolean =>
  Object.entries(props).some(
    ([key, value]) =>
      (key.startsWith('aria-') || key === 'role' || key === 'title') && value != null,
  );

const renderNodes = (nodes: IconNode[]): VNode[] =>
  nodes.map(([tag, attributes, children]) =>
    h(tag, attributes, Array.isArray(children) ? renderNodes(children) : undefined),
  );

/**
 * 用图标数据创建一个 Vue 3 函数组件。
 *
 * Vue 的 SVG 属性用连字符写法（`stroke-width`），所以数据可以原样透传，
 * 不像 React 那样需要转成 camelCase。
 */
export function createIcon(icon: IconData): FunctionalComponent<IconProps> {
  const Icon: FunctionalComponent<IconProps> = (props, { slots }) => {
    const { size = 24, class: className, ...rest } = props;
    const slotNodes = slots.default?.() ?? [];
    const hasA11y =
      slotNodes.length > 0 || hasA11yProp(rest as unknown as Record<string, unknown>);

    return h(
      'svg',
      {
        xmlns: 'http://www.w3.org/2000/svg',
        viewBox: icon.viewBox,
        width: size,
        height: size,
        ...icon.root,
        ...(hasA11y ? {} : { 'aria-hidden': 'true' }),
        class: className,
        ...rest,
      },
      [...renderNodes(icon.node), ...slotNodes],
    );
  };

  Icon.displayName = `${icon.name}Icon`;

  return Icon;
}
