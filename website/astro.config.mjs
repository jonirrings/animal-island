// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import svelte from '@astrojs/svelte';
import vue from '@astrojs/vue';

/**
 * Animal Island 图标站。
 *
 * 同时挂载 React / Vue / Svelte 三个运行时，用于逐框架验证图标包的运行状态。
 * Solid 暂缺官方集成（@astrojs/solid-js 尚未支持 Solid 2），页面上以占位说明呈现。
 *
 * 纯静态输出，直接部署到 Cloudflare Pages。
 */
export default defineConfig({
  integrations: [react(), vue(), svelte()],
  output: 'static',
  build: {
    // 936 个图标全部内联在 explorer 页，单页体积较大但 gzip 后约 80 KB
    inlineStylesheets: 'auto',
  },
  vite: {
    build: {
      // 图标数据是常量对象，不需要拆 chunk
      chunkSizeWarningLimit: 2048,
    },
  },
});
