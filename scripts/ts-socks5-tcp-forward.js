#!/usr/bin/env node
/*
  Minimal TCP forwarder that connects to a target host:port via a local SOCKS5 server.
  Intended for environments where Tailscale runs in userspace networking (no kernel TUN),
  so apps can reach tailnet services by connecting to localhost.

  Usage:
    node ts-socks5-tcp-forward.js \
      --listen-host 127.0.0.1 --listen-port 15432 \
      --socks-host 127.0.0.1 --socks-port 1055 \
      --target-host 100.87.30.117 --target-port 5432
*/

const net = require('net');

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const key = argv[i];
    if (!key.startsWith('--')) continue;
    const name = key.slice(2);
    const value = argv[i + 1];
    if (value == null || value.startsWith('--')) {
      args[name] = 'true';
    } else {
      args[name] = value;
      i++;
    }
  }
  return args;
}

function isIPv4(host) {
  return net.isIP(host) === 4;
}

function isIPv6(host) {
  return net.isIP(host) === 6;
}

function ipv4ToBytes(ip) {
  return Buffer.from(ip.split('.').map((s) => Number(s) & 0xff));
}

function ipv6ToBytes(ip) {
  // Node can parse many IPv6 forms; normalize using URL.
  // This yields 16 bytes.
  const normalized = new URL(`http://[${ip}]/`).hostname;
  const parts = normalized.split(':');
  // Expand ::
  const emptyIndex = parts.indexOf('');
  if (emptyIndex !== -1) {
    // There may be multiple empty strings due to leading/trailing ::
    const firstEmpty = parts.findIndex((p) => p === '');
    const lastEmpty = parts.length - 1 - [...parts].reverse().findIndex((p) => p === '');
    const left = parts.slice(0, firstEmpty).filter((p) => p.length);
    const right = parts.slice(lastEmpty + 1).filter((p) => p.length);
    const missing = 8 - (left.length + right.length);
    const expanded = [...left, ...Array(missing).fill('0'), ...right];
    return Buffer.concat(expanded.map((p) => {
      const n = parseInt(p, 16) & 0xffff;
      const b = Buffer.alloc(2);
      b.writeUInt16BE(n, 0);
      return b;
    }));
  }

  return Buffer.concat(parts.map((p) => {
    const n = parseInt(p || '0', 16) & 0xffff;
    const b = Buffer.alloc(2);
    b.writeUInt16BE(n, 0);
    return b;
  }));
}

function buildSocksConnectRequest(targetHost, targetPort) {
  const portBuf = Buffer.alloc(2);
  portBuf.writeUInt16BE(Number(targetPort) & 0xffff, 0);

  if (isIPv4(targetHost)) {
    return Buffer.concat([
      Buffer.from([0x05, 0x01, 0x00, 0x01]),
      ipv4ToBytes(targetHost),
      portBuf,
    ]);
  }

  if (isIPv6(targetHost)) {
    return Buffer.concat([
      Buffer.from([0x05, 0x01, 0x00, 0x04]),
      ipv6ToBytes(targetHost),
      portBuf,
    ]);
  }

  const hostBuf = Buffer.from(String(targetHost), 'utf8');
  if (hostBuf.length > 255) {
    throw new Error('target host too long for SOCKS5 domain form');
  }

  return Buffer.concat([
    Buffer.from([0x05, 0x01, 0x00, 0x03, hostBuf.length]),
    hostBuf,
    portBuf,
  ]);
}

function readExact(socket, n, timeoutMs) {
  return new Promise((resolve, reject) => {
    let buf = Buffer.alloc(0);

    const onData = (chunk) => {
      buf = Buffer.concat([buf, chunk]);
      if (buf.length >= n) {
        cleanup();
        const head = buf.subarray(0, n);
        const rest = buf.subarray(n);
        if (rest.length) socket.unshift(rest);
        resolve(head);
      }
    };

    const onError = (err) => {
      cleanup();
      reject(err);
    };

    const onClose = () => {
      cleanup();
      reject(new Error('socket closed before enough data'));
    };

    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('timeout waiting for data'));
    }, timeoutMs);

    const cleanup = () => {
      clearTimeout(timer);
      socket.off('data', onData);
      socket.off('error', onError);
      socket.off('close', onClose);
    };

    socket.on('data', onData);
    socket.on('error', onError);
    socket.on('close', onClose);
  });
}

