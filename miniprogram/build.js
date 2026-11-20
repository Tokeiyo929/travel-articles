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

// ---------- 旅程地图 ----------

// 地图投影：等距圆柱，纬度裁到 83N ~ 60S（标准世界地图裁法，去南极）
const MAP_W = 1000;
const MAP_H = 500;
const LAT_TOP = 83;
const LAT_BOTTOM = -60;
const projX = (lng) => ((lng + 180) / 360) * MAP_W;
const projY = (lat) => ((LAT_TOP - lat) / (LAT_TOP - LAT_BOTTOM)) * MAP_H;
// 页面叠层用百分比（与 svg viewBox 同一投影）
const pctX = (lng) => +(((lng + 180) / 360) * 100).toFixed(2);
const pctY = (lat) => +(((LAT_TOP - lat) / (LAT_TOP - LAT_BOTTOM)) * 100).toFixed(2);

function loadGeoData() {
  const cache = path.join(ROOT, "world-countries.cache.json");
  if (!fs.existsSync(cache)) {
    throw new Error(`缺少地理数据缓存 ${cache}：先 npm pack world-atlas@2 解出 countries-110m.json 存到该路径`);
  }
  const data = JSON.parse(fs.readFileSync(cache, "utf8"));
  if (data.type !== "Topology") return data; // 已是 GeoJSON
  // TopoJSON → GeoJSON：arcs 增量还原，负索引表示反向
  const decoded = data.arcs.map((arc) => {
    let x = 0;
    let y = 0;
    return arc.map((p) => {
      x += p[0];
      y += p[1];
      return [x * data.transform.scale[0] + data.transform.translate[0],
        y * data.transform.scale[1] + data.transform.translate[1]];
    });
  });
  const ringCoords = (arcIdxList) => arcIdxList.flatMap((idx, i) => {
    const line = idx >= 0 ? decoded[idx] : decoded[~idx].slice().reverse();
    return i === 0 ? line : line.slice(1); // 接缝去重
  });
  const toGeom = (g) => {
    if (g.type === "Polygon") {
      return { type: "Polygon", coordinates: g.arcs.map(ringCoords) };
    }
    return { type: "MultiPolygon", coordinates: g.arcs.map((poly) => poly.map(ringCoords)) };
  };
  const geoms = data.objects.countries ? data.objects.countries.geometries : Object.values(data.objects)[0].geometries;
  return {
    type: "FeatureCollection",
    features: geoms.map((g) => ({ id: g.id, properties: g.properties, geometry: toGeom(g) }))
  };
}

// 环经线（±180）跳变处断开，避免俄罗斯东端横穿整张图
function ringToPath(ring) {
  const segs = [];
  let cur = [];
  for (let i = 0; i < ring.length; i += 1) {
    const [lng, lat] = ring[i];
    if (cur.length && Math.abs(lng - ring[i - 1][0]) > 180) {
      segs.push(cur);
      cur = [];
    }
    cur.push([projX(lng).toFixed(1), projY(lat).toFixed(1)]);
  }
  if (cur.length) segs.push(cur);
  return segs
    .filter((s) => s.length > 2)
    .map((s) => `M${s.map((p) => p.join(" ")).join("L")}Z`)
    .join("");
}

function geoToSvgPath(geometry) {
  const polys = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  return polys.map((poly) => poly.map(ringToPath).join("")).join("");
}

async function ensureMapSvg(force) {
  const outFile = path.join(__dirname, "assets", "world-map.svg");
  if (fs.existsSync(outFile) && !force) {
    console.log("[SKIP] assets/world-map.svg 已存在（--force-map 重新生成）");
    return;
  }
  const geo = loadGeoData();
  const paths = [];
  for (const f of geo.features) {
    if (f.id === "ATA" || (f.properties && f.properties.name === "Antarctica")) continue; // 南极不画
    const d = geoToSvgPath(f.geometry);
    if (d) paths.push(`<path d="${d}"/>`);
  }
  // 经纬网：经线每 30°，纬线每 30°
  const grid = [];
  for (let lng = -150; lng <= 180; lng += 30) {
    grid.push(`<line x1="${projX(lng)}" y1="0" x2="${projX(lng)}" y2="${MAP_H}"/>`);
  }
  for (let lat = 60; lat >= LAT_BOTTOM; lat -= 30) {
    grid.push(`<line x1="0" y1="${projY(lat)}" x2="${MAP_W}" y2="${projY(lat)}"/>`);
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${MAP_W} ${MAP_H}">`
    + `<g fill="none" stroke="#e2d9c8" stroke-width="0.8" stroke-dasharray="3 4" opacity="0.8">${grid.join("")}</g>`
    + `<g fill="#e9e0cc" stroke="#b9a888" stroke-width="0.7" stroke-linejoin="round">${paths.join("")}</g>`
    + `</svg>`;
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, svg);
  console.log(`[OK] assets/world-map.svg（${(fs.statSync(outFile).size / 1024).toFixed(0)}KB，${paths.length} 个国家面）`);
}

