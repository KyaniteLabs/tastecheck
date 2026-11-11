/* egress-proxy.mjs — a tiny filtering forward proxy for the audit browser.
   Chrome is launched with --proxy-server pointing here and "<-loopback>" in its bypass
   list, so EVERY request the audited page makes (fetch, images, iframes, Web Workers,
   WebSocket handshakes, redirects) reaches this proxy except the served origin, which is
   bypassed directly. Requests to loopback, link-local and private hosts are refused, by
   name (request-guard.mjs) and by the address DNS returns (so a public name that resolves
   to a private address is refused too). Everything else is forwarded untouched. */
import { createServer, request as httpRequest } from "node:http";
import { connect as netConnect } from "node:net";
import { lookup } from "node:dns/promises";
import { isBlockedRequest } from "./request-guard.mjs";

/* Resolve once, vet every address, and return the IP to dial (null = refuse). Dialling the
   vetted IP, never the hostname, closes DNS rebinding and a connect that would fall through
   to a second, private A record. */
async function vetted(host, port, scheme, resolve) {
  const bare = host.replace(/^\[|\]$/g, "");
  const url = (a) => `${scheme}://${a.includes(":") ? `[${a}]` : a}:${port}/`;
  if (isBlockedRequest(url(bare), null)) return null;
  try {
    const all = await resolve(bare);
    if (!all.length || all.some(({ address }) => isBlockedRequest(url(address), null))) return null;
    return all[0].address;
  } catch { return null; } // cannot resolve: nothing to forward to
}

const parseHostPort = (s, dflt) => { const m = /^(\[[^\]]+\]|[^:]+)(?::(\d+))?$/.exec(s); return m ? [m[1], Number(m[2] || dflt)] : [null, 0]; };

/** Start the proxy on 127.0.0.1:<random>. Resolves { port, blocked, close }.
    resolve and connect are injectable for offline tests. */
export async function startEgressProxy({ resolve = (h) => lookup(h, { all: true }), connect = netConnect } = {}) {
  const blocked = [];
  const sockets = new Set();
  const server = createServer();
  server.on("connection", (s) => { sockets.add(s); s.on("close", () => sockets.delete(s)); });
  const deny = (res, what) => { blocked.push(what); try { res.writeHead(403); res.end("blocked by tastecheck egress proxy"); } catch { /* gone */ } };

  // Plain http:// and ws:// requests arrive with an absolute URL.
  const forward = async (req, res, isUpgrade, clientSocket, head) => {
    let u; try { u = new URL(req.url); } catch { return isUpgrade ? clientSocket.destroy() : deny(res, req.url); }
    const port = Number(u.port || 80);
    const ip = await vetted(u.hostname, port, "http", resolve);
    if (!ip) { blocked.push(req.url); return isUpgrade ? clientSocket.destroy() : deny(res, req.url); }
    const headers = { ...req.headers }; delete headers["proxy-connection"];
    const up = httpRequest({ host: ip, port, method: req.method, path: u.pathname + u.search, headers });
    if (isUpgrade) {
      up.on("upgrade", (ur, us, uh) => {
        clientSocket.write(`HTTP/1.1 101 Switching Protocols\r\n${Object.entries(ur.headers).map(([k, v]) => `${k}: ${v}`).join("\r\n")}\r\n\r\n`);
        if (uh && uh.length) clientSocket.write(uh);
        us.pipe(clientSocket).pipe(us); us.on("error", () => clientSocket.destroy()); clientSocket.on("error", () => us.destroy());
      });
      up.on("error", () => clientSocket.destroy());
      up.end(head);
    } else {
      up.on("response", (ur) => { res.writeHead(ur.statusCode, ur.headers); ur.pipe(res); });
      up.on("error", () => { try { res.writeHead(502); res.end(); } catch { /* gone */ } });
      req.pipe(up);
    }
  };
  server.on("request", (req, res) => { forward(req, res, false).catch(() => { try { res.destroy(); } catch { /* gone */ } }); });
  server.on("upgrade", (req, socket, head) => { forward(req, null, true, socket, head).catch(() => socket.destroy()); });

  // https:// and wss:// (and ws:// via CONNECT) are tunnelled.
  server.on("connect", async (req, clientSocket, head) => {
    const [host, port] = parseHostPort(req.url, 443);
    clientSocket.on("error", () => {});
    const ip = host ? await vetted(host, port, "https", resolve) : null;
    if (!ip) { blocked.push(`CONNECT ${req.url}`); clientSocket.end("HTTP/1.1 403 Forbidden\r\n\r\n"); return; }
    const up = connect(port, ip, () => { clientSocket.write("HTTP/1.1 200 Connection Established\r\n\r\n"); if (head.length) up.write(head); up.pipe(clientSocket); clientSocket.pipe(up); });
    up.on("error", () => clientSocket.destroy()); clientSocket.on("close", () => up.destroy());
  });

  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  return {
    port: server.address().port,
    blocked,
    close: () => new Promise((r) => { for (const s of sockets) s.destroy(); server.close(() => r()); }),
  };
}
