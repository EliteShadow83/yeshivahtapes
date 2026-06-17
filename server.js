const fs = require('fs');
const http = require('http');
const path = require('path');
const { URL } = require('url');

const PORT = process.env.PORT || 3131;
const RESCAN_INTERVAL_MS = 15 * 60 * 1000;
const AUDIO_DIR = process.env.AUDIO_DIR || path.join(__dirname, 'audio');
const PUBLIC_DIR = path.join(__dirname, 'public');
const AUDIO_EXTENSIONS = new Set(['.mp3', '.m4a', '.aac', '.flac', '.wav', '.ogg', '.opus', '.wma']);
const MIME_TYPES = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.json':'application/json; charset=utf-8', '.mp3':'audio/mpeg', '.m4a':'audio/mp4', '.aac':'audio/aac', '.flac':'audio/flac', '.wav':'audio/wav', '.ogg':'audio/ogg', '.opus':'audio/ogg', '.wma':'audio/x-ms-wma' };
let libraryCache = [];
let scanState = { scannedAt: null, isScanning: false, error: null };

function slugify(value) { return String(value || 'unknown').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'unknown'; }
function cleanText(value) { return String(value || '').replace(/\u0000/g, '').trim(); }
function durationLabel(seconds) { if (!seconds || Number.isNaN(seconds)) return 'Unknown length'; const rounded = Math.round(seconds); return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, '0')}`; }
function json(res, status, data) { res.writeHead(status, { 'Content-Type': MIME_TYPES['.json'] }); res.end(JSON.stringify(data)); }
function safeJoin(root, requestPath) { const filePath = path.resolve(root, requestPath); if (!filePath.startsWith(path.resolve(root))) return null; return filePath; }

function walkAudioFiles(dir) {
  if (!fs.existsSync(dir)) { fs.mkdirSync(dir, { recursive: true }); return []; }
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walkAudioFiles(fullPath));
    if (entry.isFile() && AUDIO_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) files.push(fullPath);
  }
  return files;
}

function decodeId3Text(buffer) {
  if (!buffer || !buffer.length) return '';
  const encoding = buffer[0];
  const body = buffer.subarray(1);
  if (encoding === 1 || encoding === 2) return cleanText(body.toString('utf16le'));
  return cleanText(body.toString('utf8'));
}

function syncSafeInt(buffer) { return (buffer[0] << 21) | (buffer[1] << 14) | (buffer[2] << 7) | buffer[3]; }

function readMp3Metadata(filePath) {
  const fd = fs.openSync(filePath, 'r');
  try {
    const header = Buffer.alloc(10);
    fs.readSync(fd, header, 0, 10, 0);
    if (header.toString('ascii', 0, 3) !== 'ID3') return {};
    const version = header[3];
    const tagSize = syncSafeInt(header.subarray(6, 10));
    const tag = Buffer.alloc(tagSize);
    fs.readSync(fd, tag, 0, tagSize, 10);
    const map = { TIT2: 'title', TPE1: 'artist', TPE2: 'artist', TALB: 'album', TCON: 'genre', TYER: 'year', TDRC: 'year', TRCK: 'trackNumber' };
    const metadata = {};
    let offset = 0;
    while (offset + 10 <= tag.length) {
      const id = tag.toString('ascii', offset, offset + 4).replace(/\u0000/g, '');
      const size = version === 4 ? syncSafeInt(tag.subarray(offset + 4, offset + 8)) : tag.readUInt32BE(offset + 4);
      if (!id || !size) break;
      const key = map[id];
      if (key) metadata[key] = decodeId3Text(tag.subarray(offset + 10, offset + 10 + size));
      offset += 10 + size;
    }
    return metadata;
  } finally { fs.closeSync(fd); }
}

function readWavMetadata(filePath) {
  const buffer = fs.readFileSync(filePath).subarray(0, 1024 * 1024);
  const metadata = {};
  const labels = { INAM: 'title', IART: 'artist', IPRD: 'album', IGNR: 'genre', ICRD: 'year', ICMT: 'comment' };
  for (const [chunk, key] of Object.entries(labels)) {
    const idx = buffer.indexOf(chunk);
    if (idx >= 0 && idx + 8 < buffer.length) metadata[key] = cleanText(buffer.subarray(idx + 8, idx + 8 + buffer.readUInt32LE(idx + 4)).toString('utf8'));
  }
  return metadata;
}

function readMetadata(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.mp3') return readMp3Metadata(filePath);
  if (ext === '.wav') return readWavMetadata(filePath);
  return {};
}

function readTrack(filePath, index) {
  const stats = fs.statSync(filePath);
  const meta = readMetadata(filePath);
  const relPath = path.relative(AUDIO_DIR, filePath).replace(/\\/g, '/');
  const title = meta.title || path.basename(filePath, path.extname(filePath));
  const artist = meta.artist || 'Unknown Speaker';
  const album = meta.album || 'Unknown Album';
  const year = meta.year || '';
  const genre = meta.genre || 'Uncategorized';
  const trackNumber = meta.trackNumber ? Number.parseInt(String(meta.trackNumber).split('/')[0], 10) : null;
  const description = [title, artist !== 'Unknown Speaker' ? `presented by ${artist}` : '', album !== 'Unknown Album' ? `from ${album}` : '', year ? `released in ${year}` : '', genre !== 'Uncategorized' ? `genre: ${genre}` : '', meta.comment || ''].filter(Boolean).join(' · ');
  return { id: `${slugify(artist)}-${slugify(album)}-${slugify(title)}-${index}`, title, artist, album, year, genre, trackNumber, duration: null, durationLabel: durationLabel(null), fileName: path.basename(filePath), relPath, modifiedAt: stats.mtime.toISOString(), description, streamUrl: `/media/${encodeURIComponent(relPath)}` };
}

function scanLibrary() {
  scanState = { ...scanState, isScanning: true, error: null };
  try {
    libraryCache = walkAudioFiles(AUDIO_DIR).map(readTrack).sort((a, b) => `${a.artist}${a.album}${a.trackNumber || 999}${a.title}`.localeCompare(`${b.artist}${b.album}${b.trackNumber || 999}${b.title}`));
    scanState = { scannedAt: new Date().toISOString(), isScanning: false, error: null };
  } catch (error) { scanState = { scannedAt: scanState.scannedAt, isScanning: false, error: error.message }; }
}

function groupedBy(field) { return libraryCache.reduce((groups, track) => { const key = track[field] || 'Unknown'; groups[key] = groups[key] || []; groups[key].push(track); return groups; }, {}); }

function serveFile(res, filePath) {
  if (!filePath || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) { res.writeHead(404); res.end('Not found'); return; }
  res.writeHead(200, { 'Content-Type': MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);
}

function serveMedia(req, res, relPath) {
  const decoded = decodeURIComponent(relPath);
  const filePath = safeJoin(AUDIO_DIR, decoded);
  if (!filePath || !fs.existsSync(filePath)) { res.writeHead(404); res.end('Not found'); return; }
  const stat = fs.statSync(filePath);
  const range = req.headers.range;
  const type = MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
  if (!range) { res.writeHead(200, { 'Content-Type': type, 'Content-Length': stat.size, 'Accept-Ranges': 'bytes' }); fs.createReadStream(filePath).pipe(res); return; }
  const [startText, endText] = range.replace(/bytes=/, '').split('-');
  const start = Number.parseInt(startText, 10);
  const end = endText ? Number.parseInt(endText, 10) : stat.size - 1;
  res.writeHead(206, { 'Content-Range': `bytes ${start}-${end}/${stat.size}`, 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1, 'Content-Type': type });
  fs.createReadStream(filePath, { start, end }).pipe(res);
}

scanLibrary();
setInterval(scanLibrary, RESCAN_INTERVAL_MS);
http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname === '/api/library') return json(res, 200, { scanState, tracks: libraryCache, albums: groupedBy('album'), artists: groupedBy('artist') });
  if (url.pathname.startsWith('/api/tracks/')) return json(res, 200, libraryCache.find((item) => item.id === decodeURIComponent(url.pathname.split('/').pop())) || { error: 'Track not found' });
  if (url.pathname.startsWith('/media/')) return serveMedia(req, res, url.pathname.slice('/media/'.length));
  const requestPath = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
  return serveFile(res, safeJoin(PUBLIC_DIR, requestPath) || path.join(PUBLIC_DIR, 'index.html'));
}).listen(PORT, () => { console.log(`Audio library running at http://localhost:${PORT}`); console.log(`Reading audio files from: ${AUDIO_DIR}`); console.log('Library rescans every 15 minutes.'); });
