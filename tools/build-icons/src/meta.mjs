import fs from 'node:fs/promises';
import path from 'node:path';

import { validateSchema } from './validateSchema.mjs';

const readJson = async (file) => JSON.parse(await fs.readFile(file, 'utf-8'));

const listJson = async (dir) => {
  let entries;
  try {
    entries = await fs.readdir(dir);
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
  return entries.filter((entry) => entry.endsWith('.json'));
};

/**
 * 读取并校验图标元数据。
 *
 * 校验分两层：
 * 1. 每个 JSON 是否符合 icon.schema.json / category.schema.json
 * 2. JSON、SVG、分类之间是否一一对应（schema 表达不了的部分）
 *
 * @param {string} repoRoot 仓库根目录
 * @param {string} iconsDir 存放 SVG 的目录
 * @returns {Promise<{ categories: object[], icons: Map<string, object>, problems: string[] }>}
 */
export const loadMeta = async (repoRoot, iconsDir) => {
  const problems = [];
  const categoryDir = path.join(repoRoot, 'categories');

  const [iconSchema, categorySchema] = await Promise.all([
    readJson(path.join(repoRoot, 'icon.schema.json')),
    readJson(path.join(repoRoot, 'category.schema.json')),
  ]);

  // ---- 分类
  const categoryFiles = await listJson(categoryDir);
  const categories = [];
  for (const file of categoryFiles.sort()) {
    const id = path.basename(file, '.json');
    const filePath = path.join(categoryDir, file);
    const data = await readJson(filePath);
    const errors = validateSchema(data, categorySchema, id);
    if (errors.length > 0) {
      problems.push(...errors.map((error) => `categories/${file}: ${error}`));
      continue;
    }
    categories.push({ id, ...data });
  }

  if (categories.length === 0) {
    problems.push('categories/ 下没有可用的分类 JSON。');
  }

  const categoryById = new Map(categories.map((category) => [category.id, category]));

  // ---- 图标
  const svgNames = new Set(
    (await fs.readdir(iconsDir)).filter((entry) => entry.endsWith('.svg')).map((entry) => path.basename(entry, '.svg')),
  );
  const jsonNames = new Set(
    (await listJson(iconsDir)).map((entry) => path.basename(entry, '.json')),
  );

  for (const name of svgNames) {
    if (!jsonNames.has(name)) problems.push(`icons/${name}.svg 缺少同名 JSON 元数据。`);
  }
  for (const name of jsonNames) {
    if (!svgNames.has(name)) problems.push(`icons/${name}.json 没有对应的 SVG。`);
  }

  const icons = new Map();
  for (const name of [...jsonNames].sort()) {
    if (!svgNames.has(name)) continue;
    const filePath = path.join(iconsDir, `${name}.json`);
    const data = await readJson(filePath);
    const errors = validateSchema(data, iconSchema, name);
    if (errors.length > 0) {
      problems.push(...errors.map((error) => `icons/${name}.json: ${error}`));
      continue;
    }
    for (const categoryId of data.categories) {
      if (!categoryById.has(categoryId)) {
        problems.push(`icons/${name}.json: 引用了不存在的分类 ${categoryId}`);
      }
    }
    icons.set(name, data);
  }

  // ---- 分类的代表图标必须存在且归属本分类
  for (const category of categories) {
    const iconMeta = icons.get(category.icon);
    if (!iconMeta) {
      problems.push(`categories/${category.id}.json: 代表图标 ${category.icon} 不存在。`);
      continue;
    }
    if (!iconMeta.categories.includes(category.id)) {
      problems.push(
        `categories/${category.id}.json: 代表图标 ${category.icon} 未归入本分类（实际 ${iconMeta.categories.join(', ')}）。`,
      );
    }
  }

  // ---- 不允许有分类没有任何图标
  const usedCategories = new Set();
  for (const meta of icons.values()) {
    for (const categoryId of meta.categories) usedCategories.add(categoryId);
  }
  for (const category of categories) {
    if (!usedCategories.has(category.id)) {
      problems.push(`categories/${category.id}.json: 没有任何图标使用该分类。`);
    }
  }

  categories.sort((a, b) => a.weight - b.weight || a.id.localeCompare(b.id));

  return { categories, icons, problems };
};

export default loadMeta;
