#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""为 animal-island 站点重新子集化 LXGW Yozai 字体。

背景：站点目前用的字体拷自 naive-icons，而那份子集只覆盖 naive-icons 自己
页面出现过的字（715 个）。本站文案不同，手写体区块（--font-hand）会缺字
并回退到系统黑体，同一行里字形会跳。本脚本按本站实际用到的字符重新裁剪。

用法：
    # 需要 fonttools 与 brotli
    pip install fonttools brotli

    # 默认扫描 website/src，输出到 website/public/fonts
    python3 website/scripts/subset-fonts.py

    # 指定源字体目录（不放的话会尝试从 GitHub 下载）
    python3 website/scripts/subset-fonts.py --fonts-src ~/fonts

    # CI 里只想检查字符清单是否最新，不重新生成字体
    python3 website/scripts/subset-fonts.py --check

字体源：https://github.com/lxgw/yozai-font  （SIL OFL 1.1）
"""

import argparse
import glob
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SITE_ROOT = os.path.dirname(HERE)
REPO_ROOT = os.path.dirname(SITE_ROOT)
DEFAULT_OUT = os.path.join(SITE_ROOT, 'public', 'fonts')
CHARS_FILE = os.path.join(HERE, 'font-subset-chars.txt')

# LXGW Yozai v0.868 的上游发布地址。naive-icons 用的也是这个版本，
# 保持同源便于比对字形。
FONT_SOURCES = {
    'Yozai-Regular.ttf': 'https://github.com/lxgw/yozai-font/releases/download/v0.868/Yozai-Regular.ttf',
    'Yozai-Medium.ttf': 'https://github.com/lxgw/yozai-font/releases/download/v0.868/Yozai-Medium.ttf',
}

# 站点里会渲染文本的位置。Astro 文件含模板文本，.js 含 i18n 文案与运行时
# 状态字符串；icons.json 提供 936 个图标中文名与分类名。
SCAN_PATTERNS = [
    'src/**/*.astro',
    'src/**/*.js',
    'src/**/*.jsx',
    'src/**/*.svelte',
]

# ASCII 可打印范围始终包含，避免代码片段、图标 id 缺字。
ASCII = ''.join(chr(i) for i in range(0x20, 0x7F))

# 常用中文标点与符号。即使当前没用到也保留，防止后续文案微调立刻缺字。
PUNCT = '，。、；：？！「」『』（）【】《》——…·—–‘’“”'
SYMBOLS = '×→←↑↓↔℃©®™°÷±≤≥≠≈'


def collect_chars(site_root, verbose=False):
    """汇总站点所有会显示的字符。"""
    files = []
    for pattern in SCAN_PATTERNS:
        files.extend(glob.glob(os.path.join(site_root, pattern), recursive=True))
    files = sorted(set(files))

    chars = set()
    for path in files:
        with open(path, encoding='utf-8') as handle:
            chars.update(handle.read())
        if verbose:
            print('  扫描 %s' % os.path.relpath(path, site_root))

    # 图标中文名与分类名。这些目前走系统字体栈（--font-sans 把 Naive Sans
    # 排在最后），但纳入子集可避免将来调整字体栈时突然缺字。
    data_path = os.path.join(site_root, 'src', 'data', 'icons.json')
    if os.path.exists(data_path):
        with open(data_path, encoding='utf-8') as handle:
            data = json.load(handle)
        for icon in data.get('icons', []):
            chars.update(icon.get('zh', ''))
        for category in data.get('categories', []):
            chars.update(category.get('titleZh', ''))
        if verbose:
            print('  扫描 src/data/icons.json（%d 个图标名）' % len(data.get('icons', [])))
    else:
        print('警告：%s 不存在，先生成它（pnpm --filter @animal-island/website build）'
              % data_path, file=sys.stderr)

    chars.update(ASCII)
    chars.update(PUNCT)
    chars.update(SYMBOLS)

    # 去掉控制字符（保留 \t \n，方便清单文件本身可读）
    return ''.join(sorted(c for c in chars if ord(c) >= 0x20 or c in '\n\r\t'))


def ensure_source_fonts(fonts_src, allow_download):
    """确认源字体就位，必要时从 GitHub 下载。"""
    os.makedirs(fonts_src, exist_ok=True)
    missing = []
    for name, url in FONT_SOURCES.items():
        path = os.path.join(fonts_src, name)
        if os.path.exists(path):
            continue
        if not allow_download:
            missing.append((name, url))
            continue
        print('下载 %s ...' % name, end='', flush=True)
        try:
            import urllib.request
            urllib.request.urlretrieve(url, path)
            print(' %.1f MB' % (os.path.getsize(path) / 1024 / 1024))
        except Exception as error:  # noqa: BLE001 - 网络错误形态多样
            print(' 失败：%s' % error)
            if os.path.exists(path) and os.path.getsize(path) == 0:
                os.remove(path)
            missing.append((name, url))

    if missing:
        print('\n缺少源字体：', file=sys.stderr)
        for name, url in missing:
            print('  %s\n    %s' % (name, url), file=sys.stderr)
        print('\n请手动下载后放到 %s，或用 --fonts-src 指定目录。' % fonts_src,
              file=sys.stderr)
        return False
    return True


def subset_font(subset, src_path, out_dir, out_stem, text):
    """生成 woff2 与 woff 两份产物。"""
    common = dict(
        desubroutinize=True,
        layout_features=['*'],
        hinting=False,
        name_IDs=['*'],
        name_languages=['*'],
        notdef_outline=True,
        recalc_bounds=True,
        drop_tables=['FFTM', 'meta', 'GPOS', 'feat', 'morx'],
    )

    written = []
    for flavor, suffix in (('woff2', '.woff2'), ('woff', '.woff')):
        options = subset.Options(**common, flavor=flavor, with_zopfli=(flavor == 'woff2'))
        font = subset.load_font(src_path, options)
        subsetter = subset.Subsetter(options=options)
        subsetter.populate(text=text)
        subsetter.subset(font)
        out_path = os.path.join(out_dir, out_stem + suffix)
        subset.save_font(font, out_path, options)
        written.append((out_path, os.path.getsize(out_path)))
    return written


def verify_coverage(subset, font_path, required):
    """读回子集字体，确认所有需要的字符都在 cmap 里。

    这是本脚本的核心价值：子集化最容易出的错是「以为覆盖了其实没有」，
    所以生成后必须自证。
    """
    options = subset.Options()
    font = subset.load_font(font_path, options)
    try:
        cmap = font.getBestCmap()
    finally:
        font.close()

    if cmap is None:
        return {'（无 cmap）'}, len(required)

    missing = {c for c in required if ord(c) not in cmap}
    return missing, len(required)


def main():
    parser = argparse.ArgumentParser(description='为 animal-island 站点子集化 LXGW Yozai 字体。')
    parser.add_argument('--site', default=SITE_ROOT, help='站点根目录')
    parser.add_argument('--out', default=DEFAULT_OUT, help='字体输出目录')
    parser.add_argument('--fonts-src', default=os.path.join(HERE, 'fonts-src'),
                        help='源字体目录')
    parser.add_argument('--no-download', action='store_true', help='不自动下载源字体')
    parser.add_argument('--check', action='store_true',
                        help='只报告字符清单是否需要更新，不生成字体')
    parser.add_argument('--manifest-only', action='store_true',
                        help='只写字符清单，不裁字体（不需要 fonttools）')
    parser.add_argument('--verbose', action='store_true', help='列出扫描的文件')
    args = parser.parse_args()

    try:
        from fontTools import subset
    except ImportError:
        subset = None

    print('收集字符（%s）' % args.site)
    chars = collect_chars(args.site, verbose=args.verbose)
    print('  共 %d 个字符，其中非 ASCII %d 个'
          % (len(chars), len({c for c in chars if ord(c) > 0x7F})))
    # 确保上面的输出先于后续可能写到 stderr 的提示
    sys.stdout.flush()

    # 与现有清单比对，方便 CI 判断是否需要重新生成
    previous = None
    if os.path.exists(CHARS_FILE):
        previous = open(CHARS_FILE, encoding='utf-8').read()

    if previous is not None and previous != chars:
        added = sorted(set(chars) - set(previous))
        removed = sorted(set(previous) - set(chars))
        print('  与现有清单不同：新增 %d、减少 %d' % (len(added), len(removed)))
        if added:
            print('    新增：%s' % ''.join(added[:60]))
    elif previous == chars:
        print('  与现有清单一致')

    if args.check:
        if previous == chars:
            print('\n--check：清单已是最新。')
            return 0
        print('\n--check：清单需要更新（重跑不带 --check）。')
        return 1

    # 只有真正生成字体时才需要 fonttools，--check 能在裸环境里跑。
    if args.manifest_only:
        with open(CHARS_FILE, 'w', encoding='utf-8') as handle:
            handle.write(chars)
        print('\n字符清单已写入 %s（未生成字体）'
              % os.path.relpath(CHARS_FILE, REPO_ROOT))
        return 0

    if subset is None:
        print('\n缺少 fonttools。安装：pip install fonttools brotli', file=sys.stderr)
        print('若只想先固定字符清单，用 --manifest-only。', file=sys.stderr)
        return 1

    if not ensure_source_fonts(args.fonts_src, allow_download=not args.no_download):
        return 1

    os.makedirs(args.out, exist_ok=True)

    mapping = [
        ('Yozai-Regular.ttf', 'yozai-regular'),
        ('Yozai-Medium.ttf', 'yozai-medium'),
    ]

    print('\n子集化：')
    failures = 0
    for src_name, out_stem in mapping:
        src = os.path.join(args.fonts_src, src_name)
        if not os.path.exists(src):
            print('  跳过 %s（不存在）' % src_name)
            failures += 1
            continue
        written = subset_font(subset, src, args.out, out_stem, chars)
        for path, size in written:
            print('  %-22s %6.1f KB' % (os.path.basename(path), size / 1024))

        # 自证覆盖：用 woff2 产物回读 cmap
        woff2 = written[0][0]
        missing, total = verify_coverage(subset, woff2, chars)
        if missing:
            print('    ✗ 覆盖校验失败，缺 %d 个字符：%s'
                  % (len(missing), ''.join(sorted(missing)[:40])))
            failures += 1
        else:
            print('    ✓ 覆盖校验通过（%d 个字符全部有字形）' % total)

    with open(CHARS_FILE, 'w', encoding='utf-8') as handle:
        handle.write(chars)
    print('\n字符清单已写入 %s' % os.path.relpath(CHARS_FILE, REPO_ROOT))

    if failures:
        return 1
    print('完成。记得提交 %s 与 %s 下的字体产物。'
          % (os.path.relpath(CHARS_FILE, REPO_ROOT),
             os.path.relpath(args.out, REPO_ROOT)))
    return 0


if __name__ == '__main__':
    sys.exit(main())
