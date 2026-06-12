#!/usr/bin/env node
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const page = join(root, "index.html");
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

function assertLandingSkillCoverage() {
  const manifest = JSON.parse(readFileSync(join(root, "skills.json"), "utf8"));
  const landingSkills = manifest.skills.filter((s) => s.landing).map((s) => s.name).sort();
  // Every manifest skill must exist on disk regardless of landing coverage.
  for (const s of manifest.skills) {
    if (!statSync(join(root, "skills", s.name)).isDirectory()) {
      fail(`skills.json lists ${s.name} but skills/${s.name}/ is not a directory`);
    }
  }
  const covered = new Set([...html.matchAll(/data-skill="([^"]+)"/g)].map((match) => match[1]));

  for (const skill of landingSkills) {
    if (!covered.has(skill)) fail(`${rel(page)} does not run ${skill} through the landing page`);
  }
  for (const skill of covered) {
    if (!landingSkills.includes(skill)) fail(`${rel(page)} claims data-skill="${skill}" not marked landing:true in skills.json`);
  }
  if (!/window\.tastecheckLanding=/.test(html)) fail(`${rel(page)} missing landing-page browser contract`);
  const countPattern = new RegExp(`skillCount:\\s*${landingSkills.length}\\b`);
  if (!countPattern.test(html)) {
    fail(`${rel(page)} browser contract does not expose skillCount: ${landingSkills.length} (the landing-covered skills)`);
  }
}

function assertLandingOperatorPaths() {
  const requiredTests = [
    "theme-light",
    "theme-dark",
    "theme-contrast",
    "primary-action",
    "hero-status",
    "state-cycle",
    "state-status",
    "landing-form",
    "email-input",
    "email-status",
    "show-empty",
    "show-error",
    "retry-list",
    "task-list",
    "a11y-focus"
  ];

  for (const name of requiredTests) {
    if (!html.includes(`data-test="${name}"`)) fail(`${rel(page)} missing landing operator data-test="${name}"`);
  }

  for (const fn of ["setTheme", "cycleState", "submitInvalid", "submitValid", "showEmpty", "showError", "retryList", "a11yAudit"]) {
    const exposesFunction = html.includes(`${fn}:`) || new RegExp(`\\b${fn}\\s*,`).test(html);
    if (!exposesFunction) fail(`${rel(page)} landing browser contract missing ${fn}`);
  }
  if (!/window\.a11yAudit=runLandingA11yAudit/.test(html)) fail(`${rel(page)} missing browser-visible a11yAudit contract`);
}

function assertA11yStructure() {
  if (!/<a class="skip" href="#main">/.test(html)) fail(`${rel(page)} missing skip link`);
  if (count(/<main\b/g) !== 1) fail(`${rel(page)} should have exactly one main landmark`);
  if (count(/<h1\b/g) !== 1) fail(`${rel(page)} should have exactly one h1`);
  if (!/<nav\b[^>]*class="menu"[^>]*aria-label="Primary"/.test(html)) fail(`${rel(page)} missing named primary nav`);
  if (count(/aria-live=/g) < 4) fail(`${rel(page)} needs live regions for dynamic landing state updates`);
  if (!/:focus-visible/.test(html)) fail(`${rel(page)} missing visible focus styles`);
  if (!/prefers-reduced-motion:reduce/.test(html)) fail(`${rel(page)} missing reduced-motion guard`);
  if (!/forced-colors:active/.test(html)) fail(`${rel(page)} missing forced-colors guard`);

  const labels = new Set([...html.matchAll(/<label[^>]*for="([^"]+)"/g)].map((match) => match[1]));
  for (const [, tagName, attributes] of html.matchAll(/<(input|select)\b([^>]*)>/g)) {
    const tag = `${tagName}${attributes}`;
    if (/type="hidden"/.test(tag)) continue;
    const id = tag.match(/\bid="([^"]+)"/)?.[1];
    const named = /aria-label=|aria-labelledby=/.test(tag) || (id && labels.has(id));
    if (!named) fail(`${rel(page)} has unnamed landing form control: <${tag.trim()}>`);
  }
}

function assertDataVizIntegrity() {
  const polyline = html.match(/<polyline class="ln landing-trend" points="([^"]+)"/)?.[1] ?? "";
  const pointCount = polyline.trim().split(/\s+/).filter(Boolean).length;
  const table = html.match(/<table id="landing-chart-table"[\s\S]*?<\/table>/)?.[0] ?? "";
  const rowCount = count(/<tr><td>/g, table);
  if (pointCount !== 7) fail(`${rel(page)} expected 7 landing chart points, found ${pointCount}`);
  if (rowCount !== pointCount) fail(`${rel(page)} chart has ${pointCount} points but ${rowCount} table rows`);
  if (!/<title id="landing-chart-title">/.test(html) || !/<desc id="landing-chart-desc">/.test(html)) {
    fail(`${rel(page)} landing chart is missing SVG title/desc`);
  }
}

function assertLandingIsCanonicalProof() {
  const proof = html.match(/<section id="proof">[\s\S]*?<\/section>/)?.[0] ?? "";
  if (!/This landing page is the integration surface/.test(proof)) {
    fail(`${rel(page)} proof section does not make the landing page canonical`);
  }
  if (/demos\/skill-integration\.html/.test(proof)) {
    fail(`${rel(page)} proof section still sends the primary proof journey to the side demo`);
  }
  if (!/GitHub Pages homepage now runs every skill directly/.test(proof)) {
    fail(`${rel(page)} proof section does not claim direct landing-page skill execution`);
  }
}

function assertThemingAndColorTokens() {
  for (const theme of ['data-theme="dark"', 'data-theme="light"', 'data-theme="contrast"']) {
    if (!html.includes(theme)) fail(`${rel(page)} missing ${theme}`);
  }
  if (count(/oklch\(/g) < 20) fail(`${rel(page)} should use OKLCH tokenized landing colors`);
  if (!/data-test\^="theme-"/.test(html)) fail(`${rel(page)} missing page-level theme button wiring`);
}

assertLandingSkillCoverage();
assertLandingOperatorPaths();
assertA11yStructure();
assertDataVizIntegrity();
assertLandingIsCanonicalProof();
assertThemingAndColorTokens();

if (failures.length) {
  console.error(`landing verification failed (${failures.length})`);
  for (const item of failures) console.error(`- ${item}`);
  process.exit(1);
}

console.log("landing verification passed");
