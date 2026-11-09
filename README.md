# Memory Collection

A simple, responsive family-memory website for collecting and revisiting photos and videos from birthdays, weddings, trips, festivals, anniversaries, and everyday moments. Built with semantic HTML, CSS, and vanilla JavaScript—no framework, build step, or server required.

## Features

- Responsive layout with mobile navigation and smooth section links.
- Six sample memory cards, category filters, and title search.
- Upload form with required-field validation, multi-file selection, drag-and-drop, and image/video previews.
- Uploaded media and memory details stored locally in IndexedDB.
- Lightbox viewer with navigation for multiple uploaded files.
- Delete controls for locally saved memories.
- Contact form validation that does not transmit or store messages.
- Keyboard-friendly controls, status messages, and reduced-motion support.

## Technologies

- HTML5
- CSS3
- Vanilla JavaScript (ES6+)
- IndexedDB for local media persistence

## Project structure

```text
memory-collection/
├── index.html
├── css/
│   └── style.css
├── js/
│   └── script.js
├── assets/
│   └── images/
└── README.md
```

The sample and hero photographs are royalty-free image links from Unsplash. An internet connection is needed to load these remote images and the optional Google Fonts; the core layout and upload features are otherwise local.

## Run locally

Open `index.html` in a current desktop or mobile browser. No installation or build command is needed. IndexedDB is supported in modern browsers; browser privacy settings, private-browsing modes, or storage limits can affect local persistence. If opening the file directly prevents database access in your browser, serve this folder from a local static web server instead.

## Important storage note

Uploaded media and memory information are kept in IndexedDB on the same browser and device. This is **not cloud storage**: memories are not uploaded to a server and are not shared with family members or other devices. Clearing browser data or removing site storage may permanently delete saved memories. Each file is limited to 25 MB and each memory can contain up to 30 files; actual available storage depends on the browser and device. Keep separate backups of important photos and videos.

Contact form submissions are only validated in the page. They are not sent to a server or saved.
