import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Ephemeral, loopback-only SPA server for reproducible render/verification. */
export async function serveBuilt() {
  const dist = resolve(fileURLToPath(new URL('../dist/', import.meta.url)));
  await stat(resolve(dist, 'index.html')).catch(() => {
    throw new Error('Build first: npm run docs:build');
  });
  const types = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.mp4': 'video/mp4',
    '.json': 'application/json',
    '.woff2': 'font/woff2',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
  };
  const server = createServer(async (request, response) => {
    try {
      const path = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      let file = resolve(dist, '.' + path);
      if (file !== dist && !file.startsWith(dist + sep)) {
        response.writeHead(403).end();
        return;
      }
      if (!extname(path)) file = resolve(dist, 'index.html');
      const content = await readFile(file);
      const headers = {
        'Content-Type': types[extname(file)] || 'application/octet-stream',
        'Accept-Ranges': 'bytes',
      };
      const range = request.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
      if (range) {
        const from = Number(range[1]),
          to = Math.min(Number(range[2] || content.length - 1), content.length - 1);
        if (from > to) {
          response.writeHead(416).end();
          return;
        }
        response.writeHead(206, {
          ...headers,
          'Content-Range': `bytes ${from}-${to}/${content.length}`,
          'Content-Length': to - from + 1,
        });
        response.end(content.subarray(from, to + 1));
      } else {
        response.writeHead(200, { ...headers, 'Content-Length': content.length });
        response.end(content);
      }
    } catch {
      response.writeHead(404).end('Not found');
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}
