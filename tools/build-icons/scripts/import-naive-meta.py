#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""从 naive-icons 同步图标元数据到 Animal Island。

naive-icons 的分类表与中文名写在 scripts/build_website.py 里（ICON_CATEGORY /
ZH_NAMES / CATEGORIES）。本脚本直接 import 那个文件取到真实数据，转换成
icons/<name>.json 与 categories/<id>.json，避免用正则解析 Python 源码。

用法：
    python3 tools/build-icons/scripts/import-naive-meta.py \
        --source ../naive-icons

脚本是幂等的：重跑会覆盖同名 JSON，并删掉不再对应 SVG 的 JSON。
"""

import argparse
import json
import sys
from pathlib import Path

# 分类的英文名、描述、代表图标与排序权重。naive-icons 只给了 id 和中文名，
# 这几项在这里维护；新增分类时需要同步补一条。
CATEGORY_DETAILS = {
    'interface': ('Interface', '基础界面控件：按钮、表单、状态与视图切换。', 'settings', 10),
    'action': ('Actions', '对内容产生动作的图标：增删改、播放、缩放、撤销。', 'check', 20),
    'media': ('Files & Media', '文件类型、音视频、图表与文档。', 'file', 30),
    'navigation': ('Navigation', '方向、箭头、地图与定位。', 'compass', 40),
    'communication': ('Communication', '邮件、消息、通话与网络信号。', 'chat', 50),
    'nature': ('Nature & Weather', '天气、植物、山石与季节。', 'sun', 60),
    'animals': ('Animals', '动物、宠物、昆虫与海洋生物。', 'bear', 70),
    'food': ('Food & Drink', '水果、正餐、烘焙与饮品。', 'cake', 80),
    'finance': ('Finance', '货币、记账、行情与支付。', 'coin', 90),
    'objects': ('Objects', '日常用品、家居、服饰与杂物。', 'gift', 100),
    'office': ('Office', '文具、办公设备与文档用品。', 'desk', 110),
    'devices': ('Devices', '电脑配件、家电与硬设备。', 'laptop', 120),
    'places': ('Places', '建筑、店铺、公共设施与场所。', 'building', 130),
    'tools': ('Tools', '手工工具、电动工具与量具。', 'hammer', 140),
    'health': ('Health & Medical', '医疗器械、身体部位与健康测量。', 'stethoscope', 150),
    'sports': ('Sports', '球类、器械、运动动作与赛事。', 'soccer', 160),
    'transport': ('Transport', '车辆、船舶、航空与交通标识。', 'car', 170),
    'emoji': ('Emoji', '表情与情绪。', 'smile', 180),
    'ai': ('AI', 'AI 智能体、提示词与模型相关。', 'ai-agent', 190),
    'dev': ('Development', '开发、部署与运维。', 'cli', 200),
}

ICON_SCHEMA_REF = '../icon.schema.json'
CATEGORY_SCHEMA_REF = '../category.schema.json'


def load_naive_data(source_root):
    scripts_dir = source_root / 'scripts'
    script = scripts_dir / 'build_website.py'
    if not script.is_file():
        raise SystemExit('找不到 %s，请用 --source 指向 naive-icons 仓库根目录。' % script)
    sys.path.insert(0, str(scripts_dir))
    import build_website  # noqa: E402

    return build_website


def write_json(path, payload):
    text = json.dumps(payload, ensure_ascii=False, indent=2) + '\n'
    path.write_text(text, encoding='utf-8')


def prune(directory, keep_stems, pattern):
    """删掉目录里不再对应任何图标的旧 JSON。"""
    removed = []
    for path in directory.glob(pattern):
        if path.stem not in keep_stems:
            path.unlink()
            removed.append(path.name)
    return removed


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', default='../naive-icons', help='naive-icons 仓库路径')
    parser.add_argument('--root', default='.', help='animal-island 仓库根目录')
    args = parser.parse_args()

    root = Path(args.root).resolve()
    source_root = (root / args.source).resolve()
    icon_dir = root / 'icons'
    category_dir = root / 'categories'

    naive = load_naive_data(source_root)

    svg_names = {p.stem for p in icon_dir.glob('*.svg')}
    if not svg_names:
        raise SystemExit('%s 下没有 SVG。' % icon_dir)

    problems = []

    # ---- 分类表
    categories = naive.CATEGORIES
    known_ids = {cid for cid, _ in categories}
    unknown = known_ids - set(CATEGORY_DETAILS)
    if unknown:
        problems.append('CATEGORY_DETAILS 缺少分类：%s' % ', '.join(sorted(unknown)))

    # 本地明细表比上游多出分类不算错 —— 上游删掉某个分类属于正常收敛，
    # 对应的 categories/*.json 会在最后的 prune 里被清掉。
    extra = set(CATEGORY_DETAILS) - known_ids
    notes = ''
    if extra:
        notes = 'CATEGORY_DETAILS 多出上游没有的分类（不会生成）：%s' % ', '.join(sorted(extra))

    # ---- 图标元数据
    icon_category = naive.ICON_CATEGORY
    zh_names = naive.ZH_NAMES

    missing_cat = sorted(svg_names - set(icon_category))
    if missing_cat:
        problems.append('naive-icons 未给这些 SVG 分类：%s' % ', '.join(missing_cat[:20]))
    ghost_cat = sorted(set(icon_category) - svg_names)
    if ghost_cat:
        problems.append('分类表里这些图标没有对应 SVG：%s' % ', '.join(ghost_cat[:20]))

    missing_zh = sorted(svg_names - set(zh_names))
    if missing_zh:
        problems.append('naive-icons 未给这些 SVG 中文名：%s' % ', '.join(missing_zh[:20]))

    bad_cat = sorted({c for c in icon_category.values() if c not in known_ids})
    if bad_cat:
        problems.append('分类 id 不在 CATEGORIES 里：%s' % ', '.join(bad_cat))

    if problems:
        print('校验未通过：')
        for p in problems:
            print('  - ' + p)
        raise SystemExit(1)

    if notes:
        print('提示：' + notes)

    # ---- 写 categories/ 前先校验代表图标归属
    for cid, _ in categories:
        icon = CATEGORY_DETAILS[cid][2]
        if icon_category.get(icon) != cid:
            problems.append('分类 %s 的代表图标 %s 不属于该分类。' % (cid, icon))

    if problems:
        print('校验未通过：')
        for p in problems:
            print('  - ' + p)
        raise SystemExit(1)

    category_dir.mkdir(parents=True, exist_ok=True)
    for cid, title_zh in categories:
        title, description, icon, weight = CATEGORY_DETAILS[cid]
        write_json(
            category_dir / ('%s.json' % cid),
            {
                '$schema': CATEGORY_SCHEMA_REF,
                'title': title,
                'titleZh': title_zh,
                'description': description,
                'icon': icon,
                'weight': weight,
            },
        )

    # ---- 写 icons/
    for name in sorted(svg_names):
        write_json(
            icon_dir / ('%s.json' % name),
            {
                '$schema': ICON_SCHEMA_REF,
                'zh': zh_names[name],
                'categories': [icon_category[name]],
            },
        )

    removed_icons = prune(icon_dir, svg_names, '*.json')
    removed_categories = prune(category_dir, known_ids, '*.json')

    print('已生成 %d 个 icons/*.json、%d 个 categories/*.json。' % (len(svg_names), len(categories)))
    if removed_icons:
        print('删除过期图标 JSON：%s' % ', '.join(sorted(removed_icons)))
    if removed_categories:
        print('删除过期分类 JSON：%s' % ', '.join(sorted(removed_categories)))


if __name__ == '__main__':
    main()
