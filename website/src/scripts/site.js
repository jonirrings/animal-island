/**
 * 站点交互：语言 / 主题 / 搜索 / 分类 / 尺寸 / 详情弹窗 / 运行时切换。
 *
 * 图标格子由 Astro 在构建时生成（内联 SVG），这里只做客户端筛选与弹窗，
 * 保证 936 枚图标首屏无需框架运行时即可浏览。
 */

import { messages, format } from '../i18n/messages.js';

const STORE_THEME = 'ai-theme';
const STORE_LANG = 'ai-lang';

const state = {
  lang: 'zh',
  q: '',
  cat: 'all',
  size: 55,
};

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const t = (key, params) => format(messages[state.lang][key] ?? key, params);

/* ------------------------------------------------------------ 语言 */
const applyLang = (lang, { persist = true } = {}) => {
  state.lang = lang;
  document.documentElement.lang = lang;
  if (persist) {
    try {
      localStorage.setItem(STORE_LANG, lang);
    } catch {}
  }

  for (const el of $$('[data-i18n]')) {
    // 运行时状态行挂载完成后已被实际数据接管，语言切换不应把它重置
    if (el.dataset.stateFilled) continue;
    const key = el.dataset.i18n;
    const text = messages[lang][key];
    if (text) el.textContent = text;
  }

  // 分类按钮的双语名
  for (const chip of $$('[data-cat-id]')) {
    const label = chip.querySelector('[data-cat-label]');
    if (!label) continue;
    label.textContent = lang === 'zh' ? chip.dataset.catZh || chip.dataset.catTitle : chip.dataset.catTitle;
  }

  const langLabel = $('[data-lang-label]');
  if (langLabel) langLabel.textContent = messages[lang]['lang.switch'];

  // 搜索框 placeholder
  const search = $('#iconSearch');
  if (search) search.placeholder = messages[lang]['explorer.search'];

  updateStatus();
  refreshModalText();
};

/* ------------------------------------------------------------ 主题 */
const applyTheme = (theme) => {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(STORE_THEME, theme);
  } catch {}
};

/* ------------------------------------------------------------ 筛选 */
const visibleCells = () => $$('.cell');

const matches = (cell) => {
  if (state.cat !== 'all' && cell.dataset.cat !== state.cat) return false;
  if (!state.q) return true;
  const q = state.q.toLowerCase();
  return (
    cell.dataset.id.toLowerCase().includes(q) ||
    (cell.dataset.zh || '').includes(state.q) ||
    (cell.dataset.comp || '').toLowerCase().includes(q)
  );
};

let shown = 0;

const updateStatus = () => {
  const el = $('#exploreStatus');
  if (!el) return;
  const total = Number(el.dataset.total || shown);
  el.textContent = t('explorer.status', { shown, total });
};

const filterGrid = () => {
  let count = 0;
  for (const cell of visibleCells()) {
    const ok = matches(cell);
    cell.hidden = !ok;
    if (ok) count += 1;
  }
  shown = count;
  const empty = $('#exploreEmpty');
  if (empty) empty.hidden = count !== 0;
  updateStatus();
};

/* ------------------------------------------------------------ 尺寸 */
const applySize = (size) => {
  state.size = size;
  const grid = $('#iconGrid');
  if (grid) grid.style.setProperty('--icon-size', `${size}px`);
  const out = $('#sizeOut');
  if (out) out.textContent = String(size);
};

/* ------------------------------------------------------------ 代码片段 */
const PKG = {
  react: '@animal-island/react-icons',
  vue: '@animal-island/vue-icons',
  svelte: '@animal-island/svelte-icons',
  solid: '@animal-island/solid-icons',
};

const snippet = (fw, comp, id) => {
  const pkg = PKG[fw];
  switch (fw) {
    case 'react':
      return `import { ${comp} } from '${pkg}';\n\n<${comp} size={48} />`;
    case 'vue':
      return `<script setup>\nimport { ${comp} } from '${pkg}';\n<\/script>\n\n<template>\n  <${comp} :size="48" />\n</template>`;
    case 'svelte':
      return `<script>\n  import { ${comp} } from '${pkg}';\n<\/script>\n\n<${comp} size={48} />`;
    case 'solid':
      return `import { ${comp} } from '${pkg}';\n\n<${comp} size={48} />`;
    case 'deep':
      return `// 只需一枚图标时，走子路径导入\nimport ${comp} from '${pkg}/icons/${id}';`;
    default:
      return '';
  }
};