async function connectViaSocks5({ socksHost, socksPort, targetHost, targetPort, timeoutMs }) {
  const sock = net.connect({ host: socksHost, port: Number(socksPort) });

  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout connecting to SOCKS server')), timeoutMs);
    sock.once('connect', () => {
      clearTimeout(timer);
      resolve();
    });
    sock.once('error', (e) => {
      clearTimeout(timer);
      reject(e);
    });
  });

  // Greeting: VER=5, NMETHODS=1, METHOD=0x00 (no auth)
  sock.write(Buffer.from([0x05, 0x01, 0x00]));
  const method = await readExact(sock, 2, timeoutMs);
  if (method[0] !== 0x05 || method[1] !== 0x00) {
    throw new Error(`SOCKS5 auth method not accepted (got ${method.toString('hex')})`);
  }

  // CONNECT request
  sock.write(buildSocksConnectRequest(targetHost, targetPort));

  const header = await readExact(sock, 4, timeoutMs);
  const ver = header[0];
  const rep = header[1];
  const atyp = header[3];

  if (ver !== 0x05) {
    throw new Error(`invalid SOCKS version in reply: ${ver}`);
  }
  if (rep !== 0x00) {
    throw new Error(`SOCKS CONNECT failed with REP=0x${rep.toString(16)}`);
  }

  // Consume BND.ADDR + BND.PORT (we don't use them)
  if (atyp === 0x01) {
    await readExact(sock, 4 + 2, timeoutMs);
  } else if (atyp === 0x04) {
    await readExact(sock, 16 + 2, timeoutMs);
  } else if (atyp === 0x03) {
    const lenBuf = await readExact(sock, 1, timeoutMs);
    const len = lenBuf[0];
    await readExact(sock, len + 2, timeoutMs);
  } else {
    throw new Error(`unknown ATYP in reply: ${atyp}`);
  }

  return sock;
}

function startForwarder({ listenHost, listenPort, socksHost, socksPort, targetHost, targetPort, timeoutMs }) {
  const server = net.createServer(async (client) => {
    client.setNoDelay(true);

    let upstream;
    try {
      upstream = await connectViaSocks5({
        socksHost,
        socksPort,
        targetHost,
        targetPort,
        timeoutMs,
      });
      upstream.setNoDelay(true);
    } catch (e) {
      client.destroy(e);
      return;
    }

    const cleanup = () => {
      try { client.destroy(); } catch {}
      try { upstream.destroy(); } catch {}
    };

    client.on('error', cleanup);
    upstream.on('error', cleanup);
    client.on('close', cleanup);
    upstream.on('close', cleanup);

    client.pipe(upstream);
    upstream.pipe(client);
  });

  server.on('error', (err) => {
    // eslint-disable-next-line no-console
    console.error('[ts-forward] server error:', err);
    process.exit(1);
  });

  server.listen({ host: listenHost, port: Number(listenPort) }, () => {
    // eslint-disable-next-line no-console
    console.log(
      `[ts-forward] listening on ${listenHost}:${listenPort} -> socks5 ${socksHost}:${socksPort} -> ${targetHost}:${targetPort}`,
    );
  });
}

(function main() {
  const args = parseArgs(process.argv);

  const listenHost = args['listen-host'] || process.env.TS_FORWARD_LISTEN_HOST || '127.0.0.1';
  const listenPort = args['listen-port'] || process.env.TS_FORWARD_LISTEN_PORT || '15432';
  const socksHost = args['socks-host'] || process.env.TS_SOCKS_HOST || '127.0.0.1';
  const socksPort = args['socks-port'] || process.env.TS_SOCKS_PORT || '1055';
  const targetHost = args['target-host'] || process.env.TS_FORWARD_TARGET_HOST;
  const targetPort = args['target-port'] || process.env.TS_FORWARD_TARGET_PORT || '5432';
  const timeoutMs = Number(args['timeout-ms'] || process.env.TS_FORWARD_TIMEOUT_MS || 8000);

  if (!targetHost) {
    // eslint-disable-next-line no-console
    console.error('[ts-forward] missing --target-host (or TS_FORWARD_TARGET_HOST)');
    process.exit(2);
  }

  startForwarder({
    listenHost,
    listenPort,
    socksHost,
    socksPort,
    targetHost,
    targetPort,
    timeoutMs,
  });
})();
