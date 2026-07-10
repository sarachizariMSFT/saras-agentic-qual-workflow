// server.mjs — minimal live dashboard server. Zero deps.
// Usage: node lib/server.mjs [--port 4173]
// Serves studies/<id>/dashboards and rebuilds on each request so it's always fresh.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildAll } from './dashboard.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const STUDIES = path.join(ROOT, 'studies');
const portArg = process.argv.indexOf('--port');
const PORT = portArg > -1 ? Number(process.argv[portArg + 1]) : 4173;

const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.md': 'text/plain', '.txt': 'text/plain' };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function listStudies() {
  if (!fs.existsSync(STUDIES)) return [];
  return fs.readdirSync(STUDIES).filter(d => d !== '_TEMPLATE' && fs.statSync(path.join(STUDIES, d)).isDirectory());
}

function home() {
  const items = listStudies().map(s => `<li><a href="/studies/${encodeURIComponent(s)}/dashboards/index.html">${esc(s)}</a></li>`).join('');
  return `<!doctype html><meta charset="utf-8"><title>UXR Pipeline</title>
  <body style="font:15px/1.5 -apple-system,Segoe UI,Arial;background:#0f1117;color:#e7e9ee;max-width:760px;margin:40px auto;padding:0 20px">
  <h1>UXR Pipeline · live dashboards</h1><p style="color:#9aa3b2">Studies rebuild on every load.</p>
  <ul>${items || '<li style="color:#9aa3b2">No studies yet. Run <code>node lib/run.mjs init &lt;id&gt; "&lt;name&gt;"</code>.</li>'}</ul></body>`;
}

const server = http.createServer((req, res) => {
  try {
    const url = decodeURIComponent(req.url.split('?')[0]);
    if (url === '/' || url === '/index.html') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(home()); }

    // Rebuild dashboards for the requested study on the fly.
    const m = url.match(/^\/studies\/([^/]+)\//);
    if (m) { const sr = path.join(STUDIES, m[1]); if (fs.existsSync(sr)) { try { buildAll(sr); } catch {} } }

    const filePath = path.join(ROOT, url.replace(/^\/+/, ''));
    if (!filePath.startsWith(ROOT)) { res.writeHead(403); return res.end('forbidden'); }
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'content-type': MIME[path.extname(filePath)] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  } catch (e) { res.writeHead(500); res.end(String(e)); }
});

server.listen(PORT, () => console.log(`UXR dashboards live at http://localhost:${PORT}  (Ctrl+C to stop)`));
