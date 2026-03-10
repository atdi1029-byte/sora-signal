# Podcast Command Center — Project Notes

## Concept
A podcast "command center" PWA — two main jobs: **audio playback** and **organizing the data**. You already know what you like. The problem is managing hundreds of episodes across multiple shows, tracking what's played, and not losing stuff in the noise. Listen to audio right in the app, or tap out to YouTube when you want video — either way, the app keeps everything organized and synced.

## Stack
- Single-file HTML PWA (same as other apps)
- Dark theme
- Apps Script cloud sync (subscriptions, listen progress, timestamps, folders)
- Service worker for offline/caching

## Data Sources
- **iTunes Search API** (free, no key) — search podcasts, get artwork, RSS feed URL, categories
  - `https://itunes.apple.com/search?term=QUERY&media=podcast`
- **RSS feeds** — episode list, descriptions, audio URLs, artwork
- **YouTube channel link** — optional per podcast, opens in YouTube app on Android

## Core Features

### Subscribe Flow
1. Search by name → hits iTunes API
2. Browse results — artwork, title, author, category
3. Tap to subscribe → auto-pulls RSS feed, adds to library
4. Assign to a folder/tag

### Episode Management
- Smart filters: new, in progress, finished, favorites
- Pin episodes to save for later
- Mark as played (cross off) — works whether you listened in-app or watched on YouTube
- Hide old episodes — only show recent/unplayed by default
- Search within a podcast by keyword
- Sort: newest, oldest, shortest, longest

### Playback
- Stream audio in-app with controls (speed, skip 30s, etc.)
- YouTube icon per episode → opens directly in YouTube app on Android
- Either way, mark as played from the app

### Organization
- Custom folders/tags (e.g. "Finance", "Tech", "Chill")
- Filter/browse by folder
- Clean feed — no algorithm, no clutter, just what you want

### Cloud Sync (Apps Script)
- Subscriptions list
- Listen progress / timestamps
- Played/unplayed status
- Folders/tags
- Same pattern: auto-push on change, auto-pull on load + resume, fireGet for writes

### Hybrid Approach — Three Sources
- **RSS feeds** — audio plays directly in-app
- **YouTube** — link per podcast, tap to open in YouTube app on Android
- **Spotify** — link per podcast, tap to open in Spotify app (for Spotify-exclusive shows)
- iTunes API for discovery + auto-pull RSS
- Manual RSS paste for niche/private feeds
- App is the command center — tracks played/unplayed/pins/folders regardless of where you actually consume the episode
- **Unified episode list** — merge episodes from all sources (RSS + YouTube + Spotify) into one deduplicated feed per podcast. Spotify exclusives, YouTube-only content, RSS-only — all show up in one place. Each episode shows which platform(s) it's available on.

## Use Case Example
- Subscribe to Podpah (500+ episodes)
- Only see latest by default, not all 500
- Pin specific episodes to watch later
- Tap YouTube icon → opens in YouTube app
- Come back to podcast app → mark as played
- Everything synced across devices

## Status
- **Tabled for future build**
- Project folder created, notes saved
