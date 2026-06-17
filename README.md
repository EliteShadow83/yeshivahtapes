# Yeshivah Tapes Audio Library

A sleek audio-library website that runs on Windows and builds browsable pages from audio-file metadata.

## Windows launch

1. Install Node.js LTS from <https://nodejs.org/>.
2. Put audio files in `D:\Yeshivahtapes`.
3. Double-click `launch-library.bat`.
4. The site opens at <http://localhost:3131>.

## Features

- Scans MP3, M4A, AAC, FLAC, WAV, OGG, OPUS, and WMA files from the configured folder.
- Creates individual pages for every audio file.
- Groups browsing categories by album title and speaker.
- Generates descriptions from embedded metadata such as title, speaker/artist, album, year, genre, and duration.
- Streams audio locally with browser playback controls.
- Automatically refreshes the library every 15 minutes.
- Provides a direct-only management page at `/manage.html` for uploading, renaming, and deleting recordings and creating custom side-navigation pages, and nesting those pages under custom side-navigation subcategories.

## Audio directory

The app permanently reads from `D:\Yeshivahtapes`. Create that folder in Windows and place your audio files there before launching.

You can also run it directly:

```bash
npm install
npm start
```
