// ===== V2 API CLIENT WITH SESSION AUTH =====
// All protected calls include the session token automatically.
// AUTH_REQUIRED responses trigger re-login.

var API_URL = 'https://script.google.com/macros/s/AKfycbylwNtGFQf3GCKoNOSK2tbKfwwVkBI1eZb-Wql97vHrI2_aJe4mGMAgCi6tFt3Y2asT6w/exec';

function getAuthToken() {
  return localStorage.getItem('rishtas_authToken') || '';
}

function handleAuthError(data) {
  if (data && data.error === 'AUTH_REQUIRED') {
    localStorage.removeItem('rishtas_authToken');
    localStorage.removeItem('rishtas_sessionExpiry');
    localStorage.removeItem('rishtas_sessionEmail');
    localStorage.removeItem('rishtas_sessionRid');
    localStorage.removeItem('rishtas_sessionGender');
    localStorage.removeItem('rishtas_encKey');
    sessionStorage.clear();
    try { var keys = []; for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k && k.indexOf('rishtas_') === 0) keys.push(k); } keys.forEach(function(k) { localStorage.removeItem(k); }); } catch(e) {}
    showAlert('Session expired. Please login again.');
    showLoginForm();
    throw new Error('AUTH_REQUIRED');
  }
}

var api = {
  get: function(action, params) {
    var url = API_URL + '?action=' + encodeURIComponent(action);
    // Always include token for protected endpoints
    var token = getAuthToken();
    if (token) url += '&token=' + encodeURIComponent(token);
    if (params) { for (var key in params) { if (params[key] !== undefined && params[key] !== null) url += '&' + encodeURIComponent(key) + '=' + encodeURIComponent(params[key]); } }
    return fetch(url).then(function(r) { return r.json(); }).then(function(r) {
      handleAuthError(r);
      if (!r.ok) throw new Error(r.error || 'API error');
      return r.data;
    });
  },

  post: function(action, body) {
    body = body || {};
    body.action = action;
    body.token = getAuthToken();
    // Apps Script redirects POST, so we use GET with encoded body for reliability
    var url = API_URL + '?payload=' + encodeURIComponent(JSON.stringify(body));
    return fetch(url).then(function(r) { return r.json(); }).then(function(r) {
      handleAuthError(r);
      if (!r.ok) throw new Error(r.error || 'API error');
      return r.data;
    });
  },

  // POST with actual body (needed for large payloads like file uploads)
  postDirect: function(action, body) {
    body = body || {};
    body.action = action;
    body.token = getAuthToken();
    return fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(body),
      redirect: 'follow'
    }).then(function(r) { return r.json(); }).then(function(r) {
      handleAuthError(r);
      if (!r.ok) throw new Error(r.error || 'API error');
      return r.data;
    });
  },
  checkLogin: function(email, password, captcha) {
    return api.post('checkLogin', { email: email, password: password, captcha: captcha });
  },
  appendProfile: function(profile) {
    return api.post('appendProfile', { profile: profile });
  },
  requestPasswordReset: function(email, captcha) {
    return api.post('requestPasswordReset', { email: email, captcha: captcha });
  },
  verifyOTPAndReset: function(email, otp, newPassword, captcha) {
    return api.post('verifyOTPAndReset', { email: email, otp: otp, newPassword: newPassword, captcha: captcha });
  },
  getTimestamps: function() {
    return api.get('getTimestamps');
  },

  // ===== PROTECTED (token auto-included) =====
  getProfiles: function(email, gender, page) {
    return api.get('getProfiles', { gender: gender, page: page });
  },
  getUserWishlist: function(rid) {
    return api.get('getUserWishlist', { rid: rid });
  },
  getUserInterests: function(rid) {
    return api.get('getUserInterests', { rid: rid });
  },
  getSession: function() {
    return api.get('getSession');
  },
  updateUserProfile: function(profile, captcha) {
    return api.post('updateUserProfile', { profile: profile, captcha: captcha });
  },
  uploadFile: function(base64) {
    return api.postDirect('uploadFile', { base64: base64 });
  },
  addToWishlist: function(email, rid) {
    return api.post('addToWishlist', { email: email, rid: rid });
  },
  removeFromWishlist: function(email, rid) {
    return api.post('removeFromWishlist', { email: email, rid: rid });
  },
  sendInterest: function(email, rid) {
    return api.post('sendInterest', { email: email, rid: rid });
  },
  acceptInterest: function(email, rid) {
    return api.post('acceptInterest', { email: email, rid: rid });
  },
  cancelInterest: function(email, rid) {
    return api.post('cancelInterest', { email: email, rid: rid });
  },
  deleteInterest: function(email, rid) {
    return api.post('deleteInterest', { email: email, rid: rid });
  },
  deleteAccount: function() {
    return api.post('deleteAccount');
  },
  changePassword: function(oldPassword, newPassword) {
    return api.post('changePassword', { oldPassword: oldPassword, newPassword: newPassword });
  },
  blockUser: function(blockedRid) {
    return api.post('blockUser', { blockedRid: blockedRid });
  },
  unblockUser: function(blockedRid) {
    return api.post('unblockUser', { blockedRid: blockedRid });
  },
  getBlockedUsers: function() {
    return api.post('getBlockedUsers');
  },
  logout: function() {
    return api.post('logout');
  }
};
