#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""从 naive-icons 同步 SVG 到 Animal Island，并报告三类差异。

默认只报告不写文件（dry-run）。确认无误后再加 --write 落盘。

用法：
    # 1. 看有哪些差异
    python3 tools/build-icons/scripts/sync-icons.py --source ../naive-icons

    # 2. 实际同步（新增 + 更新，不删除）
    python3 tools/build-icons/scripts/sync-icons.py --source ../naive-icons --write

    # 3. 连同删除一起同步（上游删掉的图标，这里也删）
    python3 tools/build-icons/scripts/sync-icons.py --source ../naive-icons --write --prune

    # 4. CI：只检测是否落后于上游，有差异即退出 1
    python3 tools/build-icons/scripts/sync-icons.py --source ../naive-icons --check

删除默认不执行，因为那是唯一不可逆的操作。--prune 只删 icons/ 下的 .svg，
从不删除 JSON 以外的任何东西；元数据由 import-naive-meta.py 在最后统一收敛。

同步成功后会自动调用 import-naive-meta.py 更新 icons/*.json 与
categories/*.json —— 否则新增的 SVG 没有元数据，pnpm build:icons 会直接失败。
"""

import argparse
import filecmp
import re
import shutil
import subprocess
import sys
from pathlib import Path

# 全库统一规范：48 画布，根节点表现属性逐字节一致。上游偏离时同步仍会
# 继续，但会把问题报出来 —— 这类不合规会在四个框架里同时渲染错。
EXPECTED_VIEWBOX = '0 0 48 48'
REQUIRED_ROOT_ATTRS = ('fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin')

NAME_PATTERN = re.compile(r'^[a-z0-9]+(-[a-z0-9]+)*$')
ROOT_TAG = re.compile(r'<svg\b([^>]*)>', re.S)
ATTR = re.compile(r'([a-zA-Z:-]+)\s*=\s*"([^"]*)"')
CHILD_TAG = re.compile(r'<(?!svg\b)([a-z][a-z0-9]*)', re.I)


def parse_root(svg_text):
    """取出根 <svg> 的属性字典。"""
    match = ROOT_TAG.search(svg_text)
    if not match:
        return None
    return dict(ATTR.findall(match.group(1)))


def summarize_change(old_text, new_text):
    """给出一条尽量短、但能说明改了什么的变化摘要。"""
    parts = []
    old_nodes = len(CHILD_TAG.findall(old_text))
    new_nodes = len(CHILD_TAG.findall(new_text))
    if old_nodes != new_nodes:
        parts.append('元素 %d→%d' % (old_nodes, new_nodes))

    old_no_stroke = old_text.count('stroke="none"')
    new_no_stroke = new_text.count('stroke="none"')
    if old_no_stroke != new_no_stroke:
        parts.append('stroke="none" %d→%d' % (old_no_stroke, new_no_stroke))

    if not parts:
        parts.append('属性或数值微调')
    return '，'.join(parts)


def validate_upstream(name, svg_text, problems):
    """检查上游 SVG 是否符合全库规范。"""
    if not NAME_PATTERN.match(name):
        problems.append('%s.svg: 文件名不是 kebab-case' % name)

    root = parse_root(svg_text)
    if root is None:
        problems.append('%s.svg: 找不到根 <svg> 标签' % name)
        return

    if root.get('viewBox') != EXPECTED_VIEWBOX:
        problems.append(
            '%s.svg: viewBox 是 %r，期望 %r' % (name, root.get('viewBox'), EXPECTED_VIEWBOX)
        )

    for attr in REQUIRED_ROOT_ATTRS:
        if attr not in root:
            problems.append('%s.svg: 根节点缺少 %s' % (name, attr))

    if not CHILD_TAG.findall(svg_text):
        problems.append('%s.svg: 没有子元素' % name)


def collect(source_dir, target_dir):
    """算出 added / modified / removed / same。"""
    src = {p.stem: p for p in source_dir.glob('*.svg')}
    dst = {p.stem: p for p in target_dir.glob('*.svg')}

    added = sorted(set(src) - set(dst))
    removed = sorted(set(dst) - set(src))
    common = sorted(set(src) & set(dst))

    modified = []
    same = []
    for name in common:
        if filecmp.cmp(src[name], dst[name], shallow=False):
            same.append(name)
        else:
            modified.append(name)

    return src, dst, added, modified, removed, same


def print_section(title, names, limit):
    if not names:
        return
    print('\n%s（%d）' % (title, len(names)))
    for name in names[:limit]:
        print('  %s' % name)
    if len(names) > limit:
        print('  …还有 %d 个' % (len(names) - limit))


def main():
    parser = argparse.ArgumentParser(description='从 naive-icons 同步 SVG 到 Animal Island。')
    parser.add_argument('--source', default='../naive-icons', help='naive-icons 仓库路径')
    parser.add_argument('--root', default='.', help='animal-island 仓库根目录')
    parser.add_argument('--write', action='store_true', help='实际写入（默认只报告）')
    parser.add_argument('--prune', action='store_true', help='删除上游已不存在的 SVG')
    parser.add_argument('--check', action='store_true', help='有差异即退出 1，供 CI 使用')
    parser.add_argument('--no-meta', action='store_true', help='跳过元数据同步')
    parser.add_argument('--limit', type=int, default=20, help='每类最多列出的条数')
    args = parser.parse_args()

    root = Path(args.root).resolve()
    source_dir = (root / args.source).resolve() / 'svg'
    target_dir = root / 'icons'

    if not source_dir.is_dir():
        raise SystemExit('找不到上游 SVG 目录：%s' % source_dir)
    if not target_dir.is_dir():
        raise SystemExit('找不到目标目录：%s' % target_dir)

    src, dst, added, modified, removed, same = collect(source_dir, target_dir)

    if not src:
        raise SystemExit('上游没有任何 SVG：%s' % source_dir)

    # ---- 上游规范校验
    problems = []
    for name in sorted(src):
        validate_upstream(name, src[name].read_text(encoding='utf-8'), problems)

    # ---- 变更摘要
    print('上游 %s' % source_dir)
    print('目标 %s' % target_dir)
    print('\n共 %d 个 SVG：新增 %d、变更 %d、删除 %d、一致 %d'
          % (len(src), len(added), len(modified), len(removed), len(same)))

    print_section('新增（上游有、这里没有）', added, args.limit)
    print_section('删除（这里有、上游没有）', removed, args.limit)

    if modified:
        print('\n变更（%d）' % len(modified))
        for name in modified[: args.limit]:
            old_text = dst[name].read_text(encoding='utf-8')
            new_text = src[name].read_text(encoding='utf-8')
            print('  %-28s %s' % (name, summarize_change(old_text, new_text)))
        if len(modified) > args.limit:
            print('  …还有 %d 个' % (len(modified) - args.limit))

    if problems:
        print('\n上游规范问题（%d）：' % len(problems))
        for problem in problems:
            print('  - %s' % problem)
        print('\n这些问题会让四个框架同时渲染异常，建议先在上游修复。')

    has_changes = bool(added or modified or removed)

    if not args.write:
        if has_changes:
            print('\n这是 dry-run，没有写入任何文件。加 --write 执行同步。')
            if removed and not args.prune:
                print('注意：%d 个删除项不会被执行，需要同时加 --prune。' % len(removed))
        else:
            print('\n已是最新，无需同步。')
        if args.check and has_changes:
            print('\n--check：检测到差异。')
            return 1
        return 1 if problems else 0

    if problems:
        print('\n上游存在问题，已中止写入（未修改任何文件）。请先在上游修复。')
        return 1

    # ---- 写入
    # 即使 SVG 无差异也继续往下走：上游可能只改了中文名或分类，
    # JSON 需要重新生成。元数据脚本本身是幂等的。
    if has_changes:
        for name in added + modified:
            shutil.copyfile(src[name], target_dir / ('%s.svg' % name))

        pruned = []
        if removed and args.prune:
            for name in removed:
                (target_dir / ('%s.svg' % name)).unlink()
                pruned.append(name)

        print('\n已写入：新增 %d、变更 %d、删除 %d'
              % (len(added), len(modified), len(pruned)))
    else:
        print('\nSVG 已是最新，跳过复制。')
    if removed and not args.prune:
        print('有 %d 个删除项被跳过（未加 --prune）。它们仍留在 icons/，'
              '元数据同步会因此报错。' % len(removed))
        print('确认要删除时重跑并加上 --prune。')

    # ---- 元数据
    if not args.no_meta:
        meta_script = Path(__file__).resolve().parent / 'import-naive-meta.py'
        print('\n同步元数据：%s' % meta_script.name)
        # 先把自己写的内容刷出去，否则子进程的输出会插到前面，
        # 看起来像是元数据脚本先跑。
        sys.stdout.flush()
        result = subprocess.run(
            [
                sys.executable,
                str(meta_script),
                '--source', args.source,
                '--root', str(root),
            ],
            cwd=str(root),
        )
        if result.returncode != 0:
            print('\n元数据同步失败，具体原因见上方输出。')
            if removed and not args.prune:
                print('常见原因：%d 个删除项未清理，它们在上游已无分类数据。'
                      '确认要删除时加 --prune 重跑。' % len(removed))
            return result.returncode
    else:
        print('\n已跳过元数据同步（--no-meta）。记得手动跑 sync:icon-meta。')

    print('\n完成。下一步：pnpm build:icons')
    return 0


if __name__ == '__main__':
    sys.exit(main())