/* ------------------------------------------------------------ 弹窗 */
let currentCell = null;
let currentTab = 'react';

const refreshModalText = () => {
  if (!currentCell) return;
  const code = $('#modalCode');
  if (code) code.textContent = snippet(currentTab, currentCell.dataset.comp, currentCell.dataset.id);
  const copyBtn = $('#modalCopy');
  if (copyBtn) copyBtn.textContent = t('modal.copy');
};

const openModal = (cell) => {
  currentCell = cell;
  const modal = $('#iconModal');
  if (!modal) return;

  const preview = $('#modalPreview');
  if (preview) preview.innerHTML = cell.querySelector('.cell__icon').innerHTML;

  const title = $('#modalTitle');
  if (title) title.textContent = cell.dataset.id;
  const sub = $('#modalSub');
  if (sub) sub.textContent = `${cell.dataset.zh || cell.dataset.id} · ${cell.dataset.catLabel || cell.dataset.cat}`;

  refreshModalText();
  modal.hidden = false;
  document.body.style.overflow = 'hidden';
};

const closeModal = () => {
  const modal = $('#iconModal');
  if (modal) modal.hidden = true;
  document.body.style.overflow = '';
  currentCell = null;
};

/* ------------------------------------------------------------ 复制 */
const toast = (msg) => {
  const el = $('#toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('toast--show');
  setTimeout(() => el.classList.remove('toast--show'), 1600);
};

const copyText = async (text, label) => {
  try {
    await navigator.clipboard.writeText(text);
    toast(`${label} ✓`);
  } catch {
    toast('复制失败');
  }
};

/* ------------------------------------------------------------ 运行时切换 */
const selectRuntime = (fw) => {
  for (const btn of $$('[data-runtime-btn]')) {
    const active = btn.dataset.runtimeBtn === fw;
    btn.setAttribute('aria-selected', String(active));
    if (active) btn.classList.add('is-active');
    else btn.classList.remove('is-active');
  }
  for (const panel of $$('[data-runtime-panel]')) {
    panel.hidden = panel.dataset.runtimePanel !== fw;
  }
};

/* ------------------------------------------------------------ 初始化 */
export const initSite = () => {
  // 语言
  try {
    const saved = localStorage.getItem(STORE_LANG);
    if (saved === 'en' || saved === 'zh') state.lang = saved;
  } catch {}
  applyLang(state.lang, { persist: false });

  $('#langToggle')?.addEventListener('click', () => {
    document.documentElement.dataset.switching = '1';
    applyLang(state.lang === 'zh' ? 'en' : 'zh');
    setTimeout(() => delete document.documentElement.dataset.switching, 120);
  });

  // 主题
  $('#themeToggle')?.addEventListener('click', () => {
    applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
  });

  // 搜索
  const search = $('#iconSearch');
  search?.addEventListener('input', () => {
    state.q = search.value.trim();
    filterGrid();
  });
  $('#searchClear')?.addEventListener('click', () => {
    if (search) search.value = '';
    state.q = '';
    filterGrid();
  });

  // 分类
  for (const chip of $$('[data-cat-id]')) {
    chip.addEventListener('click', () => {
      state.cat = chip.dataset.catId;
      for (const other of $$('[data-cat-id]')) other.classList.toggle('is-active', other === chip);
      filterGrid();
    });
  }

  // 尺寸
  const sizeInput = $('#sizeInput');
  sizeInput?.addEventListener('input', () => applySize(Number(sizeInput.value)));
  applySize(state.size);

  // 弹窗
  for (const cell of visibleCells()) {
    cell.addEventListener('click', () => openModal(cell));
    cell.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openModal(cell);
      }
    });
  }
  $('#modalClose')?.addEventListener('click', closeModal);
  $('#modalBackdrop')?.addEventListener('click', closeModal);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeModal();
  });

  // 代码 tab
  for (const btn of $$('[data-code-tab]')) {
    btn.addEventListener('click', () => {
      currentTab = btn.dataset.codeTab;
      for (const other of $$('[data-code-tab]')) {
        other.setAttribute('aria-selected', String(other === btn));
      }
      refreshModalText();
    });
  }
  $('#modalCopy')?.addEventListener('click', () => {
    if (currentCell) copyText($('#modalCode').textContent, t('modal.copied'));
  });

  // 运行时
  for (const btn of $$('[data-runtime-btn]')) {
    btn.addEventListener('click', () => selectRuntime(btn.dataset.runtimeBtn));
  }
  selectRuntime('react');

  // 首屏状态
  filterGrid();
};
