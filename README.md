# RamadanReady

A Progressive Web App (PWA) for managing Ramadan fasting calendars with offline support, alarms, and notifications.

**Live URL:** https://muhammad-farzad-ali.github.io/RamadanReady/

## Features

- **Calendar Management** - Create, edit, duplicate, and delete fasting calendars
- **Daily View** - See today's Sahar (pre-dawn meal) and Iftar (breaking fast) times
- **Countdown Timer** - Live countdown to next fasting event
- **Alarm Notifications** - Get notified before Sahar ends and Iftar begins
- **Import/Export** - Share calendars via JSON files
- **Offline Support** - Works without internet once installed
- **PWA Support** - Install as a standalone app on Android and iOS

## Quick Start

### Installation on Android

1. Open Chrome and visit: `https://muhammad-farzad-ali.github.io/RamadanReady/`
2. Wait for the "Add to Home Screen" prompt (or tap menu → "Add to Home Screen")
3. Tap "Install"
4. Open from your home screen like a regular app

### Installation on iOS

1. Open Safari and visit: `https://muhammad-farzad-ali.github.io/RamadanReady/`
2. Tap the Share button
3. Scroll down and tap "Add to Home Screen"
4. Tap "Add"

### First Use

1. **Create a Calendar** - Go to "Calendars" tab and click "Create New Calendar"
2. **Add Day Data** - Fill in the 30-day table with dates and times
3. **Set Alarms** - Go to "Settings" and enable alarms
4. **Allow Notifications** - Grant notification permission when prompted

## Development

### File Structure

```
/root
  index.html              # Main entry point
  /css/styles.css         # All styles (mobile-first responsive)
  /js/
    app.js               # Main application logic and UI
    db.js                # IndexedDB data layer
    alarms.js            # Alarm scheduling and notifications
    file-handler.js      # Import/Export functionality
  /icons/
    icon-192x192.svg     # PWA icon (192px)
    icon-512x512.svg     # PWA icon (512px)
    apple-touch-icon.svg # iOS icon
    favicon-32x32.svg    # Browser favicon
  manifest.json          # PWA manifest
  service-worker.js      # Offline support
  README.md              # This file
```

### Technology Stack

- **Frontend:** Vanilla HTML5, CSS3, JavaScript (ES6+)
- **Storage:** IndexedDB (calendars), LocalStorage (settings)
- **PWA:** Service Worker, Web App Manifest
- **Notifications:** Notification API, Service Worker notifications
- **Hosting:** GitHub Pages (static)

### Local Development

Since this is a static site, you can run it locally with any simple HTTP server:

```bash
# Using Python 3
python -m http.server 8000

# Using Node.js (http-server package)
npx http-server

# Using PHP
php -S localhost:8000
```

Then open `http://localhost:8000` in your browser.

### Building for Production

This project requires no build step! It's ready to deploy as-is.

**To generate PNG icons from SVGs** (optional but recommended):

```bash
# Using ImageMagick
convert icons/icon-192x192.svg icons/icon-192x192.png
convert icons/icon-512x512.svg icons/icon-512x512.png
convert icons/apple-touch-icon.svg icons/apple-touch-icon.png
convert icons/favicon-32x32.svg icons/favicon-32x32.png

# Or use an online converter like cloudconvert.com
```

Then update `manifest.json` and `index.html` to reference `.png` instead of `.svg`.

## Deployment

### GitHub Pages Setup

1. Push code to GitHub repository
2. Go to Settings → Pages
3. Source: Deploy from a branch
4. Branch: `main` / `root`
5. Save

Site will be live at: `https://muhammad-farzad-ali.github.io/RamadanReady/`

### Custom Domain (Optional)

1. Add `CNAME` file with your domain
2. Configure DNS records
3. Update `manifest.json` paths if needed

## Calendar Format

Calendars are stored as JSON with this structure:

```json
{
  "name": "Ramadan 2026",
  "year": 2026,
  "days": [
    {
      "date": "21-02",
      "saharTime": "05:30",
      "iftarTime": "18:45"
    }
  ]
}
```

### Import/Export

- **Export:** Downloads JSON file with all calendar data
- **Import:** Validates and imports calendars from JSON files
- **Share:** Use OS share sheet (Android) or download and share manually

## Technical Details

### Data Storage

- **IndexedDB:** Stores calendar data locally in browser
- **LocalStorage:** Stores settings and active calendar ID
- **No Server:** All data stays on device

### Alarm System

- Uses `setTimeout` for scheduling (browser limitation)
- Stores alarm times in LocalStorage
- Checks for missed alarms on app load
- Notifications via Notification API

### Offline Support

- Service Worker caches all static assets
- Cache-first strategy for instant loading
- IndexedDB works offline
- All features functional without internet

### Browser Support

- **Chrome/Edge (Desktop):** Full support
- **Chrome (Android):** Full support with PWA install
- **Safari (iOS):** Partial support (no background sync)
- **Firefox:** Full support except background notifications

## Testing Checklist

### Functional Testing

- [ ] Create a new calendar
- [ ] Edit calendar details
- [ ] Duplicate a calendar
- [ ] Delete a calendar
- [ ] Set active calendar
- [ ] View today's times on home screen
- [ ] Countdown timer updates correctly
- [ ] Export single calendar
- [ ] Export all calendars
- [ ] Import valid JSON file
- [ ] Import invalid file shows error
- [ ] Share calendar (Android)

### Settings Testing

- [ ] Enable alarms
- [ ] Change alarm minutes
- [ ] Save settings persist
- [ ] Disable alarms
- [ ] Clear all data

### PWA Testing

- [ ] Install on Android
- [ ] Install on iOS
- [ ] App opens in standalone mode
- [ ] Icons display correctly
- [ ] Splash screen shows

### Offline Testing

- [ ] Enable airplane mode
- [ ] All screens accessible
- [ ] CRUD operations work
- [ ] Import/Export work
- [ ] No console errors

### Alarm Testing

- [ ] Set test alarm 1 minute away
- [ ] Notification appears
- [ ] Missed alarm detected on reopen
- [ ] Alarm settings respected

## Known Limitations

1. **Background Alarms:** Not 100% reliable due to browser limitations. Best when app opened recently.
2. **iOS:** Some features limited due to Safari restrictions (background sync, persistent storage)
3. **Storage:** Data lost if user clears browser storage
4. **Time Zones:** Uses device local time only
5. **Auto-Calculation:** Doesn't auto-calculate prayer times (manual entry required)

## Roadmap

### Phase 1: MVP (Complete)
- Calendar management
- Basic UI
- Import/Export

### Phase 2: Alarms (Complete)
- Notification system
- Missed alarm detection

### Phase 3: PWA (Complete)
- Service Worker
- Offline support
- Install prompts

### Future Enhancements
- Multiple alarm sounds
- Dark mode
- Auto-fill dates
- Prayer time calculation integration
- Backup to cloud storage
- Multi-language support

## Contributing

This is a personal project, but suggestions are welcome!

## License

MIT License - feel free to use and modify.

## Acknowledgments

- Islamic crescent moon icon design
- Ramadan Mubarak to all users

---

**Note:** All data is stored locally on your device. No data is sent to any server.
