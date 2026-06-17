const app = document.querySelector('#app');
const statusEl = document.querySelector('#status');
const search = document.querySelector('#search');
let library = { tracks: [], albums: {}, scanState: {} };
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

function albumCard(name, tracks) {
  return `<a class="card" href="#/albums/${encodeURIComponent(name)}"><p class="eyebrow">${tracks.length} tracks</p><h3>${esc(name)}</h3><p class="meta">${esc([...new Set(tracks.map((track) => track.artist))].slice(0, 4).join(' · '))}</p></a>`;
}

function renderHome() {
  const tracks = filteredTracks();
  if (!tracks.length) { app.innerHTML = `<div class="empty">No recordings are available yet. Please check back soon.</div>`; return; }
  const albums = tracks.reduce((groups, track) => {
    groups[track.album] = groups[track.album] || [];
    groups[track.album].push(track);
    return groups;
  }, {});
  app.innerHTML = `<div class="grid">${Object.entries(albums).sort(([a], [b]) => a.localeCompare(b)).map(([name, albumTracks]) => albumCard(name, albumTracks)).join('')}</div>`;
}

function renderAlbums() {
  const entries = Object.entries(library.albums).sort(([a], [b]) => a.localeCompare(b));
  app.innerHTML = entries.length ? `<div class="grid">${entries.map(([name, tracks]) => albumCard(name, tracks)).join('')}</div>` : `<div class="empty">No albums found yet.</div>`;
}

function renderAlbum(name) {
  const decoded = decodeURIComponent(name || '');
  const tracks = library.albums[decoded] || [];
  app.innerHTML = `<p class="eyebrow">Album</p><h3>${esc(decoded)}</h3><br><div class="grid">${tracks.map(trackCard).join('')}</div>`;
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
        <span class="pill">Speaker: ${esc(track.artist)}</span>
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
  if (root === 'albums' && value) return renderAlbum(value);
  if (root === 'albums') return renderAlbums();
  if (root === 'tracks') return renderTrack(value);
  return renderHome();
}

async function loadLibrary() {
  const response = await fetch('/api/library');
  library = await response.json();
  const scanned = library.scanState.scannedAt ? new Date(library.scanState.scannedAt).toLocaleString() : 'starting scan';
  statusEl.textContent = `${library.tracks.length} tracks loaded · Last scan: ${scanned}`;
  render();
}

search.addEventListener('input', (event) => { query = event.target.value.toLowerCase(); renderHome(); });
window.addEventListener('hashchange', render);
loadLibrary();
setInterval(loadLibrary, 60 * 1000);
