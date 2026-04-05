// Auth module — Google Identity Services
// Replace GOOGLE_CLIENT_ID with your OAuth 2.0 Client ID from Google Cloud Console
const GOOGLE_CLIENT_ID = 'YOUR_CLIENT_ID.apps.googleusercontent.com';
const AUTH_KEY = 'habit-tracker-user';

function getUser() {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function setUser(user) {
  localStorage.setItem(AUTH_KEY, JSON.stringify(user));
}

function clearUser() {
  localStorage.removeItem(AUTH_KEY);
}

function signOut() {
  clearUser();
  window.location.href = 'index.html';
}

// Decode JWT id_token payload (no verification — client-side only)
function decodeJwt(token) {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64));
  } catch { return null; }
}

// Called by Google Identity Services after sign-in
function handleGoogleCallback(response) {
  const payload = decodeJwt(response.credential);
  if (!payload) return;
  const user = {
    name: payload.name,
    email: payload.email,
    picture: payload.picture,
    sub: payload.sub,
  };
  setUser(user);
  window.location.href = 'dashboard.html';
}

// Show user avatar on dashboard if logged in
function initDashboardAuth() {
  const user = getUser();
  if (!user) {
    window.location.href = 'index.html';
    return;
  }
  const avatar = document.getElementById('user-avatar');
  if (avatar && user.picture) {
    avatar.src = user.picture;
    avatar.alt = user.name;
    avatar.style.display = 'block';
    avatar.title = `${user.name}\n${user.email}`;
  }
}

// Auto-init on dashboard
if (document.getElementById('user-avatar')) {
  initDashboardAuth();
}
