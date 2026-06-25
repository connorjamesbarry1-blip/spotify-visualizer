const CLIENT_ID = '8b5e1e9489994a8fa432b7a3026d0481';
const REDIRECT_URI = 'https://connorjamesbarry1-blip.github.io/spotify-visualizer';
const SCOPES = 'user-read-currently-playing user-read-playback-state streaming user-modify-playback-state';
const AUTH_ENDPOINT = 'https://accounts.spotify.com/authorize';
const TOKEN_ENDPOINT = 'https://accounts.spotify.com/api/token';

// All token state lives here — never written to localStorage or cookies.
let tokenData = null;

// ── PKCE helpers ──────────────────────────────────────────────────────────────

function generateVerifier(length = 128) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => chars[b % chars.length]).join('');
}

async function sha256(plain) {
  const data = new TextEncoder().encode(plain);
  return crypto.subtle.digest('SHA-256', data);
}

function base64url(buffer) {
  const bytes = new Uint8Array(buffer);
  let str = '';
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Generate PKCE challenge and redirect the browser to Spotify's auth page.
 * The code verifier is stashed in sessionStorage so it survives the redirect.
 */
export async function redirectToSpotify() {
  const verifier = generateVerifier();
  const challenge = base64url(await sha256(verifier));

  sessionStorage.setItem('pkce_verifier', verifier);

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    code_challenge_method: 'S256',
    code_challenge: challenge,
    scope: SCOPES,
  });

  window.location.href = `${AUTH_ENDPOINT}?${params}`;
}

/**
 * Called on page load when ?code= is present in the URL.
 * Exchanges the code for tokens and stores them in memory only.
 * Returns true on success, false if no code param is present.
 * Throws on auth error or failed token exchange.
 */
export async function handleCallback() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const error = params.get('error');

  // Strip query string immediately — the code is single-use and should not
  // survive a refresh.
  window.history.replaceState({}, document.title, window.location.pathname);

  if (error) throw new Error(`Spotify denied access: ${error}`);
  if (!code) return false;

  const verifier = sessionStorage.getItem('pkce_verifier');
  sessionStorage.removeItem('pkce_verifier');

  if (!verifier) throw new Error('Auth session expired — please try logging in again.');

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: REDIRECT_URI,
    client_id: CLIENT_ID,
    code_verifier: verifier,
  });

  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error_description || json.error || 'Token exchange failed');
  }

  _storeTokens(await res.json());
  return true;
}

/**
 * Returns a valid access token, refreshing automatically when within 60 s of
 * expiry. Returns null if the user is not authenticated.
 */
export async function getAccessToken() {
  if (!tokenData) return null;
  if (Date.now() >= tokenData.expiresAt - 60_000) await _refresh();
  return tokenData?.accessToken ?? null;
}

export function isAuthenticated() {
  return tokenData !== null;
}

export function clearToken() {
  tokenData = null;
}

// ── Internal ──────────────────────────────────────────────────────────────────

function _storeTokens(json) {
  tokenData = {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: Date.now() + json.expires_in * 1000,
  };
}

async function _refresh() {
  if (!tokenData?.refreshToken) { tokenData = null; return; }

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: tokenData.refreshToken,
    client_id: CLIENT_ID,
  });

  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!res.ok) { tokenData = null; return; }

  const json = await res.json();
  // Spotify may omit a new refresh token; keep the current one if so.
  _storeTokens({ ...json, refresh_token: json.refresh_token || tokenData.refreshToken });
}
