/* request-guard.mjs — decides which network requests the audited page may make.
   Used by cdp-qa.mjs through CDP Fetch: a page under audit is untrusted, so it must
   not reach loopback, link-local or private-network services (cloud metadata, routers,
   dev databases) except the single origin being served.
   Name-based: it judges the URL's host as written. A public hostname that DNS-resolves
   to a private address is not caught here. Zero dependencies. */

const NETWORK_SCHEMES = new Set(["http:", "https:", "ws:", "wss:", "ftp:"]);
const INTERNAL_SUFFIXES = [".localhost", ".local", ".localdomain", ".internal", ".lan", ".home.arpa"];

function v4Internal(a, b) {
  return a === 0 || a === 10 || a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19));
}

/* Expand a URL-normalised IPv6 literal (no brackets) into eight 16-bit groups, or null. */
function v6Groups(s) {
  let head = s, tail = "";
  if (s.includes("::")) [head, tail] = s.split("::");
  const part = (x) => (x === "" ? [] : x.split(":"));
  const h = part(head), t = part(tail);
  const dotted = (g) => g.flatMap((x) => {
    const m = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(x);
    return m ? [((+m[1] << 8) | +m[2]).toString(16), ((+m[3] << 8) | +m[4]).toString(16)] : [x];
  });
  const hh = dotted(h), tt = dotted(t);
  const fill = s.includes("::") ? 8 - hh.length - tt.length : 0;
  if (fill < 0 || (!s.includes("::") && hh.length !== 8)) return null;
  const all = [...hh, ...Array(fill).fill("0"), ...tt].map((x) => parseInt(x, 16));
  return all.length === 8 && all.every((n) => Number.isInteger(n) && n >= 0 && n <= 0xffff) ? all : null;
}

function v6Internal(s) {
  const g = v6Groups(s);
  if (!g) return true; // cannot parse: fail closed
  if (g.every((n) => n === 0) || (g.slice(0, 7).every((n) => n === 0) && g[7] === 1)) return true; // :: and ::1
  if ((g[0] & 0xfe00) === 0xfc00 || (g[0] & 0xffc0) === 0xfe80) return true; // fc00::/7 ULA, fe80::/10 link-local
  const embedded = (g[6] >> 8) & 0xff, embeddedB = g[6] & 0xff;
  if (g.slice(0, 5).every((n) => n === 0) && g[5] === 0xffff) return v4Internal(embedded, embeddedB); // ::ffff:a.b.c.d
  if (g[0] === 0x64 && g[1] === 0xff9b && g.slice(2, 6).every((n) => n === 0)) return v4Internal(embedded, embeddedB); // 64:ff9b::/96 NAT64
  return false;
}

function hostInternal(hostname) {
  let h = hostname.toLowerCase().replace(/\.$/, "");
  if (h.startsWith("[") && h.endsWith("]")) return v6Internal(h.slice(1, -1));
  const m = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(h); // the URL parser has already normalised decimal/hex/short forms
  if (m) return v4Internal(+m[1], +m[2]);
  if (h === "localhost" || !h.includes(".")) return true; // localhost and single-label intranet names
  return INTERNAL_SUFFIXES.some((x) => h.endsWith(x));
}

/** true = fail this request. allowedOrigin: the served http(s) origin, or null (file target). */
export function isBlockedRequest(rawUrl, allowedOrigin = null) {
  let u;
  try { u = new URL(rawUrl); } catch { return /^(https?|wss?|ftp):/i.test(String(rawUrl)); }
  if (!NETWORK_SCHEMES.has(u.protocol)) return false; // data:, blob:, about:, file: never leave the machine
  if (allowedOrigin) {
    const a = new URL(allowedOrigin);
    const sameHost = u.host === a.host && (u.protocol === a.protocol || (u.protocol === "ws:" && a.protocol === "http:") || (u.protocol === "wss:" && a.protocol === "https:"));
    if (sameHost) return false;
  }
  return hostInternal(u.hostname);
}
