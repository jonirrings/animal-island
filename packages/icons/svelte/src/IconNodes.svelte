<script lang="ts">
  import Self from './IconNodes.svelte';
  import type { IconNode } from './types';

  let { nodes }: { nodes: IconNode[] } = $props();
</script>

{#each nodes as [tag, attributes, children]}
  <svelte:element this={tag} {...attributes}>
    {#if children && children.length > 0}
      <Self nodes={children} />
    {/if}
  </svelte:element>
{/each}
