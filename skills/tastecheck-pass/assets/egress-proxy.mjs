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

async function refused(host, port, scheme) {
  const bare = host.replace(/^\[|\]$/g, "");
  if (isBlockedRequest(`${scheme}://${bare.includes(":") ? `[${bare}]` : bare}:${port}/`, null)) return true;
  try {
    const { address } = await lookup(bare);
    return isBlockedRequest(`${scheme}://${address.includes(":") ? `[${address}]` : address}:${port}/`, null);
  } catch { return true; } // cannot resolve: nothing to forward to
}

const parseHostPort = (s, dflt) => { const m = /^(\[[^\]]+\]|[^:]+)(?::(\d+))?$/.exec(s); return m ? [m[1], Number(m[2] || dflt)] : [null, 0]; };

/** Start the proxy on 127.0.0.1:<random>. Resolves { port, blocked, close }. */
export async function startEgressProxy() {
  const blocked = [];
  const sockets = new Set();
  const server = createServer();
  server.on("connection", (s) => { sockets.add(s); s.on("close", () => sockets.delete(s)); });
  const deny = (res, what) => { blocked.push(what); try { res.writeHead(403); res.end("blocked by tastecheck egress proxy"); } catch { /* gone */ } };

  // Plain http:// and ws:// requests arrive with an absolute URL.
  const forward = async (req, res, isUpgrade, clientSocket, head) => {
    let u; try { u = new URL(req.url); } catch { return isUpgrade ? clientSocket.destroy() : deny(res, req.url); }
    const port = Number(u.port || 80);
    if (await refused(u.hostname, port, "http")) { blocked.push(req.url); return isUpgrade ? clientSocket.destroy() : deny(res, req.url); }
    const headers = { ...req.headers }; delete headers["proxy-connection"];
    const up = httpRequest({ host: u.hostname.replace(/^\[|\]$/g, ""), port, method: req.method, path: u.pathname + u.search, headers });
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
    if (!host || await refused(host, port, "https").catch(() => true)) { blocked.push(`CONNECT ${req.url}`); clientSocket.end("HTTP/1.1 403 Forbidden\r\n\r\n"); return; }
    const up = netConnect(port, host.replace(/^\[|\]$/g, ""), () => { clientSocket.write("HTTP/1.1 200 Connection Established\r\n\r\n"); if (head.length) up.write(head); up.pipe(clientSocket); clientSocket.pipe(up); });
    up.on("error", () => clientSocket.destroy()); clientSocket.on("close", () => up.destroy());
  });

  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  return {
    port: server.address().port,
    blocked,
    close: () => new Promise((r) => { for (const s of sockets) s.destroy(); server.close(() => r()); }),
  };
}
