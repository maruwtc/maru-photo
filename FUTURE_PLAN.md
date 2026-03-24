# Future Enhancement Plan

## 1. Background reliability

### Battery optimization and upload resilience

- Detect restricted background state on Android
- Prompt the user to disable battery optimization for the app when backup reliability is affected
- Explain clearly why uploads may pause in the background otherwise
- Add a durable upload queue stored locally in SQLite
- Resume unfinished uploads after app restart
- Retry failed uploads with exponential backoff

### Background execution

- Android:
  - `workmanager` for scheduled/background sync
  - foreground service for long-running uploads
- iOS:
  - `BGProcessingTask`
  - background transfer where platform rules allow it

### Upload policy controls

- Wi‑Fi only uploads
- Charging only uploads
- Pause on low battery
- Disable roaming uploads
- Daily/mobile data usage controls

## 2. Media preview

### Timeline thumbnails

- Show real image thumbnails in the library grid
- Show video thumbnails with duration badges
- Cache thumbnails locally

### Asset detail view

- Full-screen image viewer with zoom and pan
- Video playback screen
- Metadata panel:
  - capture time
  - file size
  - mime type
  - device source

### Progressive loading

- Render thumbnail first
- Load full asset only when opened
- Prefetch nearby assets for smoother browsing

## 3. Google Photos-like product roadmap

### Timeline UX

- Sticky month/day grouping
- Fast date scrubber
- “On this day” memories
- Recent highlights / auto-curated moments

### Backup UX

- Device folder breakdown
- Backup state per asset
- Duplicate detection before upload
- Failed upload retry center
- Upload activity/history screen

### Search and organization

- Albums
- Favorites
- Smart filters:
  - screenshots
  - videos
  - selfies
  - documents
- EXIF-based filtering and sorting
- Search later for:
  - people
  - pets
  - places

### Sharing

- Shared albums
- Private link sharing
- Partner/shared library model

### Storage and sync

- Multi-device sync
- Conflict handling
- Storage quota display
- Reconnect-Microsoft flow when refresh token fails
- Better device onboarding for secondary devices

### Media processing

- Thumbnail and preview generation pipeline
- Video transcoding strategy if needed
- HEIC support
- RAW support
- Live Photo / motion photo handling

### Trust and privacy

- Clear “stored in your Microsoft account” messaging
- Export flow
- Delete flow with backend and remote consistency
- Upload/delete audit log

### Admin and operations

- Upload metrics dashboard
- Failed job monitoring
- Rate limits and abuse controls
- Per-user diagnostics panel

## Recommended implementation order

1. Persistent upload queue + background execution
2. Real image/video preview and thumbnail pipeline
3. Reconnect-Microsoft handling on token failure
4. Album/favorites/timeline grouping
5. Search/filter and sharing
