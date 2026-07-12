import { createHash } from "node:crypto";
import { closeSync, fsyncSync, openSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const digest = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const verifyEvent = (event) => digest(Object.fromEntries(Object.entries(event).filter(([key]) => key !== "event_sha256"))) === event.event_sha256;

export function appendEvent(path, previous, event) {
  if (previous && !verifyEvent(previous)) throw new Error("invalid predecessor hash");
  const predecessor_sha256 = previous ? previous.event_sha256 : null;
  const value = { ...event, predecessor_sha256 };
  const closed = { ...value, event_sha256: digest(value) };
  if (path) {
    const lock = `${path}.lock`; let fd;
    try { fd = openSync(lock, "wx", 0o600); } catch { throw new Error("ledger append lock held"); }
    try {
      let existing = ""; try { existing = readFileSync(path, "utf8").trim(); } catch {}
      const events = existing ? existing.split("\n").map(JSON.parse) : [];
      validateLedger(events);
      if ((events.at(-1)?.event_sha256 ?? null) !== (previous?.event_sha256 ?? null)) throw new Error("ledger predecessor mismatch or deletion");
      const temp = `${path}.next`;
      rmSync(temp, { force: true });
      writeFileSync(temp, `${events.map(JSON.stringify).join("\n")}${events.length ? "\n" : ""}${JSON.stringify(closed)}\n`, { mode: 0o600, flush: true, flag: "wx" });
      renameSync(temp, path);
      const directory = openSync(dirname(path), "r");
      try { fsyncSync(directory); } finally { closeSync(directory); }
    } finally { if (fd !== undefined) closeSync(fd); rmSync(lock, { force: true }); }
  }
  return closed;
}

export function validateLedger(events) {
  events.forEach((event, index) => {
    if (!verifyEvent(event)) throw new Error("ledger event hash mismatch");
    if (index === 0 && event.predecessor_sha256 !== null) throw new Error("invalid initial predecessor");
    if (index && event.predecessor_sha256 !== events[index - 1].event_sha256) throw new Error("ledger predecessor mismatch");
  });
  return true;
}
