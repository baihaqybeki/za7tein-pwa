#!/usr/bin/env node
/**
 * Static server untuk artefak flow archify di docs/design/flows/.
 *
 * Diagram per-flow (`<slug>/<slug>.html`) bersifat generated & gitignored —
 * jalankan `./scripts/flows-gate.sh --all` dulu kalau belum ada.
 *
 * Jalankan: npm run docs:serve            (default port 8090)
 *           npm run docs:serve -- --port 9000
 */

import { createServer } from 'node:http'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { extname, join, normalize, resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..', 'docs/design/flows')
const argv = process.argv.slice(2)
const portArg = argv.indexOf('--port')
const PORT = Number(portArg >= 0 ? argv[portArg + 1] : process.env.PORT || 8090)

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.md': 'text/markdown; charset=utf-8',
}

createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url || '/').split('?')[0])
  const rel = normalize(urlPath).replace(/^([.][.][/\\])+/, '')
  let file = resolve(ROOT, '.' + rel)
  if (!file.startsWith(ROOT)) {
    res.writeHead(403, { 'content-type': 'text/plain' }).end('Forbidden')
    return
  }
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html')
  if (!existsSync(file)) {
    res.writeHead(404, { 'content-type': 'text/plain' }).end('Not found')
    return
  }
  res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' })
  createReadStream(file).pipe(res)
}).listen(PORT, '127.0.0.1', () => {
  console.log(`Flow docs: http://127.0.0.1:${PORT}/index.html`)
})
