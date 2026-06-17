# Yeshivah Tapes Audio Library

A sleek audio-library website that runs on Windows and builds browsable pages from audio-file metadata.

## Windows launch

1. Install Node.js LTS from <https://nodejs.org/>.
2. Put audio files in the included `audio` folder, or set an `AUDIO_DIR` environment variable to another Windows folder.
3. Double-click `launch-library.bat`.
4. The site opens at <http://localhost:3131>.

## Features

- Scans MP3, M4A, AAC, FLAC, WAV, OGG, OPUS, and WMA files from the configured folder.
- Creates individual pages for every audio file.
- Groups browsing by album title and by speaker.
- Generates descriptions from embedded metadata such as title, speaker/artist, album, year, genre, and duration.
- Streams audio locally with browser playback controls.
- Automatically refreshes the library every 15 minutes.

## Configuration

By default the app reads from `./audio`. To use another Windows folder, set `AUDIO_DIR` before launching:

```bat
set AUDIO_DIR=C:\Users\YourName\Music\Yeshivah Tapes
launch-library.bat
```

You can also run it directly:

```bash
npm install
npm start
```
