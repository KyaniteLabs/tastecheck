// request-guard self-check: the audited page must not reach loopback or private
// network services, except the origin being served. Pure logic, no browser.
import { isBlockedRequest, proxyBypassEntry } from "../../skills/tastecheck-pass/assets/request-guard.mjs";

let failed = 0;
const check = (ok, msg) => { if (!ok) { failed++; console.error(`FAIL ${msg}`); } else console.log(`ok   ${msg}`); };
const SERVED = "http://127.0.0.1:4173";

const blocked = [
  "http://127.0.0.1:9999/x", "http://localhost/x", "http://LOCALHOST./x", "http://foo.localhost/x",
  "http://[::1]/x", "http://[::]/x", "http://0.0.0.0/x", "http://127.1/x", "http://2130706433/x", "http://0x7f.0.0.1/x",
  "http://10.1.2.3/x", "http://172.16.0.1/x", "http://172.31.255.255/x", "http://192.168.1.1/x",
  "http://169.254.169.254/latest/meta-data", "http://100.64.0.1/x", "http://198.18.0.1/x",
  "http://[fc00::1]/x", "http://[fd12:3456::1]/x", "http://[fe80::1]/x",
  "http://[::ffff:127.0.0.1]/x", "http://[::ffff:10.0.0.1]/x", "http://[64:ff9b::7f00:1]/x",
  "ws://127.0.0.1:9999/socket", "https://router.local/x", "http://nas.internal/x", "http://intranet/x",
  "http://127.0.0.1:4174/other-port", // same host, different port is a different origin
];
const allowed = [
  "https://example.com/x", "http://93.184.216.34/x", "http://172.32.0.1/x", "http://172.15.255.255/x",
  "https://fonts.googleapis.com/css", "http://[2606:4700::1111]/x", "http://100.63.255.255/x",
  "data:text/plain,hi", "blob:http://127.0.0.1:4173/abc", "about:blank", "file:///tmp/a.png",
  `${SERVED}/app.css`, `${SERVED}/api/x?y=1`, "ws://127.0.0.1:4173/live",
];
for (const u of blocked) check(isBlockedRequest(u, SERVED) === true, `blocks ${u}`);
for (const u of allowed) check(isBlockedRequest(u, SERVED) === false, `allows ${u}`);
check(isBlockedRequest("http://127.0.0.1:4173/x", null) === true, "no served origin (file target): loopback is blocked");
check(isBlockedRequest("https://example.com/x", null) === false, "no served origin: public host allowed");
check(isBlockedRequest("http://[bad/x", SERVED) === true, "unparseable network URL fails closed");
// the proxy-bypass entry must always carry the effective port: a bare host would bypass
// the proxy for EVERY port on that host (default-port URLs have no port in URL.host).
const entries = [
  ["http://localhost/", "localhost:80"], ["https://localhost/", "localhost:443"],
  ["http://localhost:80/x", "localhost:80"], ["https://127.0.0.1:443/", "127.0.0.1:443"],
  ["http://127.0.0.1:4173/", "127.0.0.1:4173"], ["http://[::1]/", "[::1]:80"],
  ["https://[::1]:8443/", "[::1]:8443"], ["http://example.test:8080/a", "example.test:8080"],
];
for (const [u, want] of entries) check(proxyBypassEntry(u) === want, `bypass entry for ${u} is ${want} (got ${proxyBypassEntry(u)})`);
check(proxyBypassEntry("file:///tmp/a.html") === null, "bypass entry: file target has none");
import { readFileSync } from "node:fs";
const qa = readFileSync(new URL("../../skills/tastecheck-pass/assets/cdp-qa.mjs", import.meta.url), "utf8");
check(/proxyBypassEntry\(url\)/.test(qa) && !/new URL\(url\)\.host/.test(qa), "cdp-qa builds the bypass entry with proxyBypassEntry, never URL.host");
if (failed) { console.error(`${failed} check(s) failed`); process.exit(1); }
console.log("request-guard: all checks passed");
