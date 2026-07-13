import { appendFileSync } from "node:fs";

export function recordQaCase(id) {
  const path = process.env.TASTECHECK_V2_QA_EVENTS;
  if (!path) return;
  appendFileSync(path, `${JSON.stringify({ id, state: "passed" })}\n`, { encoding: "utf8", mode: 0o600 });
}
