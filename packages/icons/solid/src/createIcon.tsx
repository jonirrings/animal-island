import { For, omit, type Component } from 'solid-js';
import { Dynamic } from '@solidjs/web';

import type { IconData, IconNode, IconProps } from './types';

const LOCAL_PROP_KEYS = ['size', 'class', 'children'] as const;

const hasA11yProp = (props: Record<string, unknown>): boolean =>
  Object.entries(props).some(
    ([key, value]) =>
      (key.startsWith('aria-') || key === 'role' || key === 'title') && value != null,
  );

/** 递归渲染节点树。`Dynamic` 用来渲染 `g` / `path` 这类动态标签。 */
const IconNodes: Component<{ nodes: IconNode[] }> = (props) => (
  <For each={props.nodes}>
    {([tag, attributes, children]) => (
      <Dynamic component={tag} {...attributes}>
        {Array.isArray(children) ? <IconNodes nodes={children} /> : undefined}
      </Dynamic>
    )}
  </For>
);

/**
 * 用图标数据创建一个 Solid 2 组件。
 *
 * Solid 2 的 JSX 类型来自 `@solidjs/web`，属性按 DOM 原样 `setAttribute`，
 * 所以和 Vue 一样保持连字符写法。
 */
export function createIcon(icon: IconData): Component<IconProps> {
  const Icon: Component<IconProps> = (props) => {
    const rest = () => omit(props, ...LOCAL_PROP_KEYS);
    const size = () => props.size ?? 24;
    const hasA11y = () =>
      props.children != null || hasA11yProp(rest() as unknown as Record<string, unknown>);

    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox={icon.viewBox}
        width={size()}
        height={size()}
        {...icon.root}
        aria-hidden={hasA11y() ? undefined : 'true'}
        class={props.class}
        {...rest()}
      >
        <IconNodes nodes={icon.node} />
        {props.children}
      </svg>
    );
  };

  return Icon;
}
