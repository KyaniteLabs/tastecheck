// egress-proxy self-check: DNS rebinding. The proxy must vet EVERY address a name resolves
// to and connect to the vetted IP, never re-resolving the hostname. Offline, no browser.
import { connect as netConnect } from "node:net";
import { startEgressProxy } from "../../skills/tastecheck-pass/assets/egress-proxy.mjs";

let failed = 0;
const check = (ok, msg) => { if (!ok) { failed++; console.error(`FAIL ${msg}`); } else console.log(`ok   ${msg}`); };

async function connectVia(proxyPort, target) {
  return new Promise((resolve) => {
    const s = netConnect(proxyPort, "127.0.0.1", () => s.write(`CONNECT ${target} HTTP/1.1\r\nHost: ${target}\r\n\r\n`));
    let buf = "";
    s.on("data", (d) => { buf += d; if (buf.includes("\r\n\r\n")) { s.destroy(); resolve(buf.split("\r\n")[0]); } });
    s.on("error", () => resolve("error"));
    s.on("close", () => resolve(buf.split("\r\n")[0] || "closed"));
  });
}

const answers = {
  "mixed.test": ["93.184.216.34", "10.0.0.5"],
  "mixed-v6.test": ["93.184.216.34", "::1"],
  "private.test": ["192.168.1.9"],
  "public.test": ["93.184.216.34", "93.184.216.35"],
};
const dialed = [];
const proxy = await startEgressProxy({
  resolve: async (h) => (answers[h] || []).map((address) => ({ address, family: address.includes(":") ? 6 : 4 })),
  connect: (port, ip, cb) => { dialed.push(`${ip}:${port}`); return netConnect({ port: 1, host: "127.0.0.1" }, cb); },
});
try {
  check((await connectVia(proxy.port, "mixed.test:443")).includes("403"), "a name with one public and one private address is refused");
  check((await connectVia(proxy.port, "mixed-v6.test:443")).includes("403"), "a name with a public address and ::1 is refused");
  check((await connectVia(proxy.port, "private.test:443")).includes("403"), "a name resolving only to a private address is refused");
  check(dialed.length === 0, `refused names are never dialled (dialled: ${JSON.stringify(dialed)})`);
  await connectVia(proxy.port, "public.test:443");
  check(dialed.length === 1 && dialed[0] === "93.184.216.34:443", `a vetted name is dialled by its vetted IP, not its hostname (dialled: ${JSON.stringify(dialed)})`);
} finally { await proxy.close(); }
if (failed) { console.error(`${failed} check(s) failed`); process.exit(1); }
console.log("egress-proxy: all checks passed");
