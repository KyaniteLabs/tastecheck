#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const samples = ["copper", "swiss", "maximal", "concrete", "clay", "dispatch", "verge"];

function mime(file) {
  if (file.endsWith(".html")) return "text/html; charset=utf-8";
  if (file.endsWith(".css")) return "text/css; charset=utf-8";
  if (file.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (file.endsWith(".png")) return "image/png";
  if (file.endsWith(".woff2")) return "font/woff2";
  if (file.endsWith(".ico")) return "image/x-icon";
  return "application/octet-stream";
}

async function withServer(run) {
  const server = http.createServer((req, res) => {
    try {
      const p = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
      const rel = p === "/" ? "index.html" : p.replace(/^\/+/, "");
      const abs = path.resolve(root, rel);
      const stat = fs.statSync(abs);
      const file = stat.isDirectory() ? path.join(abs, "index.html") : abs;
      res.writeHead(200, { "content-type": mime(file), "cache-control": "no-store" });
      fs.createReadStream(file).pipe(res);
    } catch {
      res.writeHead(404);
      res.end("not found");
    }
  });
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  try {
    return await run(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((r) => server.close(r));
  }
}

async function main() {
  const browser = await chromium.launch();
  const shots = [];

  await withServer(async (base) => {
    for (const sample of samples) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
      await page.goto(`${base}/samples/${sample}/index.html`, { waitUntil: "load" });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(300);
      const buf = await page.screenshot({ type: "png" });
      shots.push({ sample, buf });
      await page.close();
      console.log(`  captured ${sample} (${buf.length} bytes)`);
    }
  });

  // Composite using a canvas page
  const cols = 4, rows = 2;
  const cellW = 600, cellH = 375;
  const pad = 10;
  const labelH = 30;
  const totalW = cols * cellW + (cols + 1) * pad;
  const totalH = rows * (cellH + labelH) + (rows + 1) * pad;

  const page = await browser.newPage({ viewport: { width: totalW, height: totalH } });
  await page.setContent(`<!doctype html><html><body><canvas width="${totalW}" height="${totalH}"></canvas></body></html>`);

  const dataUrls = shots.map((s) => `data:image/png;base64,${s.buf.toString("base64")}`);

  const result = await page.evaluate(async ({urls, dims}) => {
    const canvas = document.querySelector("canvas");
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#0c0c0d";
    ctx.fillRect(0, 0, dims.totalW, dims.totalH);

    const labels = ["Copper / Editorial", "Swiss / Atelier", "Maximal / Riot", "Concrete / Brutalist", "Clay / Soft humanist", "Dispatch / Shipping log", "Verge / Clinical evidence"];
    const colors = ["#e08a3a", "#e8482b", "#ff3d8b", "#ff4d00", "#d2774a", "#2dd4a8", "#22a3bd"];

    for (let i = 0; i < urls.length; i++) {
      const col = i % dims.cols;
      const row = Math.floor(i / dims.cols);
      const x = dims.pad + col * (dims.cellW + dims.pad);
      const y = dims.pad + row * (dims.cellH + dims.labelH + dims.pad);

      // Label
      ctx.fillStyle = colors[i];
      ctx.font = "600 16px system-ui, sans-serif";
      ctx.fillText(labels[i], x + 4, y + 20);

      // Image
      const img = new Image();
      img.src = urls[i];
      await new Promise((res) => { img.onload = res; img.onerror = res; });
      ctx.drawImage(img, x, y + dims.labelH, dims.cellW, dims.cellH);

      // Border
      ctx.strokeStyle = "#2a2a2e";
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y + dims.labelH, dims.cellW, dims.cellH);
    }

    return canvas.toDataURL("image/png");
  }, {urls: dataUrls, dims: { cols, rows, cellW, cellH, pad, labelH, totalW, totalH }});

  const outPath = path.join(root, "docs/hero/seven-systems.png");
  const buf = Buffer.from(result.split(",")[1], "base64");
  fs.writeFileSync(outPath, buf);
  console.log(`wrote ${outPath} (${buf.length} bytes, ${totalW}x${totalH})`);

  await page.close();
  await browser.close();
}

main().catch((e) => { console.error(e.message); process.exitCode = 1; });
