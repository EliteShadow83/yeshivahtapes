const app = document.querySelector('#app');
const statusEl = document.querySelector('#status');
const search = document.querySelector('#search');
const folder = document.querySelector('#folder');
const rescan = document.querySelector('#rescan');
let library = { tracks: [], albums: {}, artists: {}, scanState: {} };
let query = '';

const esc = (value = '') => String(value).replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));
const routeParts = () => location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
const filteredTracks = () => library.tracks.filter((track) => [track.title, track.artist, track.album, track.genre, track.description].join(' ').toLowerCase().includes(query));

function setActive() {
  const root = routeParts()[0] || 'home';
  document.querySelectorAll('nav a').forEach((link) => link.classList.toggle('active', link.dataset.route === root));
}

function trackCard(track) {
  return `<a class="card" href="#/tracks/${track.id}">
    <p class="eyebrow">${esc(track.genre)}</p>
    <h3>${esc(track.title)}</h3>
    <p class="meta">${esc(track.artist)} · ${esc(track.album)}</p>
    <div class="pills"><span class="pill">${esc(track.durationLabel)}</span>${track.year ? `<span class="pill">${esc(track.year)}</span>` : ''}</div>
  </a>`;
}

function renderHome() {
  const tracks = filteredTracks();
  app.innerHTML = tracks.length ? `<div class="grid">${tracks.map(trackCard).join('')}</div>` : `<div class="empty">No audio files found. Add supported files to the audio folder, then click Rescan folder.</div>`;
}

function renderGroups(type) {
  const groups = type === 'albums' ? library.albums : library.artists;
  const entries = Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  app.innerHTML = entries.length ? `<div class="grid">${entries.map(([name, tracks]) => `<a class="card" href="#/${type}/${encodeURIComponent(name)}"><p class="eyebrow">${tracks.length} tracks</p><h3>${esc(name)}</h3><p class="meta">${esc([...new Set(tracks.map((track) => type === 'albums' ? track.artist : track.album))].slice(0, 4).join(' · '))}</p></a>`).join('')}</div>` : `<div class="empty">No ${type} found yet.</div>`;
}

function renderGroup(type, name) {
  const decoded = decodeURIComponent(name || '');
  const tracks = (type === 'albums' ? library.albums[decoded] : library.artists[decoded]) || [];
  app.innerHTML = `<p class="eyebrow">${type.slice(0, -1)}</p><h3>${esc(decoded)}</h3><br><div class="grid">${tracks.map(trackCard).join('')}</div>`;
}

function renderTrack(id) {
  const track = library.tracks.find((item) => item.id === id);
  if (!track) { app.innerHTML = '<div class="empty">Track not found.</div>'; return; }
  app.innerHTML = `<article class="track-page">
    <div class="card">
      <p class="eyebrow">${esc(track.genre)}</p>
      <h2>${esc(track.title)}</h2>
      <p class="meta">${esc(track.description)}</p>
      <div class="pills">
        <a class="pill" href="#/artists/${encodeURIComponent(track.artist)}">Artist: ${esc(track.artist)}</a>
        <a class="pill" href="#/albums/${encodeURIComponent(track.album)}">Album: ${esc(track.album)}</a>
        <span class="pill">File: ${esc(track.fileName)}</span>
        ${track.trackNumber ? `<span class="pill">Track ${track.trackNumber}</span>` : ''}
      </div>
    </div>
    <aside class="card player">
      <h3>Now playing</h3>
      <p class="meta">${esc(track.artist)} · ${esc(track.durationLabel)}</p>
      <audio controls preload="metadata" src="${track.streamUrl}"></audio>
    </aside>
  </article>`;
}

function render() {
  setActive();
  const [root, value] = routeParts();
  if (!root) return renderHome();
  if (root === 'albums' && value) return renderGroup('albums', value);
  if (root === 'artists' && value) return renderGroup('artists', value);
  if (root === 'albums' || root === 'artists') return renderGroups(root);
  if (root === 'tracks') return renderTrack(value);
  return renderHome();
}

async function loadLibrary() {
  const response = await fetch('/api/library');
  library = await response.json();
  folder.textContent = `Audio folder: ${library.audioDirectory}`;
  const scanned = library.scanState.scannedAt ? new Date(library.scanState.scannedAt).toLocaleString() : 'starting scan';
  statusEl.textContent = `${library.tracks.length} tracks loaded · Last scan: ${scanned}`;
  render();
}

search.addEventListener('input', (event) => { query = event.target.value.toLowerCase(); renderHome(); });
window.addEventListener('hashchange', render);
rescan.addEventListener('click', async () => { await fetch('/api/rescan', { method: 'POST' }); setTimeout(loadLibrary, 900); });
loadLibrary();
