const uploadForm = document.querySelector('#uploadForm');
const audioFiles = document.querySelector('#audioFiles');
const fileList = document.querySelector('#fileList');
const message = document.querySelector('#message');
const pageForm = document.querySelector('#pageForm');
const pageName = document.querySelector('#pageName');
const pageList = document.querySelector('#pageList');
const categoryForm = document.querySelector('#categoryForm');
const categoryName = document.querySelector('#categoryName');
const categoryList = document.querySelector('#categoryList');
let pageData = { pages: [], categories: [] };

const esc = (value = '') => String(value).replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));

function setMessage(text, type = 'success') {
  message.textContent = text;
  message.className = `status feedback ${type}`;
}

function categoryOptions(selected = '') {
  return `<option value="">No subcategory</option>${pageData.categories.map((category) => `<option value="${esc(category.name)}" ${category.name === selected ? 'selected' : ''}>${esc(category.name)}</option>`).join('')}`;
}

async function loadPages() {
  const response = await fetch('/api/pages');
  pageData = await response.json();
  const pageAssignments = new Map();
  pageData.categories.forEach((category) => (category.pages || []).forEach((page) => pageAssignments.set(page, category.name)));

  categoryList.innerHTML = pageData.categories.length ? pageData.categories.map((category) => `<article class="card"><p class="eyebrow">Subcategory</p><h3>${esc(category.name)}</h3><p class="meta">${category.pages.length || 0} pages nested here.</p><button class="ghost manage-button" data-category="${esc(category.name)}">Delete subcategory</button></article>`).join('') : '<div class="empty">No subcategories have been created.</div>';

  pageList.innerHTML = pageData.pages.length ? pageData.pages.map((page) => `<article class="card"><p class="eyebrow">Side navigation</p><h3>${esc(page)}</h3><p class="meta">Matches recordings containing "${esc(page)}".</p><label for="assign-${esc(page)}">Nest under subcategory</label><select id="assign-${esc(page)}" data-page="${esc(page)}">${categoryOptions(pageAssignments.get(page) || '')}</select><button class="ghost manage-button" data-page="${esc(page)}">Delete page</button></article>`).join('') : '<div class="empty">No custom pages have been created.</div>';
}

async function loadFiles() {
  const response = await fetch('/api/library');
  const library = await response.json();
  fileList.innerHTML = library.tracks.length ? library.tracks.map((track) => `<article class="card">
    <p class="eyebrow">${esc(track.album)}</p>
    <h3>${esc(track.title)}</h3>
    <p class="meta">${esc(track.artist)} · ${esc(track.fileName)}</p>
    <form class="rename-form" data-path="${esc(track.relPath)}">
      <label for="rename-${esc(track.id)}">Rename audio file</label>
      <input id="rename-${esc(track.id)}" name="newName" type="text" value="${esc(track.fileName)}">
      <button class="ghost manage-button" type="submit">Rename file</button>
    </form>
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
  setMessage(response.ok ? `Page created: ${name}.` : `Page creation failed: ${result.error}`, response.ok ? 'success' : 'error');
  pageForm.reset();
  loadPages();
});

categoryForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const name = categoryName.value.trim();
  if (!name) { setMessage('Enter a subcategory name before creating it.', 'warning'); return; }
  const response = await fetch('/api/categories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
  const result = await response.json();
  setMessage(response.ok ? `Subcategory created: ${name}.` : `Subcategory creation failed: ${result.error}`, response.ok ? 'success' : 'error');
  categoryForm.reset();
  loadPages();
});

pageList.addEventListener('change', async (event) => {
  const select = event.target.closest('select[data-page]');
  if (!select) return;
  const page = select.dataset.page;
  const previousCategory = pageData.categories.find((category) => (category.pages || []).includes(page));
  if (previousCategory) await fetch(`/api/categories/pages?category=${encodeURIComponent(previousCategory.name)}&page=${encodeURIComponent(page)}`, { method: 'DELETE' });
  if (select.value) {
    const response = await fetch('/api/categories/pages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ category: select.value, page }) });
    const result = await response.json();
    setMessage(response.ok ? `Nested ${page} under ${select.value}.` : `Nesting failed: ${result.error}`, response.ok ? 'success' : 'error');
  } else {
    setMessage(`${page} moved out of subcategories.`);
  }
  loadPages();
});

pageList.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-page]');
  if (!button) return;
  const name = button.dataset.page;
  if (!confirm(`Delete page ${name}?`)) return;
  const response = await fetch(`/api/pages?name=${encodeURIComponent(name)}`, { method: 'DELETE' });
  const result = await response.json();
  setMessage(response.ok ? `Page deleted: ${name}.` : `Delete failed: ${result.error}`, response.ok ? 'success' : 'error');
  loadPages();
});

categoryList.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-category]');
  if (!button) return;
  const name = button.dataset.category;
  if (!confirm(`Delete subcategory ${name}? Pages will remain available.`)) return;
  const response = await fetch(`/api/categories?name=${encodeURIComponent(name)}`, { method: 'DELETE' });
  const result = await response.json();
  setMessage(response.ok ? `Subcategory deleted: ${name}.` : `Delete failed: ${result.error}`, response.ok ? 'success' : 'error');
  loadPages();
});

fileList.addEventListener('submit', async (event) => {
  const form = event.target.closest('form.rename-form');
  if (!form) return;
  event.preventDefault();
  const newName = new FormData(form).get('newName').trim();
  if (!newName) { setMessage('Enter a new file name before renaming.', 'warning'); return; }
  const response = await fetch('/api/files', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: form.dataset.path, name: newName }) });
  const result = await response.json();
  setMessage(response.ok ? `Renamed recording: ${result.renamed.from} → ${result.renamed.to}` : `Rename failed: ${result.error}`, response.ok ? 'success' : 'error');
  loadFiles();
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