function buildVisited() {
  const raw = JSON.parse(fs.readFileSync(path.join(ROOT, "visited-cities.json"), "utf8"));
  const cities = raw.cities.map((c) => {
    if (typeof c.lat !== "number" || typeof c.lng !== "number") throw new Error(`城市缺坐标: ${c.name}`);
    const x = pctX(c.lng);
    return {
      name: c.name,
      country: c.country || "",
      trip: c.trip || null,
      x,
      y: pctY(c.lat),
      side: x > 70 ? "left" : "right" // 靠右缘的城市标签放点左侧
    };
  });
  console.log(`[OK] visited: ${cities.length} 城市 / ${new Set(cities.map((c) => c.country)).size} 国家`);
  return cities;
}

// ---------- 行程（航班/车次） ----------

const MODE_COLOR = { flight: "#a4452c", train: "#5b6470" };
const MODE_LABEL = { flight: "航班", train: "车次" };

// 等距圆柱下两点间带一点弧度的虚线（Q 曲线，恒向北弓）
function journeyPath(from, to) {
  const x1 = projX(from.lng);
  const y1 = projY(from.lat);
  const x2 = projX(to.lng);
  const y2 = projY(to.lat);
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.hypot(dx, dy);
  if (dist < 1) return { line: "", from: [x1, y1], to: [x2, y2] };
  let nx = -dy / dist;
  let ny = dx / dist;
  if (ny > 0) { nx = -nx; ny = -ny; } // 弓向北
  const bow = dist * 0.12;
  const line = `M${x1.toFixed(1)} ${y1.toFixed(1)}Q${(x1 + dx / 2 + nx * bow).toFixed(1)} ${(y1 + dy / 2 + ny * bow).toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`;
  return { line, from: [x1, y1], to: [x2, y2] };
}

function buildJourneys() {
  const raw = JSON.parse(fs.readFileSync(path.join(ROOT, "journeys.json"), "utf8"));
  const journeys = (raw.journeys || []).map((j) => ({
    mode: j.mode === "train" ? "train" : "flight",
    date: j.date || "",
    from: j.from,
    to: j.to,
    no: j.no || "",
    trip: j.trip || null
  }));
  journeys.sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  // 路线叠层 SVG，坐标与 world-map.svg 同一投影
  const parts = [];
  for (const j of journeys) {
    const color = MODE_COLOR[j.mode];
    const { line, from, to } = journeyPath(j.from, j.to);
    if (!line) continue;
    parts.push(`<path d="${line}" fill="none" stroke="${color}" stroke-width="2.5" stroke-dasharray="7 5"/>`);
    for (const [x, y] of [from, to]) {
      parts.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4.5" fill="#f8f4ec" stroke="${color}" stroke-width="2"/>`);
    }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${MAP_W} ${MAP_H}">${parts.join("")}</svg>`;
  // 连线层落成包内文件：小程序 image 对 URL-encoded SVG data URI 渲染不稳，底图同款本地路径最稳
  let routesSvg = "";
  if (journeys.length) {
    fs.writeFileSync(path.join(__dirname, "assets", "routes.svg"), svg);
    routesSvg = "/assets/routes.svg";
  }
  console.log(`[OK] journeys: ${journeys.length} 段（${journeys.filter((j) => j.mode === "flight").length} 飞 / ${journeys.filter((j) => j.mode === "train").length} 车）`);
  return { journeys, routesSvg, modeLabel: MODE_LABEL };
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
  writeData("articles.js", {
    trips,
    articles,
    visited: buildVisited(),
    ...buildJourneys()
  });
}

const wantMap = process.argv.includes("--map") || process.argv.includes("--force-map");
if (wantMap) {
  ensureMapSvg(process.argv.includes("--force-map"))
    .then(main)
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
} else {
  main();
}
