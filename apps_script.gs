// Sora Signal — Google Apps Script Backend
// Deploy as web app: Execute as Me, Anyone can access
// SETUP: Enable "YouTube Data API v3" in Services (+ icon in Apps Script editor)
// SETUP: Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET in Script Properties

const SHEET_NAME = 'PodcastData';

function doGet(e) {
  const action = (e.parameter.action || '').toLowerCase();
  const callback = e.parameter.callback || '';

  let result;
  try {
    switch (action) {
      case 'podcast_sync_pull':
        result = pullData_();
        break;
      case 'podcast_sync_push':
        result = pushData_(e.parameter.data);
        break;
      case 'fetch_rss':
        return fetchRSS_(e.parameter.url, callback);
      case 'fetch_youtube':
        result = fetchYouTubeVideos_(e.parameter.channel);
        break;
      case 'fetch_spotify':
        result = fetchSpotifyEpisodes_(e.parameter.show);
        break;
      default:
        result = { error: 'Unknown action: ' + action };
    }
  } catch (err) {
    result = { error: err.message };
  }

  const json = JSON.stringify(result);
  if (callback) {
    return ContentService.createTextOutput(callback + '(' + json + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}

// ===== SHEET SYNC =====

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.getRange('A1').setValue('{}');
    sheet.getRange('B1').setValue(0);
  }
  return sheet;
}

function pullData_() {
  const sheet = getSheet_();
  const data = sheet.getRange('A1').getValue() || '{}';
  const ts = sheet.getRange('B1').getValue() || 0;
  return { data: typeof data === 'string' ? JSON.parse(data) : data, timestamp: ts };
}

function pushData_(dataStr) {
  if (!dataStr) return { error: 'No data provided' };
  const sheet = getSheet_();
  const data = typeof dataStr === 'string' ? JSON.parse(decodeURIComponent(dataStr)) : dataStr;
  sheet.getRange('A1').setValue(JSON.stringify(data));
  sheet.getRange('B1').setValue(Date.now());
  return { ok: true, timestamp: Date.now() };
}

// ===== RSS PROXY =====

