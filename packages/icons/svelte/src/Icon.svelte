<script lang="ts">
  import IconNodes from './IconNodes.svelte';
  import type { IconData, IconProps } from './types';

  let {
    icon,
    size = 24,
    class: className,
    children,
    ...rest
  }: IconProps & { icon: IconData } = $props();

  const hasA11y = $derived(
    children != null ||
      Object.entries(rest).some(
        ([key, value]) =>
          (key.startsWith('aria-') || key === 'role' || key === 'title') && value != null,
      ),
  );
</script>

<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox={icon.viewBox}
  width={size}
  height={size}
  {...icon.root}
  aria-hidden={hasA11y ? undefined : 'true'}
  class={className}
  {...rest}
>
  <IconNodes nodes={icon.node} />
  {@render children?.()}
</svg>
