(() => {
  'use strict';

  const DB_NAME = 'memory-collection-db';
  const DB_VERSION = 1;
  const STORE_NAME = 'memories';
  const MAX_FILE_SIZE = 25 * 1024 * 1024;
  const ALLOWED_TYPES = /^(image\/(jpeg|png|gif|webp)|video\/(mp4|webm|quicktime))$/i;

  const sampleMemories = [
    { id: 'sample-birthday', title: 'Maya turns seven', category: 'Birthdays', date: '2025-08-16', description: 'A garden full of balloons, homemade cake, and the people she loves most.', image: 'https://images.unsplash.com/photo-1530103862676-de8c9debad1d?auto=format&fit=crop&w=900&q=82', alt: 'Colorful birthday balloons and party decorations' },
    { id: 'sample-wedding', title: 'A day to remember', category: 'Weddings', date: '2025-06-07', description: 'An intimate celebration, happy tears, and a dance floor that never emptied.', image: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=900&q=82', alt: 'A couple celebrating their wedding day' },
    { id: 'sample-trip', title: 'Our little mountain escape', category: 'Family Trips', date: '2025-04-12', description: 'Fresh air, winding trails, and absolutely no plans for the weekend.', image: 'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=900&q=82', alt: 'A calm mountain lake surrounded by green hills' },
    { id: 'sample-festival', title: 'Diwali at home', category: 'Festivals', date: '2024-11-01', description: 'The whole house glowed with little lamps, laughter, and sweet treats.', image: 'https://images.unsplash.com/photo-1604608672516-3f3d9b8c2f4d?auto=format&fit=crop&w=900&q=82', alt: 'Warm lights and festive decorations' },
    { id: 'sample-anniversary', title: 'Twenty years, still us', category: 'Anniversaries', date: '2024-09-21', description: 'A quiet dinner, old stories, and one more reason to celebrate together.', image: 'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?auto=format&fit=crop&w=900&q=82', alt: 'A couple sharing a joyful celebration' },
    { id: 'sample-moment', title: 'Sunday in the garden', category: 'Special Moments', date: '2024-07-14', description: 'No occasion at all. Just a sunny afternoon we wanted to keep.', image: 'https://images.unsplash.com/photo-1511895426328-dc8714191300?auto=format&fit=crop&w=900&q=82', alt: 'Family spending a happy afternoon together' }
  ];

  const elements = {
    menuToggle: document.querySelector('.menu-toggle'),
    nav: document.querySelector('.main-nav'),
    grid: document.querySelector('#memory-grid'),
    emptyState: document.querySelector('#empty-state'),
    search: document.querySelector('#memory-search'),
    filterButtons: [...document.querySelectorAll('.filter-chip')],
    uploadForm: document.querySelector('#upload-form'),
    fileInput: document.querySelector('#memory-files'),
    preview: document.querySelector('#media-preview'),
    uploadMessage: document.querySelector('#upload-message'),
    contactForm: document.querySelector('#contact-form'),
    contactMessage: document.querySelector('#contact-message'),
    dialog: document.querySelector('#memory-dialog'),
    lightboxMedia: document.querySelector('#lightbox-media'),
    lightboxTitle: document.querySelector('#lightbox-title'),
    lightboxCategory: document.querySelector('#lightbox-category'),
    lightboxDate: document.querySelector('#lightbox-date'),
    lightboxDescription: document.querySelector('#lightbox-description'),
    lightboxCount: document.querySelector('#lightbox-count'),
    toast: document.querySelector('#toast')
  };

  let database;
  let savedMemories = [];
  let activeCategory = 'all';
  let selectedFiles = [];
  let previewUrls = [];
  let galleryUrls = [];
  let currentViewer = null;
  let viewerIndex = 0;
  let toastTimer;

  function openDatabase() {
    return new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) {
        reject(new Error('This browser does not support IndexedDB. Try a current version of Chrome, Firefox, Safari, or Edge.'));
        return;
      }
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Could not open local memory storage.'));
      request.onblocked = () => reject(new Error('Memory storage is busy in another tab. Close other copies and try again.'));
    });
  }

  function databaseRequest(mode, operation) {
    return new Promise((resolve, reject) => {
      if (!database) return reject(new Error('Local memory storage is not available.'));
      const transaction = database.transaction(STORE_NAME, mode);
      const request = operation(transaction.objectStore(STORE_NAME));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('The local storage request failed.'));
      transaction.onabort = () => reject(transaction.error || new Error('The local storage transaction was canceled.'));
    });
  }

  const getSavedMemories = () => databaseRequest('readonly', store => store.getAll());
  const saveMemory = memory => databaseRequest('readwrite', store => store.add(memory));
  const removeMemory = id => databaseRequest('readwrite', store => store.delete(id));

  function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(`${dateString}T12:00:00`);
    if (Number.isNaN(date.getTime())) return dateString;
    return new Intl.DateTimeFormat(undefined, { month: 'long', day: 'numeric', year: 'numeric' }).format(date);
  }

  function escapeHtml(value = '') {
    return String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
  }

  function getAllMemories() {
    return [...savedMemories.map(memory => ({ ...memory, isSaved: true })), ...sampleMemories.map(memory => ({ ...memory, isSaved: false }))];
  }

  function createMediaUrl(blob) {
    const url = URL.createObjectURL(blob);
    galleryUrls.push(url);
    return url;
  }

  function renderGallery() {
    galleryUrls.forEach(URL.revokeObjectURL);
    galleryUrls = [];
    const query = elements.search.value.trim().toLocaleLowerCase();
    const memories = getAllMemories().filter(memory => {
      const matchesCategory = activeCategory === 'all' || memory.category === activeCategory;
      const matchesQuery = memory.title.toLocaleLowerCase().includes(query);
      return matchesCategory && matchesQuery;
    }).sort((a, b) => b.date.localeCompare(a.date));

    elements.grid.innerHTML = memories.map((memory, index) => {
      const firstMedia = memory.media?.[0];
      const imageUrl = firstMedia ? createMediaUrl(firstMedia.blob) : memory.image;
      const mediaMarkup = firstMedia?.type.startsWith('video/')
        ? `<video src="${imageUrl}" muted playsinline aria-label="Video preview"></video>`
        : `<img src="${imageUrl}" alt="${escapeHtml(firstMedia ? memory.title : memory.alt || memory.title)}" loading="lazy">`;
      const count = memory.media?.length > 1 ? `<span class="media-count">${memory.media.length} items</span>` : '';
      return `<article class="memory-card" style="animation-delay:${Math.min(index * 45, 250)}ms">
        <button class="card-image-button" type="button" data-view="${escapeHtml(memory.id)}" aria-label="View ${escapeHtml(memory.title)}">
          ${mediaMarkup}<span class="card-badge">${escapeHtml(memory.category)}</span>${count}<span class="card-open-hint">View memory ↗</span>
        </button>
        <div class="card-body"><div class="card-meta"><span>${escapeHtml(memory.category)}</span><time datetime="${escapeHtml(memory.date)}">${escapeHtml(formatDate(memory.date))}</time></div>
          <h3>${escapeHtml(memory.title)}</h3><p>${escapeHtml(memory.description || 'A special moment worth remembering.')}</p>
          <div class="card-footer"><button class="card-view" type="button" data-view="${escapeHtml(memory.id)}">View memory <span>→</span></button>${memory.isSaved ? `<button class="delete-memory" type="button" data-delete="${escapeHtml(memory.id)}" aria-label="Delete ${escapeHtml(memory.title)}">Delete</button>` : ''}</div>
        </div>
      </article>`;
    }).join('');
    elements.emptyState.hidden = memories.length > 0;
  }

  function setMessage(element, message, isError = false) {
    element.textContent = message;
    element.classList.toggle('error', isError);
  }

  function showToast(message) {
    elements.toast.textContent = message;
    elements.toast.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => elements.toast.classList.remove('is-visible'), 3000);
  }

  function clearPreviews() {
    previewUrls.forEach(URL.revokeObjectURL);
    previewUrls = [];
    elements.preview.replaceChildren();
  }

  function renderPreviews() {
    clearPreviews();
    selectedFiles.forEach((file, index) => {
      const url = URL.createObjectURL(file);
      previewUrls.push(url);
      const item = document.createElement('div');
      item.className = 'preview-item';
      const media = document.createElement(file.type.startsWith('video/') ? 'video' : 'img');
      media.src = url;
      if (media.tagName === 'VIDEO') { media.muted = true; media.playsInline = true; }
      else media.alt = `Preview of ${file.name}`;
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = '×';
      remove.setAttribute('aria-label', `Remove ${file.name}`);
      remove.addEventListener('click', () => {
        selectedFiles.splice(index, 1);
        renderPreviews();
      });
      item.append(media, remove);
      elements.preview.append(item);
    });
    if (selectedFiles.length) {
      const total = document.createElement('span');
      total.className = 'preview-more';
      total.textContent = `${selectedFiles.length} file${selectedFiles.length === 1 ? '' : 's'} selected`;
      elements.preview.append(total);
    }
  }

  function handleFiles(files) {
    const candidates = [...files];
    const accepted = [];
    const rejected = [];
    candidates.forEach(file => {
      if (!ALLOWED_TYPES.test(file.type)) rejected.push(`${file.name}: unsupported format`);
      else if (file.size > MAX_FILE_SIZE) rejected.push(`${file.name}: larger than 25 MB`);
      else if (selectedFiles.length + accepted.length >= 30) rejected.push(`${file.name}: the limit is 30 files per memory`);
      else accepted.push(file);
    });
    selectedFiles.push(...accepted);
    renderPreviews();
    if (rejected.length) setMessage(elements.uploadMessage, rejected.slice(0, 2).join('. '), true);
    else if (accepted.length) setMessage(elements.uploadMessage, `${accepted.length} file${accepted.length === 1 ? '' : 's'} ready to add.`);
  }

  function openViewer(memory) {
    currentViewer = memory;
    viewerIndex = 0;
    renderViewerMedia();
    elements.lightboxCategory.textContent = memory.category;
    elements.lightboxTitle.textContent = memory.title;
    elements.lightboxDescription.textContent = memory.description || '';
    elements.lightboxDate.textContent = formatDate(memory.date);
    elements.dialog.showModal();
    document.body.classList.add('dialog-open');
  }

  function renderViewerMedia() {
    if (!currentViewer) return;
    const mediaItems = currentViewer.media?.length
      ? currentViewer.media.map(item => ({ blob: item.blob, type: item.type }))
      : [{ url: currentViewer.image, type: 'image/*', alt: currentViewer.alt || currentViewer.title }];
    viewerIndex = (viewerIndex + mediaItems.length) % mediaItems.length;
    const item = mediaItems[viewerIndex];
    elements.lightboxMedia.replaceChildren();
    const mediaElement = document.createElement(item.type.startsWith('video/') ? 'video' : 'img');
    if (item.blob) mediaElement.src = URL.createObjectURL(item.blob);
    else mediaElement.src = item.url;
    if (mediaElement.tagName === 'VIDEO') { mediaElement.controls = true; mediaElement.autoplay = true; mediaElement.playsInline = true; }
    else mediaElement.alt = item.alt;
    elements.lightboxMedia.append(mediaElement);
    elements.lightboxCount.textContent = `${viewerIndex + 1} / ${mediaItems.length}`;
    const controls = document.querySelector('.lightbox-controls');
    controls.hidden = mediaItems.length < 2;
  }

  function closeViewer() {
    const activeMedia = elements.lightboxMedia.querySelector('video');
    if (activeMedia) activeMedia.pause();
    const image = elements.lightboxMedia.querySelector('img, video');
    if (image?.src.startsWith('blob:')) URL.revokeObjectURL(image.src);
    elements.dialog.close();
    document.body.classList.remove('dialog-open');
    currentViewer = null;
  }

  function bindEvents() {
    elements.menuToggle.addEventListener('click', () => {
      const isExpanded = elements.menuToggle.getAttribute('aria-expanded') === 'true';
      elements.menuToggle.setAttribute('aria-expanded', String(!isExpanded));
      elements.menuToggle.setAttribute('aria-label', isExpanded ? 'Open navigation menu' : 'Close navigation menu');
      elements.nav.classList.toggle('is-open', !isExpanded);
    });
    elements.nav.addEventListener('click', event => {
      if (event.target.closest('a')) {
        elements.menuToggle.setAttribute('aria-expanded', 'false');
        elements.menuToggle.setAttribute('aria-label', 'Open navigation menu');
        elements.nav.classList.remove('is-open');
      }
    });

    elements.filterButtons.forEach(button => button.addEventListener('click', () => {
      activeCategory = button.dataset.category;
      elements.filterButtons.forEach(filter => {
        const selected = filter === button;
        filter.classList.toggle('is-active', selected);
        filter.setAttribute('aria-pressed', String(selected));
      });
      renderGallery();
    }));
    elements.search.addEventListener('input', renderGallery);
    elements.fileInput.addEventListener('change', () => handleFiles(elements.fileInput.files));

    const dropZone = document.querySelector('.drop-zone');
    ['dragenter', 'dragover'].forEach(eventName => dropZone.addEventListener(eventName, event => {
      event.preventDefault();
      dropZone.classList.add('is-dragging');
    }));
    ['dragleave', 'drop'].forEach(eventName => dropZone.addEventListener(eventName, event => {
      event.preventDefault();
      dropZone.classList.remove('is-dragging');
    }));
    dropZone.addEventListener('drop', event => handleFiles(event.dataTransfer.files));

    elements.uploadForm.addEventListener('submit', async event => {
      event.preventDefault();
      setMessage(elements.uploadMessage, '');
      if (!elements.uploadForm.reportValidity()) return;
      if (!selectedFiles.length) {
        setMessage(elements.uploadMessage, 'Please choose at least one photo or video to add.', true);
        elements.fileInput.focus();
        return;
      }
      if (!database) {
        setMessage(elements.uploadMessage, 'Local storage is unavailable, so this memory cannot be saved. Try another modern browser.', true);
        return;
      }
      const formData = new FormData(elements.uploadForm);
      const memory = {
        id: `memory-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        title: formData.get('title').trim(),
        category: formData.get('category'),
        date: formData.get('date'),
        description: formData.get('description').trim(),
        createdAt: new Date().toISOString(),
        media: selectedFiles.map(file => ({ name: file.name, type: file.type, blob: file }))
      };
      try {
        await saveMemory(memory);
        savedMemories.unshift(memory);
        elements.uploadForm.reset();
        selectedFiles = [];
        clearPreviews();
        setMessage(elements.uploadMessage, 'Your memory is saved on this device.');
        renderGallery();
        showToast('Memory added to your collection.');
      } catch (error) {
        console.error('Could not save memory:', error);
        setMessage(elements.uploadMessage, 'Could not save this memory. Your browser may be out of storage space.', true);
      }
    });

    elements.grid.addEventListener('click', async event => {
      const deleteButton = event.target.closest('[data-delete]');
      if (deleteButton) {
        const memory = savedMemories.find(item => item.id === deleteButton.dataset.delete);
        if (!memory || !window.confirm(`Delete “${memory.title}” and its saved media from this browser?`)) return;
        try {
          await removeMemory(memory.id);
          savedMemories = savedMemories.filter(item => item.id !== memory.id);
          renderGallery();
          showToast('Memory deleted from this device.');
        } catch (error) {
          console.error('Could not delete memory:', error);
          showToast('Could not delete this memory. Please try again.');
        }
        return;
      }
      const viewButton = event.target.closest('[data-view]');
      if (viewButton) {
        const memory = getAllMemories().find(item => item.id === viewButton.dataset.view);
        if (memory) openViewer(memory);
      }
    });

    document.querySelector('.lightbox-close').addEventListener('click', closeViewer);
    elements.dialog.addEventListener('click', event => { if (event.target === elements.dialog) closeViewer(); });
    elements.dialog.addEventListener('cancel', () => document.body.classList.remove('dialog-open'));
    document.querySelector('#lightbox-prev').addEventListener('click', () => { viewerIndex -= 1; renderViewerMedia(); });
    document.querySelector('#lightbox-next').addEventListener('click', () => { viewerIndex += 1; renderViewerMedia(); });

    elements.contactForm.addEventListener('submit', event => {
      event.preventDefault();
      setMessage(elements.contactMessage, '');
      const name = elements.contactForm.elements.name.value.trim();
      const email = elements.contactForm.elements.email.value.trim();
      const message = elements.contactForm.elements.message.value.trim();
      const emailIsValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      if (!name || !email || !message) {
        setMessage(elements.contactMessage, 'Please complete every field before submitting.', true);
        return;
      }
      if (!emailIsValid) {
        setMessage(elements.contactMessage, 'Please enter a valid email address.', true);
        elements.contactForm.elements.email.focus();
        return;
      }
      elements.contactForm.reset();
      setMessage(elements.contactMessage, 'Thanks for your note. This demo does not send or store messages.');
    });

    document.querySelector('#copyright-year').textContent = String(new Date().getFullYear());
  }

  async function initialize() {
    bindEvents();
    try {
      database = await openDatabase();
      savedMemories = await getSavedMemories();
    } catch (error) {
      console.warn('Local memory storage is unavailable:', error);
      setMessage(elements.uploadMessage, 'Local storage is unavailable. Browsing sample memories still works, but uploads cannot be saved.', true);
    }
    renderGallery();
  }

  initialize();
})();
