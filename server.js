const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const port = process.env.PORT || 3002;
const root = path.resolve(__dirname);

const mimeTypes = {
  '.html': 'text/html; charset=UTF-8',
  '.htm': 'text/html; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.mjs': 'application/javascript; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.txt': 'text/plain; charset=UTF-8',
  '.map': 'application/json',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg'
};

function resolveSafePath(requestPath) {
  const pathname = decodeURI((requestPath || '/').split('?')[0]);
  let relative = pathname.replace(/^\//, '');
  relative = path.normalize(relative);
  const filePath = path.join(root, relative);
  if (!filePath.startsWith(root)) return null; // Prevent path traversal
  return filePath;
}

function serveFile(filePath, res) {
  const ext = path.extname(filePath).toLowerCase();
  const type = mimeTypes[ext] || 'application/octet-stream';
  res.writeHead(200, {
    'Content-Type': type,
    'Cache-Control': 'no-cache, no-store, must-revalidate'
  });
  const stream = fs.createReadStream(filePath);
  stream.on('error', () => {
    res.writeHead(500);
    res.end('Internal Server Error');
  });
  stream.pipe(res);
}

const server = http.createServer((req, res) => {
  try {
    const parsed = url.parse(req.url);
    let filePath = resolveSafePath(parsed.pathname);
    if (!filePath) {
      res.writeHead(400);
      res.end('Bad Request');
      return;
    }

    fs.stat(filePath, (err, stats) => {
      if (!err && stats.isDirectory()) {
        filePath = path.join(filePath, 'index.html');
      }

      fs.stat(filePath, (err2, stats2) => {
        if (err2 || !stats2.isFile()) {
          // SPA/landing fallback to index.html when no extension
          const extname = path.extname(filePath);
          if (!extname) {
            const fallback = path.join(root, 'index.html');
            fs.stat(fallback, (e3, st3) => {
              if (!e3 && st3.isFile()) {
                serveFile(fallback, res);
              } else {
                res.writeHead(404);
                res.end('Not Found');
              }
            });
          } else {
            res.writeHead(404);
            res.end('Not Found');
          }
          return;
        }

        serveFile(filePath, res);
      });
    });
  } catch (e) {
    res.writeHead(500);
    res.end('Internal Server Error');
  }
});

server.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

