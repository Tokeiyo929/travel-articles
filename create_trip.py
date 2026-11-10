#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
山河手帖 · 游记生成工具

用法:
    python create_trip.py trip1.md    # 从 Markdown 生成/更新手帖页面与配置
    python create_trip.py --list      # 查看现有手帖
    python create_trip.py --rebuild   # 重建全部手帖页面

Markdown 需要 front-matter:
---
title: 标题
date: 2024-05-16
location: 越南 · 河内
cover: images/hanoi/IMG_1100.jpg
spots: 景点1, 景点2
excerpt: 摘要（留空则自动截取正文首段）
---
"""
import json
import os
import re
import sys
from html import escape

TRIP_FILE_PATTERN = re.compile(r"^trip(\d+)\.md$", re.IGNORECASE)
TRIPS_CONFIG = "trips-config.json"
SITE_CONFIG = "trip_config.json"

HTML_TEMPLATE = """<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="referrer" content="strict-origin-when-cross-origin">
    <meta http-equiv="Content-Security-Policy" content="default-src 'self'; base-uri 'self'; object-src 'none'; form-action 'self'; script-src 'self'; style-src 'self'; font-src 'self' data:; img-src 'self' https: data:; upgrade-insecure-requests">
    <title>{title} · 山河手帖</title>
    <link rel="icon" href="favicon.svg" type="image/svg+xml">
    <link rel="stylesheet" href="vendor/fontawesome/all.min.css">
    <link rel="stylesheet" href="trip.css">
    <script defer src="vendor/marked.umd.js"></script>
    <script defer src="vendor/purify.min.js"></script>
    <script defer src="trip.js"></script>
</head>
<body data-markdown="{md}">
    <div class="wrap">
        <header class="site-head">
            <div class="site-title"><a href="index.html">山河手帖</a></div>
            <a class="back-link" href="index.html"><i class="fas fa-arrow-left" aria-hidden="true"></i> 回到手帖一览</a>
        </header>

        <article>
            <header class="article-header">
                <h1 class="article-title">{title}</h1>
                <div class="article-meta">
                    <span><i class="fas fa-location-dot" aria-hidden="true"></i>{location}</span>
                    <span><i class="fas fa-calendar-days" aria-hidden="true"></i>{date}</span>
                </div>
            </header>

            <div class="loading-indicator" id="loading">
                <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
                <p>正在展开手帖……</p>
            </div>
            <div class="error-container" id="error-container" hidden>
                <i class="fas fa-exclamation-triangle" aria-hidden="true"></i>
                <h3>内容加载失败</h3>
                <p id="error-message">未知错误</p>
                <button type="button" id="retry-load" class="copy-button">
                    <i class="fas fa-redo" aria-hidden="true"></i> 重新加载
                </button>
            </div>
            <div id="markdown-content" hidden></div>
        </article>

        <footer>
            <p>© 2026 山河手帖 · <a href="index.html">更多手帖</a></p>
        </footer>
    </div>
</body>
</html>
"""


def configure_stdio():
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8")


def trip_number(path):
    m = TRIP_FILE_PATTERN.match(os.path.basename(path))
    return int(m.group(1)) if m else None


def parse_front_matter(text):
    m = re.match(r"^\uFEFF?---\s*\n([\s\S]*?)\n---\s*\n", text)
    meta, body = {}, text
    if m:
        meta, body = {}, text[m.end():]
        for line in m.group(1).splitlines():
            if ":" not in line:
                continue
            key, _, value = line.partition(":")
            meta[key.strip().lower()] = value.strip()
    return meta, body


def load_json(path, default):
    if not os.path.exists(path):
        return default
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def save_json(path, data):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def first_paragraph(body):
    for block in re.split(r"\n\s*\n", body):
        clean = re.sub(r"!\[[^\]]*\]\([^)]*\)|#.*|\*.*|\n", " ", block).strip()
        if clean:
            return clean
    return ""


def build_trip(md_path, site_config):
    with open(md_path, "r", encoding="utf-8") as f:
        text = f.read()
    meta, body = parse_front_matter(text)

    num = trip_number(md_path)
    if num is None:
        raise SystemExit(f"文件名需为 tripN.md: {md_path}")

    title = meta.get("title") or f"手帖 {num}"
    date = meta.get("date", "")
    location = meta.get("location", "未知")
    cover = meta.get("cover", "")
    spots = [s.strip() for s in meta.get("spots", "").split(",") if s.strip()]
    excerpt = meta.get("excerpt") or first_paragraph(body)[: site_config.get("excerpt_length", 120)]

    html_path = f"trip{num}.html"
    with open(html_path, "w", encoding="utf-8", newline="\n") as f:
        f.write(HTML_TEMPLATE.format(
            title=escape(title), md=os.path.basename(md_path),
            location=escape(location), date=escape(date)))

    config = load_json(TRIPS_CONFIG, {"trips": []})
    entry = {"id": num, "title": title, "excerpt": excerpt, "date": date,
             "location": location, "cover": cover, "spots": spots, "link": html_path}
    config["trips"] = [t for t in config.get("trips", []) if t.get("id") != num]
    config["trips"].append(entry)
    config["trips"].sort(key=lambda t: t.get("id", 0))
    save_json(TRIPS_CONFIG, config)
    print(f"[OK] {html_path} 已生成, {TRIPS_CONFIG} 已更新: {title}")


def list_trips():
    config = load_json(TRIPS_CONFIG, {"trips": []})
    trips = config.get("trips", [])
    if not trips:
        print("还没有手帖。用 python create_trip.py trip1.md 创建第一篇。")
        return
    for t in sorted(trips, key=lambda x: x.get("id", 0)):
        print(f"  trip{t['id']}.md | {t.get('date')} | {t.get('location')} | {t.get('title')}")


def main():
    configure_stdio()
    site_config = load_json(SITE_CONFIG, {})
    args = [a for a in sys.argv[1:] if not a.startswith("-")]

    if "--list" in sys.argv:
        list_trips()
        return
    if "--rebuild" in sys.argv:
        mds = sorted(f for f in os.listdir(".") if trip_number(f))
        for md in mds:
            build_trip(md, site_config)
        return
    if not args:
        print(__doc__)
        return
    for md in args:
        build_trip(md, site_config)


if __name__ == "__main__":
    main()
