"use strict";

// 山河手帖小程序数据构建：tripN.md + trips-config.json → miniprogram/data/*.js
// 用法：node miniprogram/build.js
// 文章正文打进包内（纯文本，几十 KB），图片/视频走 GitHub Pages 线上地址。

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SITE_BASE = "https://tokeiyo929.github.io/travel-articles/";
const OUT_DIR = path.join(__dirname, "data");

const abs = (p) => (p.startsWith("http") ? p : SITE_BASE + p.replace(/^\//, ""));

function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// 正文里唯一内联格式是 **粗体**，转成 rich-text 可渲染的 <strong>
function inlineHtml(text) {
  return escapeHtml(text).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

function parseFrontMatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  const meta = {};
  let body = text;
  if (m) {
    body = text.slice(m[0].length);
    for (const line of m[1].split(/\r?\n/)) {
      const i = line.indexOf(":");
      if (i < 0) continue;
      meta[line.slice(0, i).trim().toLowerCase()] = line.slice(i + 1).trim();
    }
  }
  return { meta, body };
}

// 视频块是流水线生成的单行合法 HTML，属性顺序固定
const VIDEO_RE = /^<figure><video[^>]*poster="([^"]+)"[^>]*src="([^"]+)"[^>]*><\/video><figcaption>([^<]*)<\/figcaption><\/figure>$/;
const IMG_RE = /^!\[([^\]]*)\]\(([^)]+)\)$/;
const LI_RE = /^- \*\*(.+?)\*\*[：:]\s*(.*)$/;

function parseBlocks(body) {
  const blocks = [];
  for (const raw of body.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    let m;
    if (line.startsWith("# ")) {
      blocks.push({ t: "h1", x: line.slice(2).trim() });
    } else if ((m = line.match(VIDEO_RE))) {
      blocks.push({ t: "video", poster: abs(m[1]), src: abs(m[2]), cap: m[3] });
    } else if ((m = line.match(IMG_RE))) {
      blocks.push({ t: "img", src: abs(m[2]), alt: m[1] });
    } else if ((m = line.match(LI_RE))) {
      blocks.push({ t: "li", lead: m[1], x: m[2] });
    } else if (line.startsWith("- ")) {
      blocks.push({ t: "li", lead: "", x: line.slice(2).trim() });
    } else {
      blocks.push({ t: "p", x: inlineHtml(line) });
    }
  }
  return blocks;
}

function buildTrip(num) {
  const mdPath = path.join(ROOT, `trip${num}.md`);
  const { meta, body } = parseFrontMatter(fs.readFileSync(mdPath, "utf8"));
  const blocks = parseBlocks(body);
  const data = {
    id: num,
    title: meta.title || `手帖 ${num}`,
    date: meta.date || "",
    location: meta.location || "",
    cover: abs(meta.cover || ""),
    spots: (meta.spots || "").split(",").map((s) => s.trim()).filter(Boolean),
    excerpt: meta.excerpt || "",
    blocks
  };
  const counts = {};
  for (const b of blocks) counts[b.t] = (counts[b.t] || 0) + 1;
  console.log(`trip${num}: ${counts.h1 || 0} h1, ${counts.p || 0} p, ${counts.img || 0} img, ${counts.video || 0} video, ${counts.li || 0} li`);
  return data;
}

function writeData(name, value) {
  const file = path.join(OUT_DIR, name);
  fs.writeFileSync(file, `// 由 build.js 生成，勿手改\nmodule.exports = ${JSON.stringify(value, null, 2)};\n`);
  console.log(`[OK] data/${name}`);
}

function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const config = JSON.parse(fs.readFileSync(path.join(ROOT, "trips-config.json"), "utf8"));
  const trips = config.trips.map((t) => ({
    id: t.id,
    title: t.title,
    date: t.date,
    location: t.location,
    cover: abs(t.cover),
    spots: t.spots || [],
    excerpt: t.excerpt || ""
  }));
  const articles = {};
  for (const t of trips) articles[t.id] = buildTrip(t.id);
  // 单文件静态 require，页面端不碰动态路径
  writeData("articles.js", { trips, articles });
}

main();
