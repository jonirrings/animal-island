#!/usr/bin/env node
/**
 * 生成站点数据：icons/*.svg + icons/*.json + categories/*.json
 *   → src/data/icons.json
 *
 * 为什么用 Node 而不是 Python：Cloudflare Pages 的构建镜像只保证有 Node，
 * 仓库里的 tools/build-icons/scripts/*.py 可以在本地跑，但不能作为部署前置。
 *
 * 输出结构：
 *   {
 *     total: 936,
 *     categories: [{ id, title, titleZh, description, icon, weight }],
 *     icons: [{ id, zh, comp, cat, svg }]
 *   }
 *
 * svg 已压缩（去换行与多余空白），页面直接内联注入。
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '../..');
const ICONS_DIR = path.join(REPO_ROOT, 'icons');
const CATEGORIES_DIR = path.join(REPO_ROOT, 'categories');
const OUT_FILE = path.join(HERE, '../src/data/icons.json');

const readJson = async (file) => JSON.parse(await fs.readFile(file, 'utf-8'));

/** kebab-case → PascalCase，与 build-icons 的组件命名保持一致。 */
const toPascal = (name) =>
  name
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');

/** 压缩 SVG：去掉换行与标记间的空白。 */
const compactSvg = (raw) =>
  raw
    .trim()
    .replace(/>\s+</g, '><')
    .replace(/\s{2,}/g, ' ')
    .replace(/\n/g, '');

const main = async () => {
  // ---- 分类
  const categoryFiles = (await fs.readdir(CATEGORIES_DIR)).filter((f) => f.endsWith('.json'));
  const categories = [];
  for (const file of categoryFiles) {
    const data = await readJson(path.join(CATEGORIES_DIR, file));
    categories.push({
      id: path.basename(file, '.json'),
      title: data.title,
      titleZh: data.titleZh,
      description: data.description,
      icon: data.icon,
      weight: data.weight,
    });
  }
  categories.sort((a, b) => a.weight - b.weight || a.id.localeCompare(b.id));

  const categoryIds = new Set(categories.map((c) => c.id));

  // ---- 图标
  const svgFiles = (await fs.readdir(ICONS_DIR)).filter((f) => f.endsWith('.svg'));
  const icons = [];
  const problems = [];

  for (const file of svgFiles) {
    const id = path.basename(file, '.svg');
    const svg = compactSvg(await fs.readFile(path.join(ICONS_DIR, file), 'utf-8'));

    const metaPath = path.join(ICONS_DIR, `${id}.json`);
    let meta;
    try {
      meta = await readJson(metaPath);
    } catch {
      problems.push(`${id}: 缺少 ${id}.json`);
      continue;
    }

    const cat = meta.categories?.[0];
    if (!cat) problems.push(`${id}: categories 为空`);
    else if (!categoryIds.has(cat)) problems.push(`${id}: 分类 ${cat} 不存在`);

    if (!meta.zh) problems.push(`${id}: 缺少 zh`);

    icons.push({ id, zh: meta.zh ?? id, comp: toPascal(id), cat, svg });
  }

  if (problems.length > 0) {
    console.error(`数据校验未通过（${problems.length} 项）：`);
    for (const problem of problems.slice(0, 20)) console.error(`  - ${problem}`);
    if (problems.length > 20) console.error(`  …还有 ${problems.length - 20} 项`);
    process.exitCode = 1;
    return;
  }

  icons.sort((a, b) => a.id.localeCompare(b.id));

  const payload = { total: icons.length, categories, icons };

  await fs.mkdir(path.dirname(OUT_FILE), { recursive: true });
  await fs.writeFile(OUT_FILE, `${JSON.stringify(payload)}\n`, 'utf-8');

  const sizeKb = (Buffer.byteLength(JSON.stringify(payload)) / 1024).toFixed(0);
  console.log(`站点数据：${icons.length} 个图标、${categories.length} 个分类 → ${sizeKb} KB`);
};

await main();
