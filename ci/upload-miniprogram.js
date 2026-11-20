"use strict";

// 拍照教练小程序上传/预览（miniprogram-ci）。
// 用法：
//   node ci/upload-miniprogram.js                          # 上传为后台开发版本
//   node ci/upload-miniprogram.js --version 1.0.1 --desc "修复xx" --robot 1
//   node ci/upload-miniprogram.js --preview                # 生成预览二维码 ci/output/preview-qr.png
// 上传密钥默认取 ci/profiles/private.<appid>.key（gitignore，不入库）。

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

function parseArgs(argv) {
  const result = {};
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (!key.startsWith("--")) throw new Error(`Unknown argument: ${key}`);
    const value = argv[i + 1];
    if (value === undefined) { result[key.slice(2)] = true; } // 无值 flag（如 --preview）
    else if (value.startsWith("--")) { result[key.slice(2)] = ""; }
    else { result[key.slice(2)] = value; i += 1; }
  }
  return result;
}

function gitCommit() {
  try { return execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim(); }
  catch (_) { return "nogit"; }
}

function loadCi() {
  try { return require("miniprogram-ci"); }
  catch (_) {
    const { createRequire } = require("module");
    const globalRoot = execSync("npm root -g", { encoding: "utf8" }).trim();
    return createRequire(path.join(globalRoot, "noop.js"))("miniprogram-ci");
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const projectPath = path.resolve(__dirname, "..", "miniprogram");
  const config = JSON.parse(fs.readFileSync(path.join(projectPath, "project.config.json"), "utf8"));
  const appid = config.appid;
  const keyArg = args["private-key-path"] || "";
  const privateKeyPath = keyArg ? path.resolve(keyArg) : path.join(__dirname, "profiles", `private.${appid}.key`);
  if (!appid) throw new Error("appid missing in miniprogram/project.config.json");
  if (!fs.existsSync(privateKeyPath) || !fs.statSync(privateKeyPath).isFile()) {
    throw new Error(`上传私钥不存在: ${privateKeyPath}\n从 mp.weixin.qq.com（开发管理-开发设置-小程序代码上传）下载后放到该位置`);
  }

  const ci = loadCi();
  const project = new ci.Project({
    appid,
    type: "miniProgram",
    projectPath,
    privateKeyPath,
    ignores: ["node_modules/**/*"]
  });
  const setting = { es6: true, es7: true, minify: true, autoPrefixWXSS: true };

  if (args.preview) {
    // 预览二维码：真机扫码立即可试（需该微信号为小程序的体验成员/管理员）
    const qrPath = path.resolve(__dirname, "output", "preview-qr.png");
    fs.mkdirSync(path.dirname(qrPath), { recursive: true });
    console.log(`PREVIEW_START appid=${appid} commit=${gitCommit()}`);
    const result = await ci.preview({
      project,
      desc: args.desc || `travel-articles preview ${gitCommit()}`,
      setting,
      qrcodeFormat: "image",
      qrcodeOutputDest: qrPath,
      onProgressUpdate: (p) => console.log(typeof p === "string" ? p : JSON.stringify(p))
    });
    console.log(`PREVIEW_RESULT ${JSON.stringify(result || {})}`);
    console.log(`PREVIEW_QR ${qrPath}`);
    console.log("PREVIEW_SUCCESS");
    return;
  }

  const version = args.version || "1.0.0";
  const robot = Number(args.robot || "1");
  if (!Number.isInteger(robot) || robot < 1 || robot > 30) throw new Error("robot must be 1-30");
  const desc = args.desc || `travel-articles v${version} ${gitCommit()}`;

  console.log(`UPLOAD_START appid=${appid} version=${version} robot=${robot} commit=${gitCommit()}`);
  const result = await ci.upload({
    project,
    version,
    desc,
    robot,
    setting,
    onProgressUpdate: (p) => console.log(typeof p === "string" ? p : JSON.stringify(p))
  });
  console.log(`UPLOAD_RESULT ${JSON.stringify(result || {})}`);
  console.log("UPLOAD_SUCCESS");
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : String(error));
  process.exit(1);
});
