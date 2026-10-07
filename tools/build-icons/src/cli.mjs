#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseSvg } from './parseSvg.mjs';
import {
  emitBarrel,
  emitScriptIcon,
  emitSvelteIcon,
  iconDataToTree,
  outputPaths,
  toPascalCase,
} from './emit.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '../../..');
const FRAMEWORKS = ['react', 'vue', 'svelte', 'solid'];

const parseArgs = (argv) => {
  const options = {
    input: path.join(REPO_ROOT, 'icons'),
    outRoot: path.join(REPO_ROOT, 'packages/icons'),
    targets: FRAMEWORKS,
    check: false,
  };

  for (const arg of argv) {
    if (arg === '--check') {
      options.check = true;
      continue;
    }
    const match = arg.match(/^--([^=]+)=(.*)$/);
    if (!match) throw new Error(`无法识别的参数：${arg}`);
    const [, key, value] = match;
    if (key === 'input') options.input = path.resolve(REPO_ROOT, value);
    else if (key === 'out-root') options.outRoot = path.resolve(REPO_ROOT, value);
    else if (key === 'targets') options.targets = value.split(',').filter(Boolean);
    else throw new Error(`无法识别的参数：--${key}`);
  }

  const unknown = options.targets.filter((target) => !FRAMEWORKS.includes(target));
  if (unknown.length > 0) {
    throw new Error(`未知框架：${unknown.join(', ')}（可选：${FRAMEWORKS.join(', ')}）`);
  }

  return options;
};

/** 把解析树转成运行时使用的紧凑节点：`[tag, attrs]` 或 `[tag, attrs, children]`。 */
const toIconNode = (node) => {
  const children = node.children.map(toIconNode);
  return children.length > 0
    ? [node.name, node.attributes, children]
    : [node.name, node.attributes];
};

/** 根 `<svg>` 上由运行时统一填写的属性，不重复写进 iconData.root。 */
const stripTransparentAttributes = (attributes) => {
  const { xmlns, viewBox, ...rest } = attributes;
  return rest;
};

/** 深度对比两棵树，返回人类可读的差异列表。 */
const diffTrees = (actual, expected, where = 'svg', problems = []) => {
  if (actual.name !== expected.name) {
    problems.push(`${where}: 标签 ${actual.name} ≠ ${expected.name}`);
    return problems;
  }

  const keys = new Set([...Object.keys(actual.attributes), ...Object.keys(expected.attributes)]);
  for (const key of keys) {
    if (actual.attributes[key] !== expected.attributes[key]) {
      problems.push(
        `${where}: 属性 ${key} = ${JSON.stringify(actual.attributes[key])} ≠ ${JSON.stringify(
          expected.attributes[key],
        )}`,
      );
    }
  }

  if (actual.children.length !== expected.children.length) {
    problems.push(
      `${where}: 子元素数量 ${actual.children.length} ≠ ${expected.children.length}`,
    );
    return problems;
  }

  actual.children.forEach((child, index) => {
    diffTrees(child, expected.children[index], `${where} > ${child.name}[${index}]`, problems);
  });

  return problems;
};

const loadIcons = async (inputDir) => {
  const files = (await fs.readdir(inputDir)).filter((file) => file.endsWith('.svg')).sort();
  if (files.length === 0) throw new Error(`${inputDir} 下没有 SVG 文件。`);

  const icons = [];
  const problems = [];

  for (const file of files) {
    const name = path.basename(file, '.svg');
    const source = await fs.readFile(path.join(inputDir, file), 'utf-8');
    const tree = parseSvg(source);

    const { viewBox } = tree.attributes;
    if (!viewBox) {
      problems.push(`${file}: 根 <svg> 缺少 viewBox。`);
      continue;
    }

    const icon = {
      name,
      componentName: toPascalCase(name),
      viewBox,
      root: stripTransparentAttributes(tree.attributes),
      node: tree.children.map(toIconNode),
    };

    if (!/^\d+(\.\d+)? \d+(\.\d+)? \d+(\.\d+)? \d+(\.\d+)?$/.test(viewBox)) {
      problems.push(`${file}: viewBox 格式不合法（${viewBox}）。`);
    }

    const expectedTree = {
      name: 'svg',
      attributes: Object.fromEntries(
        Object.entries(tree.attributes).filter(([key]) => key !== 'xmlns'),
      ),
      children: tree.children,
    };
    problems.push(...diffTrees(iconDataToTree(icon), expectedTree, file));

    icons.push(icon);
  }

  const byComponentName = new Map();
  for (const icon of icons) {
    const existing = byComponentName.get(icon.componentName);
    if (existing) {
      problems.push(`${icon.name}.svg 与 ${existing}.svg 都会生成 ${icon.componentName}。`);
    }
    byComponentName.set(icon.componentName, icon.name);
  }

  return { icons, problems };
};

/** 生成物允许的后缀。清理时只删这些，保留 `.gitkeep` 等占位文件。 */
const GENERATED_EXTENSIONS = ['.ts', '.svelte'];

/** 清掉上一次生成的图标文件，但保留目录本身，避免删掉被 git 跟踪的 `.gitkeep`。 */
const clearGeneratedIcons = async (iconDir) => {
  for (const entry of await fs.readdir(iconDir)) {
    if (GENERATED_EXTENSIONS.some((extension) => entry.endsWith(extension))) {
      await fs.rm(path.join(iconDir, entry), { force: true });
    }
  }
};

const writeIcons = async (icons, options) => {
  const written = [];

  for (const framework of options.targets) {
    const paths = outputPaths(options.outRoot, framework);
    await fs.mkdir(paths.iconDir, { recursive: true });
    await clearGeneratedIcons(paths.iconDir);

    const isSvelte = framework === 'svelte';
    const extension = isSvelte ? '.svelte' : '.ts';
    const emit = isSvelte ? emitSvelteIcon : emitScriptIcon;

    for (const icon of icons) {
      await fs.writeFile(path.join(paths.iconDir, `${icon.name}${extension}`), emit(icon), 'utf-8');
    }

    await fs.mkdir(paths.sourceDir, { recursive: true });
    await fs.writeFile(
      paths.barrel,
      emitBarrel(icons, { svelte: isSvelte, prefix: './' }),
      'utf-8',
    );

    written.push(`${framework}: ${icons.length} 个图标 -> ${path.relative(REPO_ROOT, paths.iconDir)}`);
  }

  return written;
};

const main = async () => {
  const options = parseArgs(process.argv.slice(2));
  const { icons, problems } = await loadIcons(options.input);

  if (problems.length > 0) {
    console.error(`校验未通过（${problems.length} 项）：`);
    for (const problem of problems) console.error(`  - ${problem}`);
    process.exitCode = 1;
    return;
  }

  console.log(`解析并校验通过：${icons.length} 个图标。`);

  if (options.check) {
    console.log('--check 模式：未写入任何文件。');
    return;
  }

  for (const line of await writeIcons(icons, options)) console.log(line);
};

await main();
