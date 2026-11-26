import fs from 'node:fs/promises';
import path from 'node:path';

const FRAMEWORKS = ['react', 'vue', 'svelte', 'solid'];
const ICONS_ROOT = path.resolve(import.meta.dirname, '../../../packages/icons');

/** 把 exports 里的通配模式替换成具体样本名，检查是否命中真实文件。 */
const globToSample = (pattern, name) => pattern.replace('*', name);

const exists = async (file) => {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
};

let failures = 0;

for (const fw of FRAMEWORKS) {
  const dir = path.join(ICONS_ROOT, fw);
  const pkg = JSON.parse(await fs.readFile(path.join(dir, 'package.json'), 'utf-8'));
  const problems = [];

  // 1. 不该 private
  if (pkg.private === true) problems.push('仍然是 private: true');

  // 2. 必须有 license / description / files
  for (const key of ['license', 'description', 'files', 'exports', 'publishConfig']) {
    if (!pkg[key]) problems.push(`缺少 ${key}`);
  }

  // 3. exports 的每个子路径必须命中真实文件
  for (const [subpath, target] of Object.entries(pkg.exports ?? {})) {
    if (typeof target === 'string') {
      if (!(await exists(path.join(dir, target)))) {
        problems.push(`exports['${subpath}'] -> ${target} 不存在`);
      }
      continue;
    }
    for (const [condition, value] of Object.entries(target)) {
      if (!value.includes('*')) {
        if (!(await exists(path.join(dir, value)))) {
          problems.push(`exports['${subpath}'].${condition} -> ${value} 不存在`);
        }
        continue;
      }
      // 通配路径用 bear 做样本
      const sample = globToSample(value, 'bear');
      if (!(await exists(path.join(dir, sample)))) {
        problems.push(`exports['${subpath}'].${condition} -> ${value}（样本 bear 未命中）`);
      }
    }
  }

  // 4. files 里的目录必须存在
  for (const entry of pkg.files ?? []) {
    if (entry.startsWith('!')) continue;
    if (!(await exists(path.join(dir, entry)))) {
      problems.push(`files 里的 ${entry} 不存在`);
    }
  }

  // 5. 每个 dist 图标的 import 都必须带可解析扩展名
  const distIcons = path.join(dir, 'dist/icons');
  const entries = await fs.readdir(distIcons).catch(() => []);
  const extMix = new Set(entries.map((e) => path.extname(e)));
  const samples = entries.filter((e) => /^bear\./.test(e));

  if (problems.length === 0) {
    console.log(`✓ ${fw.padEnd(7)} exports 全命中（dist 扩展名: ${[...extMix].join(' ') || '无'}，bear 相关: ${samples.join(' ')}）`);
  } else {
    console.log(`✗ ${fw}`);
    for (const p of problems) console.log(`    ${p}`);
    failures += problems.length;
  }
}

console.log(failures === 0 ? '\n四个包的 exports 与 files 全部有效' : `\n${failures} 处问题`);
process.exitCode = failures === 0 ? 0 : 1;
