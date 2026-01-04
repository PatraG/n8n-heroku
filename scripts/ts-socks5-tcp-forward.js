#!/usr/bin/env node

const net = require('net');
const { spawn } = require('child_process');

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const key = argv[i];
    if (!key.startsWith('--')) continue;
    const name = key.slice(2);
    const value = argv[i + 1];
    args[name] = value;
    i++;
  }
  return args;
}

function required(args, name) {
  const v = args[name];
  if (!v) {
    console.error(`Missing required arg --${name}`);
    process.exit(1);
  }
  return v;
}

function parsePort(s, name) {
  const n = Number(s);
  if (!Number.isInteger(n) || n <= 0 || n > 65535) {
    console.error(`Invalid --${name}: ${s}`);
    process.exit(1);
  }
  return n;
}

function forwardViaTailscaleNc({ socketPath, targetHost, targetPort }) {
  const cmd = '/usr/local/bin/tailscale';
  const args = ['--socket', socketPath, 'nc', targetHost, String(targetPort)];
  return spawn(cmd, args, { stdio: ['pipe', 'pipe', 'pipe'] });
}

async function main() {
  const args = parseArgs(process.argv);
  const listenHost = required(args, 'listen-host');
  const listenPort = parsePort(required(args, 'listen-port'), 'listen-port');
  const targetHost = required(args, 'target-host');
  const targetPort = parsePort(required(args, 'target-port'), 'target-port');

  const tailscaleSocket = args['tailscale-socket'] || '/tmp/tailscaled.sock';

  const server = net.createServer((client) => {
    client.setNoDelay(true);
    const clientAddr = `${client.remoteAddress || 'unknown'}:${client.remotePort || 'unknown'}`;

    const upstream = forwardViaTailscaleNc({
      socketPath: tailscaleSocket,
      targetHost,
      targetPort,
    });

    upstream.stdin.on('error', () => {});
    upstream.stdout.on('error', () => {});
    upstream.stderr.on('data', (buf) => {
      const msg = String(buf).trim();
      if (msg) console.error(`[forwarder] tailscale nc stderr (${clientAddr}): ${msg}`);
    });

    client.pipe(upstream.stdin);
    upstream.stdout.pipe(client);

    const cleanup = () => {
      try { client.destroy(); } catch {}
      try { upstream.kill('SIGTERM'); } catch {}
    };

    client.on('error', (err) => {
      console.error(`[forwarder] client error (${clientAddr}): ${err.message}`);
      cleanup();
    });
    client.on('close', cleanup);

    upstream.on('error', (err) => {
      console.error(`[forwarder] upstream spawn error (${clientAddr}): ${err.message}`);
      cleanup();
    });
    upstream.on('exit', (code, signal) => {
      if (code && code !== 0) {
        console.error(`[forwarder] tailscale nc exited (${clientAddr}) code=${code} signal=${signal || ''}`);
      }
      cleanup();
    });
  });

  server.on('error', (err) => {
    console.error(`[forwarder] server error: ${err.message}`);
    process.exit(2);
  });

  server.listen(listenPort, listenHost, () => {
    console.log(
      `[forwarder] listening on ${listenHost}:${listenPort} -> ${targetHost}:${targetPort} via tailscale nc (socket ${tailscaleSocket})`
    );
  });
}

main().catch((err) => {
  console.error(`[forwarder] fatal: ${err.stack || err.message}`);
  process.exit(1);
});
