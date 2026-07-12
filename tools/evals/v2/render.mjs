#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { captureRenders } from "./lib/render.mjs";

const fixturePath = process.argv[2];
if (!fixturePath) throw new Error("usage: render.mjs <local-render-input.json>");
const input = JSON.parse(readFileSync(fixturePath, "utf8"));
process.stdout.write(`${JSON.stringify(captureRenders(input))}\n`);