function fetchRSS_(url, callback) {
  if (!url) {
    const err = JSON.stringify({ error: 'No URL provided' });
    if (callback) {
      return ContentService.createTextOutput(callback + '(' + err + ')')
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
    return ContentService.createTextOutput(err)
      .setMimeType(ContentService.MimeType.JSON);
  }

  try {
    const response = UrlFetchApp.fetch(decodeURIComponent(url), {
      muteHttpExceptions: true,
      followRedirects: true
    });
    const content = response.getContentText();

    if (callback) {
      const escaped = JSON.stringify(content);
      return ContentService.createTextOutput(callback + '(' + escaped + ')')
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
    return ContentService.createTextOutput(content)
      .setMimeType(ContentService.MimeType.XML);
  } catch (err) {
    const errJson = JSON.stringify({ error: err.message });
    if (callback) {
      return ContentService.createTextOutput(callback + '(' + errJson + ')')
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
    return ContentService.createTextOutput(errJson)
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ===== YOUTUBE DATA API =====
// Requires: YouTube Data API v3 enabled in Services

function fetchYouTubeVideos_(channelInput) {
  if (!channelInput) return { error: 'No channel provided' };
  channelInput = decodeURIComponent(channelInput);

  // Resolve channel ID from URL or handle
  const channelId = resolveYouTubeChannel_(channelInput);
  if (!channelId) return { error: 'Could not resolve channel: ' + channelInput };

  // Get uploads playlist ID
  const channelResp = YouTube.Channels.list('contentDetails', { id: channelId });
  if (!channelResp.items || !channelResp.items.length) return { error: 'Channel not found' };
  const uploadsId = channelResp.items[0].contentDetails.relatedPlaylists.uploads;

  // Fetch all videos from uploads playlist (paginated)
  const videos = [];
  let pageToken = '';
  let maxPages = 20; // safety limit (~1000 videos)

  do {
    const opts = { playlistId: uploadsId, maxResults: 50 };
    if (pageToken) opts.pageToken = pageToken;
    const resp = YouTube.PlaylistItems.list('snippet', opts);

    (resp.items || []).forEach(item => {
      const s = item.snippet;
      videos.push({
        videoId: s.resourceId.videoId,
        title: s.title,
        date: s.publishedAt,
        thumbnail: (s.thumbnails && s.thumbnails.medium) ? s.thumbnails.medium.url : '',
        url: 'https://www.youtube.com/watch?v=' + s.resourceId.videoId
      });
    });

    pageToken = resp.nextPageToken || '';
    maxPages--;
  } while (pageToken && maxPages > 0);

  return { videos: videos, count: videos.length, channelId: channelId };
}

function resolveYouTubeChannel_(input) {
  // If it's already a channel ID
  if (/^UC[a-zA-Z0-9_-]{22}$/.test(input)) return input;

  // Extract from URL patterns
  let match;

  // youtube.com/channel/UCxxxxx
  match = input.match(/channel\/(UC[a-zA-Z0-9_-]+)/);
  if (match) return match[1];

  // youtube.com/@handle or youtube.com/handle
  match = input.match(/youtube\.com\/@?([a-zA-Z0-9_-]+)/);
  if (match) {
    const handle = match[1];
    // Search for channel by handle
    try {
      const resp = YouTube.Search.list('snippet', {
        q: handle,
        type: 'channel',
        maxResults: 1
      });
      if (resp.items && resp.items.length) {
        return resp.items[0].snippet.channelId;
      }
    } catch (e) {
      // Try forHandle if available
    }

    // Try channels.list with forHandle (newer API)
    try {
      const resp = YouTube.Channels.list('id', { forHandle: handle });
      if (resp.items && resp.items.length) {
        return resp.items[0].id;
      }
    } catch (e) {}
  }

  return null;
}

// ===== SPOTIFY API =====
// Requires: SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET in Script Properties
// Get these from https://developer.spotify.com/dashboard

function getSpotifyToken_() {
  const props = PropertiesService.getScriptProperties();
  const clientId = props.getProperty('SPOTIFY_CLIENT_ID');
  const clientSecret = props.getProperty('SPOTIFY_CLIENT_SECRET');

  if (!clientId || !clientSecret) return null;

  const resp = UrlFetchApp.fetch('https://accounts.spotify.com/api/token', {
    method: 'post',
    headers: {
      'Authorization': 'Basic ' + Utilities.base64Encode(clientId + ':' + clientSecret),
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    payload: 'grant_type=client_credentials',
    muteHttpExceptions: true
  });

  const data = JSON.parse(resp.getContentText());
  return data.access_token || null;
}

function fetchSpotifyEpisodes_(showInput) {
  if (!showInput) return { error: 'No show provided' };
  showInput = decodeURIComponent(showInput);

  // Extract show ID from URL
  const match = showInput.match(/show\/([a-zA-Z0-9]+)/);
  const showId = match ? match[1] : showInput;

  const token = getSpotifyToken_();
  if (!token) return { error: 'Spotify credentials not configured. Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET in Script Properties.' };

  // Fetch all episodes (paginated)
  const episodes = [];
  let offset = 0;
  const limit = 50;
  let maxPages = 20; // safety limit (~1000 episodes)

  do {
    const resp = UrlFetchApp.fetch(
      'https://api.spotify.com/v1/shows/' + showId + '/episodes?market=US&limit=' + limit + '&offset=' + offset,
      {
        headers: { 'Authorization': 'Bearer ' + token },
        muteHttpExceptions: true
      }
    );

    const data = JSON.parse(resp.getContentText());
    if (data.error) return { error: data.error.message };

    (data.items || []).forEach(ep => {
      episodes.push({
        spotifyId: ep.id,
        title: ep.name,
        date: ep.release_date,
        duration: ep.duration_ms ? Math.round(ep.duration_ms / 1000) : 0,
        description: (ep.description || '').substring(0, 200),
        url: ep.external_urls ? ep.external_urls.spotify : 'https://open.spotify.com/episode/' + ep.id
      });
    });

    offset += limit;
    maxPages--;
    if (!data.next) break;
  } while (maxPages > 0);

  return { episodes: episodes, count: episodes.length, showId: showId };
}
