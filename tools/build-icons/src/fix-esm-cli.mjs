#!/usr/bin/env node
/**
 * 给构建产物补全 ESM 相对导入的扩展名。
 *
 *   node tools/build-icons/src/fix-esm-cli.mjs <dir> [ext...]
 *
 * 例：
 *   fix-esm-cli.mjs dist .js
 *   fix-esm-cli.mjs dist .js .jsx
 */

import path from 'node:path';

import { fixEsmExtensions } from './fixEsmExtensions.mjs';

const [dir, ...extensions] = process.argv.slice(2);

if (!dir) {
  console.error('用法：fix-esm-cli.mjs <dir> [ext...]');
  process.exitCode = 1;
} else {
  const target = path.resolve(process.cwd(), dir);
  const candidates = extensions.length > 0 ? extensions : ['.js'];
  const rewritten = await fixEsmExtensions(target, candidates);
  console.log(`补全导入扩展名：${rewritten} 个文件（${candidates.join(', ')}）`);
}
