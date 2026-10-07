// Svelte 5 的 ambient 声明：让 tsc 认识 `*.svelte` 的默认导出。
declare module '*.svelte' {
  import type { Component } from 'svelte';

  const component: Component<any>;
  export default component;
}
