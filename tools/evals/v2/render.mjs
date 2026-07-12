#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { captureRenders, getLocalRenderManifest } from "./lib/render.mjs";

const fixturePath = process.argv[2];
if (fixturePath === "--identity") {
  const viewports = JSON.parse(process.argv[3] ?? "[]");
  process.stdout.write(`${JSON.stringify(await getLocalRenderManifest(viewports))}\n`);
  process.exit(0);
}
if (!fixturePath) throw new Error("usage: render.mjs <local-render-input.json>; or: render.mjs --identity '<viewports-json>'");
const input = JSON.parse(readFileSync(fixturePath, "utf8"));
process.stdout.write(`${JSON.stringify(await captureRenders(input))}\n`);
