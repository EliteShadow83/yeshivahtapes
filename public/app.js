const app = document.querySelector('#app');
const statusEl = document.querySelector('#status');
const search = document.querySelector('#search');
const sideNav = document.querySelector('#sideNav');
const menuButton = document.querySelector('#menuButton');
let library = { tracks: [], albums: {}, artists: {}, pages: [], scanState: {} };
let query = '';

const esc = (value = '') => String(value).replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));
const routeParts = () => location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
const trackMatches = (track, text) => [track.title, track.artist, track.album, track.genre, track.description].join(' ').toLowerCase().includes(text.toLowerCase());
const filteredTracks = () => library.tracks.filter((track) => trackMatches(track, query));

function renderNavigation() {
  const customLinks = (library.pages || []).map((page) => `<a href="#/pages/${encodeURIComponent(page)}" data-route="pages">${esc(page)}</a>`).join('');
  sideNav.innerHTML = `<a href="#/" data-route="home">Library</a><a href="#/albums" data-route="albums">Albums</a><a href="#/speakers" data-route="speakers">Speakers</a>${customLinks}`;
}

function setActive() {
  const root = routeParts()[0] || 'home';
  document.querySelectorAll('nav a').forEach((link) => link.classList.toggle('active', link.dataset.route === root));
}

function trackCard(track) {
  return `<a class="card" href="#/tracks/${track.id}">
    <p class="eyebrow">${esc(track.album)}</p>
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
  app.innerHTML = tracks.length ? `<div class="grid">${tracks.map(trackCard).join('')}</div>` : `<div class="empty">No recordings are available yet. Please check back soon.</div>`;
}

function speakerCard(name, tracks) {
  return `<a class="card" href="#/speakers/${encodeURIComponent(name)}"><p class="eyebrow">${tracks.length} tracks</p><h3>${esc(name)}</h3><p class="meta">${esc([...new Set(tracks.map((track) => track.album))].slice(0, 4).join(' · '))}</p></a>`;
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

function renderSpeakers() {
  const entries = Object.entries(library.artists).sort(([a], [b]) => a.localeCompare(b));
  app.innerHTML = entries.length ? `<div class="grid">${entries.map(([name, tracks]) => speakerCard(name, tracks)).join('')}</div>` : `<div class="empty">No speakers found yet.</div>`;
}

function renderSpeaker(name) {
  const decoded = decodeURIComponent(name || '');
  const tracks = library.artists[decoded] || [];
  app.innerHTML = `<p class="eyebrow">Speaker</p><h3>${esc(decoded)}</h3><br><div class="grid">${tracks.map(trackCard).join('')}</div>`;
}

function renderCustomPage(name) {
  const decoded = decodeURIComponent(name || '');
  const tracks = library.tracks.filter((track) => trackMatches(track, decoded));
  app.innerHTML = `<p class="eyebrow">Custom page</p><h3>${esc(decoded)}</h3><p class="meta">Showing recordings that match "${esc(decoded)}".</p><br><div class="grid">${tracks.map(trackCard).join('')}</div>`;
}

function renderTrack(id) {
  const track = library.tracks.find((item) => item.id === id);
  if (!track) { app.innerHTML = '<div class="empty">Track not found.</div>'; return; }
  app.innerHTML = `<article class="track-page">
    <div class="card">
      <p class="eyebrow">${esc(track.album)}</p>
      <h2>${esc(track.title)}</h2>
      <p class="meta">${esc(track.description)}</p>
      <div class="pills">
        <a class="pill" href="#/speakers/${encodeURIComponent(track.artist)}">Speaker: ${esc(track.artist)}</a>
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
  if (root === 'speakers' && value) return renderSpeaker(value);
  if (root === 'pages' && value) return renderCustomPage(value);
  if (root === 'albums') return renderAlbums();
  if (root === 'speakers') return renderSpeakers();
  if (root === 'tracks') return renderTrack(value);
  return renderHome();
}

async function loadLibrary() {
  const response = await fetch('/api/library');
  library = await response.json();
  renderNavigation();
  const scanned = library.scanState.scannedAt ? new Date(library.scanState.scannedAt).toLocaleString() : 'starting scan';
  statusEl.textContent = `${library.tracks.length} tracks loaded · Last scan: ${scanned}`;
  render();
}

search.addEventListener('input', (event) => { query = event.target.value.toLowerCase(); renderHome(); });
window.addEventListener('hashchange', render);
loadLibrary();
setInterval(loadLibrary, 60 * 1000);

menuButton.addEventListener('click', () => {
  const isOpen = document.body.classList.toggle('nav-open');
  menuButton.setAttribute('aria-expanded', String(isOpen));
});

sideNav.addEventListener('click', (event) => {
  if (!event.target.closest('a')) return;
  document.body.classList.remove('nav-open');
  menuButton.setAttribute('aria-expanded', 'false');
});
