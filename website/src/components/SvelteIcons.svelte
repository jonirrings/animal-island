<script>
  import { onMount } from 'svelte';
  import * as Icons from '@animal-island/svelte-icons';

  let { names = [], size = 48 } = $props();

  let host = $state(null);
  const started = performance.now();

  // Svelte 5 用 runes，动态组件直接写成 <Comp /> 变量形式
  const resolved = $derived(names.map((name) => ({ name, Icon: Icons[name] })));

  onMount(() => {
    const elapsed = Math.round(performance.now() - started);
    if (host) {
      host.dataset.mountMs = String(elapsed);
      host.dataset.rendered = String(names.length);
      host.dataset.status = `mounted ${names.length} icons in ${elapsed}ms`;
    }
  });
</script>

<div class="rt-grid" bind:this={host}>
  {#each resolved as { name, Icon }}
    {#if Icon}
      <div class="rt-cell" title={name}>
        <Icon {size} />
        <span>{name}</span>
      </div>
    {:else}
      <div class="rt-missing">{name}</div>
    {/if}
  {/each}
</div>
