# RamadanReady

A Progressive Web App for managing Ramadan fasting calendars with offline support.

## Features

- Create and manage multiple Ramadan calendars
- Set alarms for Sahar and Iftar times
- Import/Export calendars as JSON
- Works offline (PWA)
- Notifications for fasting times
- Mobile-friendly responsive design

## Installation

Visit: `https://muhammad-farzad-ali.github.io/RamadanReady/`

On Android Chrome:
1. Open the URL
2. Tap "Add to Home Screen" when prompted
3. App installs as standalone PWA

## Development

This is a static site designed for GitHub Pages hosting.

### File Structure

```
/root
  index.html          # Main entry point
  /css/styles.css     # Styles
  /js/
    app.js            # Main application logic
    db.js             # IndexedDB data layer
    alarms.js         # Alarm scheduling
    file-handler.js   # Import/Export
  /icons/             # PWA icons
  manifest.json       # PWA manifest
  service-worker.js   # Offline support
```

## License

MIT
