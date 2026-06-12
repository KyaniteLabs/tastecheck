#!/usr/bin/env node
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const page = join(root, "demos", "skill-integration.html");
const html = readFileSync(page, "utf8");
const failures = [];

function fail(message) {
  failures.push(message);
}

function rel(path) {
  return relative(root, path);
}

function count(pattern, text = html) {
  return [...text.matchAll(pattern)].length;
}

function assertSkillCoverage() {
  const manifest = JSON.parse(readFileSync(join(root, "skills.json"), "utf8"));
  const integrationSkills = manifest.skills.filter((s) => s.landing).map((s) => s.name).sort();
  const covered = new Set([...html.matchAll(/data-skill="([^"]+)"/g)].map((match) => match[1]));

  for (const skill of integrationSkills) {
    if (!covered.has(skill)) fail(`${rel(page)} does not exercise ${skill}`);
  }
  for (const skill of covered) {
    if (!integrationSkills.includes(skill)) {
      fail(`${rel(page)} claims data-skill="${skill}" not marked landing:true in skills.json`);
    }
  }
  const countPattern = new RegExp(`skillCount:\\s*${integrationSkills.length}\\b`);
  if (!countPattern.test(html)) {
    fail(`${rel(page)} browser test contract does not expose skillCount: ${integrationSkills.length}`);
  }
}

function assertOperatorControls() {
  const requiredTests = [
    "theme-light",
    "theme-dark",
    "theme-contrast",
    "primary-action",
    "state-cycle",
    "station-form",
    "station",
    "item",
    "count",
    "submit-count",
    "form-status",
    "show-empty",
    "show-error",
    "retry-list",
    "task-list"
  ];

  for (const name of requiredTests) {
    if (!html.includes(`data-test="${name}"`)) fail(`${rel(page)} missing operator control data-test="${name}"`);
  }

  for (const fn of ["setTheme", "cycleState", "submitInvalid", "submitValid", "showEmpty", "showError", "retryList"]) {
    const exposesFunction = html.includes(`${fn}:`) || new RegExp(`\\b${fn}\\s*,`).test(html);
    if (!exposesFunction) fail(`${rel(page)} browser test contract missing ${fn}`);
  }
}

function assertA11yStructure() {
  if (!/<a class="skip" href="#main">/.test(html)) fail(`${rel(page)} missing skip link`);
  if (count(/<main\b/g) !== 1) fail(`${rel(page)} should have exactly one main landmark`);
  if (count(/<h1\b/g) !== 1) fail(`${rel(page)} should have exactly one h1`);
  if (!/<nav\b[^>]*aria-label="Primary"/.test(html)) fail(`${rel(page)} missing named primary nav`);
  if (count(/aria-live=/g) < 4) fail(`${rel(page)} needs live regions for dynamic state updates`);
  if (!/:focus-visible/.test(html)) fail(`${rel(page)} missing visible focus styles`);
  if (!/prefers-reduced-motion:reduce/.test(html)) fail(`${rel(page)} missing reduced-motion guard`);
  if (!/forced-colors:active/.test(html)) fail(`${rel(page)} missing forced-colors guard`);

  const labels = new Set([...html.matchAll(/<label[^>]*for="([^"]+)"/g)].map((match) => match[1]));
  for (const [, tagName, attributes] of html.matchAll(/<(input|select)\b([^>]*)>/g)) {
    const tag = `${tagName}${attributes}`;
    if (/type="hidden"/.test(tag)) continue;
    const id = tag.match(/\bid="([^"]+)"/)?.[1];
    const named = /aria-label=|aria-labelledby=/.test(tag) || (id && labels.has(id));
    if (!named) fail(`${rel(page)} has unnamed form control: <${tag.trim()}>`);
  }
}

function assertDataVizIntegrity() {
  const polyline = html.match(/<polyline class="trend" points="([^"]+)"/)?.[1] ?? "";
  const pointCount = polyline.trim().split(/\s+/).filter(Boolean).length;
  const table = html.match(/<table id="waste-chart-table">([\s\S]*?)<\/table>/)?.[1] ?? "";
  const rowCount = count(/<tr><td>/g, table);
  if (pointCount !== 7) fail(`${rel(page)} expected 7 plotted chart points, found ${pointCount}`);
  if (rowCount !== pointCount) fail(`${rel(page)} chart has ${pointCount} points but ${rowCount} table rows`);
  if (!/<title id="chart-title">/.test(html) || !/<desc id="chart-desc">/.test(html)) {
    fail(`${rel(page)} chart is missing SVG title/desc`);
  }
}

function assertDeslopAndCopy() {
  const liveMarketing = html
    .replace(/<article class="panel span-4" data-audit-drift>[\s\S]*?<\/article>/, "")
    .replace(/<blockquote>This product helps kitchens do everything faster\.<\/blockquote>/, "");
  const banned = [
    "Supercharge",
    "Lightning Fast",
    "Secure",
    "all-in-one platform",
    "everything you need in one place",
    "streamline"
  ];
  for (const phrase of banned) {
    if (liveMarketing.includes(phrase)) fail(`${rel(page)} still contains generic live-copy phrase: ${phrase}`);
  }
}

function assertResponsiveAndTheming() {
  if (!/@media\(max-width:860px\)/.test(html)) fail(`${rel(page)} missing mobile layout media query`);
  if (!/grid-template-columns:minmax\(0,1\.25fr\)/.test(html)) fail(`${rel(page)} missing intrinsic hero grid`);
  for (const theme of ['data-theme="light"', 'data-theme="dark"', 'data-theme="contrast"']) {
    if (!html.includes(theme)) fail(`${rel(page)} missing ${theme}`);
  }
  if (count(/oklch\(/g) < 12) fail(`${rel(page)} should use OKLCH tokenized colors`);
}

assertSkillCoverage();
assertOperatorControls();
assertA11yStructure();
assertDataVizIntegrity();
assertDeslopAndCopy();
assertResponsiveAndTheming();

if (failures.length) {
  console.error(`integration verification failed (${failures.length})`);
  for (const item of failures) console.error(`- ${item}`);
  process.exit(1);
}

console.log("integration verification passed");
