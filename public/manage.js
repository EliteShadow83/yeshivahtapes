const uploadForm = document.querySelector('#uploadForm');
const audioFiles = document.querySelector('#audioFiles');
const fileList = document.querySelector('#fileList');
const message = document.querySelector('#message');
const pageForm = document.querySelector('#pageForm');
const pageName = document.querySelector('#pageName');
const pageList = document.querySelector('#pageList');

const esc = (value = '') => String(value).replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));

function setMessage(text, type = 'success') {
  message.textContent = text;
  message.className = `status feedback ${type}`;
}

async function loadPages() {
  const response = await fetch('/api/pages');
  const { pages } = await response.json();
  pageList.innerHTML = pages.length ? pages.map((page) => `<article class="card"><p class="eyebrow">Side navigation</p><h3>${esc(page)}</h3><p class="meta">Matches recordings containing "${esc(page)}".</p><button class="ghost manage-button" data-page="${esc(page)}">Delete page</button></article>`).join('') : '<div class="empty">No custom pages have been created.</div>';
}

async function loadFiles() {
  const response = await fetch('/api/library');
  const library = await response.json();
  fileList.innerHTML = library.tracks.length ? library.tracks.map((track) => `<article class="card">
    <p class="eyebrow">${esc(track.album)}</p>
    <h3>${esc(track.title)}</h3>
    <p class="meta">${esc(track.artist)} · ${esc(track.fileName)}</p>
    <button class="ghost manage-button" data-path="${esc(track.relPath)}">Delete file</button>
  </article>`).join('') : '<div class="empty">No recordings are available to manage.</div>';
}

uploadForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!audioFiles.files.length) { setMessage('Choose one or more audio files to upload.', 'warning'); return; }
  const formData = new FormData();
  [...audioFiles.files].forEach((file) => formData.append('audioFiles', file));
  const response = await fetch('/api/upload', { method: 'POST', body: formData });
  const result = await response.json();
  setMessage(response.ok ? `Upload complete: ${result.uploaded.join(', ')}` : `Upload failed: ${result.error}`, response.ok ? 'success' : 'error');
  uploadForm.reset();
  loadFiles();
});

pageForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const name = pageName.value.trim();
  if (!name) { setMessage('Enter a page name before creating a page.', 'warning'); return; }
  const response = await fetch('/api/pages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
  const result = await response.json();
  setMessage(response.ok ? `Page created: ${name}. Current pages: ${result.pages.join(', ')}` : `Page creation failed: ${result.error}`, response.ok ? 'success' : 'error');
  pageForm.reset();
  loadPages();
});

pageList.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-page]');
  if (!button) return;
  const name = button.dataset.page;
  if (!confirm(`Delete page ${name}?`)) return;
  const response = await fetch(`/api/pages?name=${encodeURIComponent(name)}`, { method: 'DELETE' });
  const result = await response.json();
  setMessage(response.ok ? `Page deleted: ${name}. Remaining pages: ${result.pages.join(', ') || 'none'}` : `Delete failed: ${result.error}`, response.ok ? 'success' : 'error');
  loadPages();
});

fileList.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-path]');
  if (!button) return;
  const relPath = button.dataset.path;
  if (!confirm(`Delete ${relPath}?`)) return;
  const response = await fetch(`/api/files?path=${encodeURIComponent(relPath)}`, { method: 'DELETE' });
  const result = await response.json();
  setMessage(response.ok ? `Deleted recording: ${result.deleted}` : `Delete failed: ${result.error}`, response.ok ? 'success' : 'error');
  loadFiles();
});

loadPages();
loadFiles();
