/**
 * 给 tsc 产物里的相对导入补全扩展名。
 *
 * 源码刻意不带扩展名（`from '../types'`），但编译成 ESM 后 Node 需要完整
 * 说明符。tsc 不会自动补，所以在这里用一次正则重写。
 *
 * 解析规则与 Node ESM 对齐：
 *   './types'        -> './types.js'
 *   './icons'        -> './icons/index.js'   （目录下的 index 文件）
 *   './types.js'     -> 保持不变
 *   'react'          -> 保持不变（裸模块）
 */

import fs from 'node:fs/promises';
import path from 'node:path';

/** 已经带扩展名、不需要补全的说明符。 */
const HAS_EXTENSION = /\.[a-z0-9]+$/i;

/** 匹配静态 import / export ... from 与动态 import()。 */
const SPECIFIER_PATTERNS = [
  /(\bfrom\s*['"])(\.{1,2}\/[^'"]*)(['"])/g,
  /(\bimport\s*\(\s*['"])(\.{1,2}\/[^'"]*)(['"]\s*\))/g,
];

const exists = async (file) => {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
};

/**
 * 把一个相对说明符解析成带扩展名的写法。
 * @param {string} specifier 原始说明符
 * @param {string} fileDir 当前文件所在目录
 * @param {string[]} extensions 候选产物扩展名，按顺序尝试
 */
const resolveSpecifier = async (specifier, fileDir, extensions) => {
  if (!specifier.startsWith('.') || HAS_EXTENSION.test(specifier)) {
    return specifier;
  }

  for (const extension of extensions) {
    if (await exists(path.resolve(fileDir, `${specifier}${extension}`))) {
      return `${specifier}${extension}`;
    }
  }

  for (const extension of extensions) {
    if (await exists(path.resolve(fileDir, specifier, `index${extension}`))) {
      return `${specifier}/index${extension}`;
    }
  }

  // 都不存在时保持原样，让人从构建结果里看出问题。
  return specifier;
};

const rewriteFile = async (file, extensions) => {
  const source = await fs.readFile(file, 'utf-8');
  const fileDir = path.dirname(file);
  let output = source;
  let changed = false;

  for (const pattern of SPECIFIER_PATTERNS) {
    // 每次替换后重新扫描：replace 会改变索引，先取快照再逐个处理。
    const matches = [...output.matchAll(pattern)];
    for (const match of matches) {
      const [, head, specifier, tail] = match;
      const resolved = await resolveSpecifier(specifier, fileDir, extensions);
      if (resolved === specifier) continue;
      const before = `${head}${specifier}${tail}`;
      if (!output.includes(before)) continue;
      output = output.replace(before, `${head}${resolved}${tail}`);
      changed = true;
    }
  }

  if (changed) await fs.writeFile(file, output, 'utf-8');
  return changed;
};

const walk = async (dir, extensions) => {
  const files = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(full, extensions)));
    } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
      files.push(full);
    }
  }
  return files;
};

/**
 * 递归重写目录下所有产物文件的相对导入。
 * @param {string} dir 产物目录
 * @param {string[]} extensions 候选模块扩展名，如 `['.js']` 或 `['.js', '.jsx']`
 * @returns {Promise<number>} 被改写的文件数
 */
export const fixEsmExtensions = async (dir, extensions = ['.js']) => {
  const files = await walk(dir, [...extensions, '.d.ts']);
  let rewritten = 0;

  for (const file of files) {
    // .d.ts 的 import 也需要可解析，但它引用的是同名 .js，规则一致。
    if (await rewriteFile(file, extensions)) rewritten += 1;
  }

  return rewritten;
};

export default fixEsmExtensions;
