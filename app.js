// ===== V2 APP.JS =====
// All app logic. Uses api.js (fetch) instead of google.script.run.
// Combined landing + app in single page.

var wishlistload = true, interestlistload = true;
var currentPage = 0, currentEmail = '', currentGender = '';
var _allProfiles = null, _userProfile = null, _displayPage = 0;
var DISPLAY_PAGE_SIZE = 20;
var LS_PREFIX = 'rishtas_';

// ===== CHAR COUNT =====
function updateCharCount(el, countId) {
  var max = Number(el.getAttribute('maxlength')) || 50;
  var len = el.value.length;
  var span = document.getElementById(countId);
  span.textContent = len + '/' + max;
  span.style.color = len >= max ? '#e74c3c' : 'rgba(255,255,255,.4)';
}

// ===== IMAGE COMPRESSION =====
function onFileSelected(input, areaId) {
  var area = document.getElementById(areaId);
  if (input.files && input.files[0]) {
    var name = input.files[0].name;
    if (name.length > 25) name = name.substring(0, 22) + '...';
    area.classList.add('has-file');
    area.querySelector('.upload-text').innerHTML = '<strong>' + name + '</strong>Tap to change';
    area.querySelector('.upload-icon i').className = 'fa-solid fa-check';
  } else {
    area.classList.remove('has-file');
    area.querySelector('.upload-text').innerHTML = '<strong>Upload photo</strong>Click to browse';
    area.querySelector('.upload-icon i').className = 'fa-solid fa-camera';
  }
}
function compressImage(file, maxW, quality, cb) {
  var r = new FileReader();
  r.onload = function(e) {
    var img = new Image();
    img.onload = function() {
      var c = document.createElement('canvas');
      var w = img.width, h = img.height;
      if (w > maxW) { h = h * (maxW / w); w = maxW; }
      c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      cb(c.toDataURL('image/jpeg', quality || 0.7).split(',')[1]);
    };
    img.src = e.target.result;
  };
  r.readAsDataURL(file);
}

// ===== SPARKLE GENERATOR =====
(function() {
  var c = document.getElementById('sparkles');
  if (!c) return;
  var colors = ['rgba(232,160,180,.7)', 'rgba(220,201,160,.6)', 'rgba(255,255,255,.5)'];
  for (var i = 0; i < 60; i++) {
    var s = document.createElement('span');
    s.className = 'sparkle';
    s.style.left = Math.random() * 100 + '%';
    s.style.top = Math.random() * 100 + '%';
    var size = 2 + Math.random() * 3;
    s.style.width = size + 'px';
    s.style.height = size + 'px';
    var col = colors[Math.floor(Math.random() * colors.length)];
    s.style.background = col;
    s.style.color = col;
    s.style.animationDuration = (1.5 + Math.random() * 3) + 's';
    s.style.animationDelay = Math.random() * 6 + 's';
    c.appendChild(s);
  }
})();

// ===== DEBOUNCE =====
function debounce(fn, delay) {
  var t; return function() { var a = arguments, c = this; clearTimeout(t); t = setTimeout(function() { fn.apply(c, a); }, delay); };
}
var debouncedFilterProfiles = debounce(function() { applyFilters(); }, 300);
var debouncedFilterWishlist = debounce(function() { filterCards('searchInput2', 'wishlist-container'); }, 300);

// ===== ENCRYPTED LOCAL STORAGE =====
function _encKey() { var t = sessionStorage.getItem('sessionToken'); return t ? String(t) : 'r1sht4s'; }
function _xorEnc(text, key) { var o = []; for (var i = 0; i < text.length; i++) o.push(String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length))); return btoa(o.join('')); }
function _xorDec(enc, key) { try { var t = atob(enc), o = []; for (var i = 0; i < t.length; i++) o.push(String.fromCharCode(t.charCodeAt(i) ^ key.charCodeAt(i % key.length))); return o.join(''); } catch(e) { return null; } }
function lsGet(k) { try { var r = localStorage.getItem(LS_PREFIX + k); if (!r) return null; var d = _xorDec(r, _encKey()); return d ? JSON.parse(d) : null; } catch(e) { return null; } }
function lsSet(k, v) { try { localStorage.setItem(LS_PREFIX + k, _xorEnc(JSON.stringify(v), _encKey())); } catch(e) {} }
function lsGetTs(k) { return Number(localStorage.getItem(LS_PREFIX + k + '_ts')) || 0; }
function lsSetTs(k, ts) { localStorage.setItem(LS_PREFIX + k + '_ts', String(ts)); }
function isCachedToday(k) { var ts = lsGetTs(k); if (!ts) return false; var c = new Date(ts), n = new Date(); return c.getFullYear() === n.getFullYear() && c.getMonth() === n.getMonth() && c.getDate() === n.getDate(); }

// ===== DAILY SHUFFLE =====
function dailyShuffle(arr) {
  var d = new Date(), seed = d.getFullYear() * 10000 + (d.getMonth()+1) * 100 + d.getDate();
  var s = arr.slice();
  for (var i = s.length - 1; i > 0; i--) { seed = (seed * 9301 + 49297) % 233280; var j = Math.floor((seed / 233280) * (i + 1)); var tmp = s[i]; s[i] = s[j]; s[j] = tmp; }
  return s;
}

// ===== UI HELPERS =====
function showLoader(msg) { var l = document.getElementById('loader'); l.style.display = 'flex'; l.querySelector('p').textContent = msg || 'Loading'; }
function hideLoader() { document.getElementById('loader').style.display = 'none'; }
function showLoader2(msg) { var l = document.getElementById('loader2'); l.style.display = 'flex'; l.querySelector('p').textContent = msg || 'Processing'; }
function hideLoader2() { document.getElementById('loader2').style.display = 'none'; }
function showActionBar(msg) {
  var logo = document.querySelector('#mainNav .logo');
  var nav = document.getElementById('mainNav');
  if (!logo) return;
  if (!logo.getAttribute('data-original')) logo.setAttribute('data-original', logo.innerHTML);
  logo.innerHTML = '<span style="display:inline-flex;align-items:center;gap:8px;padding:6px 16px;border-radius:980px;background:rgba(184,69,106,.15);border:1px solid rgba(184,69,106,.2);animation:actionGlow 1.5s ease-in-out infinite"><i class="fa-solid fa-circle-notch fa-spin" style="font-size:.85rem;color:var(--pink)"></i><span style="font-family:DM Sans,sans-serif;font-size:.85rem;font-weight:600;color:#fff">' + (msg || 'Processing...') + '</span></span>';
  if (nav) { nav.style.boxShadow = '0 0 20px rgba(184,69,106,.25)'; nav.style.borderBottomColor = 'rgba(184,69,106,.3)'; }
}
function hideActionBar() {
  var logo = document.querySelector('#mainNav .logo');
  var nav = document.getElementById('mainNav');
  if (!logo || !logo.getAttribute('data-original')) return;
  logo.innerHTML = logo.getAttribute('data-original');
  logo.removeAttribute('data-original');
  if (nav) { nav.style.boxShadow = ''; nav.style.borderBottomColor = ''; }
}
var _toastTimer = null;
function showAlert(msg) {
  var toast = document.getElementById('toast');
  document.getElementById('toastMessage').textContent = msg;
  toast.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(function() { toast.classList.remove('show'); }, 3000);
}
function closeAlert() { document.getElementById('toast').classList.remove('show'); }
function esc(s) { return s == null ? '' : String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
function getStatusClass(s) { return s ? s.toLowerCase().replace(/\s+/g, '-') : ''; }

// ===== INACTIVE NOTICE =====
function showInactiveNotice() {
  if (localStorage.getItem(LS_PREFIX + 'notice_ack')) return; // Already acknowledged
  document.getElementById('inactiveNotice').classList.add('show');
}
function acknowledgeNotice() {
  document.getElementById('inactiveNotice').classList.remove('show');
  localStorage.setItem(LS_PREFIX + 'notice_ack', '1');
}

// ===== NAVIGATION =====
function showLanding() {
  document.getElementById('landing-section').classList.remove('hidden');
  document.getElementById('app-section').classList.add('hidden');
  ['profile-section','wishlist-section','search-section','registration-section','interest-section','reset-section','editProfileModal'].forEach(function(id) { document.getElementById(id).classList.add('hidden'); });
}
function showLoginForm() {
  // Expand the login card in the hero
  expandLoginCard();
}
function expandLoginCard() {
  var card = document.getElementById('loginCard');
  var cta = document.getElementById('heroCTA');
  if (card.classList.contains('expanded')) return;
  // Collapse CTA buttons
  if (cta) cta.classList.add('collapsed');
  // Expand login card after buttons collapse
  setTimeout(function() {
    card.classList.add('expanded');
    setTimeout(function() { document.getElementById('email').focus(); }, 400);
  }, 200);
}
function showApp() {
  document.getElementById('landing-section').classList.add('hidden');
  document.getElementById('reset-section').classList.add('hidden');
  document.getElementById('registration-section').classList.add('hidden');
  document.getElementById('app-section').classList.remove('hidden');
}
function showView(v) {
  // Hide all sections
  ['profile-section','wishlist-section','search-section','registration-section','interest-section','reset-section'].forEach(function(id) { document.getElementById(id).classList.add('hidden'); });
  document.getElementById('editProfileModal').classList.add('hidden');
  // Hide landing when showing app views
  if (v === 'registration') {
    document.getElementById('landing-section').classList.add('hidden');
  }
  var m = { profile:'profile-section', wishlist:'wishlist-section', search:'search-section', registration:'registration-section', interest:'interest-section' };
  if (m[v]) { document.getElementById(m[v]).classList.remove('hidden'); initObservers(); }
  // Lazy render profile page only when navigated to
  if (v === 'profile') renderUserProfile();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function setActiveTab(el) { document.querySelectorAll('.bottom-nav-item').forEach(function(b) { b.classList.remove('active'); }); el.classList.add('active'); }

// ===== SCROLL REVEAL =====
var observer = new IntersectionObserver(function(entries) { entries.forEach(function(e) { if (e.isIntersecting) e.target.classList.add('visible'); }); }, { threshold: 0.15 });
function initObservers() { document.querySelectorAll('.reveal,.card').forEach(function(el) { observer.observe(el); }); }
window.addEventListener('scroll', function() { var n = document.getElementById('mainNav'); if (n) n.classList.toggle('scrolled', window.scrollY > 10); });

// ===== SESSION =====
function djb2(s) { var h = 0; for (var i = 0; i < s.length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h = h & h; } return h; }
function setSession(pw) { sessionStorage.setItem('sessionToken', djb2(pw)); }
function setSessionRid(e) { sessionStorage.setItem('sessionRid', djb2(e)); }
function setSessionEmail(e) { sessionStorage.setItem('sessionEmail', e); }
function getSession() { return sessionStorage.getItem('sessionToken'); }
function getSessionRid() { return sessionStorage.getItem('sessionRid'); }
function getSessionEmail() { return sessionStorage.getItem('sessionEmail'); }
function getSessionG() { return sessionStorage.getItem('sessionG'); }
function clearSession() {
  ['sessionToken','sessionEmail','sessionRid','sessionG'].forEach(function(k) { sessionStorage.removeItem(k); });
  try { var keys = []; for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k && k.indexOf(LS_PREFIX) === 0) keys.push(k); } keys.forEach(function(k) { localStorage.removeItem(k); }); } catch(e) {}
  _allProfiles = null; _userProfile = null;
}

// ===== SMART LOAD (stale-while-revalidate) =====
var _serverTimestamps = null;
function smartLoad(dataKey, fetchFn, renderFn) {
  var cached = lsGet(dataKey), hadCached = !!cached;
  if (cached) renderFn(cached);
  function check() {
    if (!_serverTimestamps) { api.getTimestamps().then(function(ts) { _serverTimestamps = ts; compare(ts); }); }
    else { compare(_serverTimestamps); }
  }
  function compare(ts) {
    var sTs = ts[dataKey] || 0, lTs = lsGetTs(dataKey);
    if (sTs > lTs || !hadCached) {
      fetchFn().then(function(fresh) {
        var fStr = JSON.stringify(fresh), cStr = cached ? JSON.stringify(cached) : '';
        lsSet(dataKey, fresh); lsSetTs(dataKey, sTs || Date.now());
        if (fStr !== cStr) renderFn(fresh);
      });
    }
  }
  check();
}

// ===== PROFILE DATA MANAGER =====
function fetchAllProfilesFromServer(email, gender, onDone) {
  var all = [], uProf = null;
  function fetchPage(pg) {
    api.getProfiles(email, gender, pg).then(function(result) {
      all = all.concat(result.profiles);
      if (result.userProfile) uProf = result.userProfile;
      if (result.hasMore) fetchPage(pg + 1);
      else { lsSet('allProfiles', all); if (uProf) lsSet('userProfile', uProf); lsSetTs('allProfiles', Date.now()); onDone(all, uProf); }
    });
  }
  fetchPage(0);
}

function initProfiles(email, gender) {
  currentEmail = email; currentGender = gender;
  if (isCachedToday('allProfiles')) {
    var cached = lsGet('allProfiles'), uCached = lsGet('userProfile');
    if (cached) { _allProfiles = dailyShuffle(cached); _userProfile = uCached; _displayPage = 0; _renderedCount = 0; renderProfilePage(); populateFilters(); hideLoader(); return; }
  }
  showLoader('Discovering profiles...');
  fetchAllProfilesFromServer(email, gender, function(all, uProf) {
    _allProfiles = dailyShuffle(all); _userProfile = uProf; _displayPage = 0; _renderedCount = 0;
    renderProfilePage(); populateFilters(); hideLoader();
  });
}

// ===== CARD HTML =====
function cardHTML(p, btns, statusHTML) {
  var photos = String(p.photos || '').split(',').filter(function(u) { return u.trim(); });
  var gallery = photos.map(function(u, idx) { return '<img src="' + esc(u.trim()) + '" loading="lazy" onclick="event.stopPropagation();openPhotoViewer(\'' + esc(p.photos) + '\',' + idx + ')" onerror="handleImgError(this)">'; }).join('');
  var dots = photos.length > 1 ? '<div class="card-dots">' + photos.map(function(_, i) { return '<span' + (i === 0 ? ' class="active"' : '') + '></span>'; }).join('') + '</div>' : '';
  return '<div class="card reveal" onclick="toggleCardDetails(this)">' + (statusHTML || '') +
    '<div class="card-img-wrap"><div class="card-gallery" onscroll="updateDots(this)">' + gallery + '</div>' + dots +
    '<div class="card-overlay"><h2>' + esc(p.name) + ', ' + esc(p.age) + '</h2><div class="loc"><i class="fas fa-map-marker-alt"></i> ' + esc(p.location) + '</div></div></div>' +
    '<p class="card-more"><i class="fa-solid fa-chevron-down" style="font-size:.6rem"></i> More details</p>' +
    '<div class="card-details">' +
      (p.about ? '<div class="detail-row"><div class="detail-icon gold"><i class="fa-solid fa-quote-left"></i></div><div class="detail-text"><span class="detail-label">About</span><span class="detail-value">' + esc(p.about) + '</span></div></div>' : '') +
      (p.height ? '<div class="detail-row"><div class="detail-icon pink"><i class="fa-solid fa-ruler-vertical"></i></div><div class="detail-text"><span class="detail-label">Height</span><span class="detail-value">' + esc(p.height) + '</span></div></div>' : '') +
      (p.maritalStatus ? '<div class="detail-row"><div class="detail-icon gold"><i class="fa-solid fa-ring"></i></div><div class="detail-text"><span class="detail-label">Marital Status</span><span class="detail-value">' + esc(p.maritalStatus) + '</span></div></div>' : '') +
      (p.education ? '<div class="detail-row"><div class="detail-icon purple"><i class="fa-solid fa-graduation-cap"></i></div><div class="detail-text"><span class="detail-label">Education</span><span class="detail-value">' + esc(p.education) + '</span></div></div>' : '') +
      (p.occupation ? '<div class="detail-row"><div class="detail-icon purple"><i class="fa-solid fa-briefcase"></i></div><div class="detail-text"><span class="detail-label">Occupation</span><span class="detail-value">' + esc(p.occupation) + '</span></div></div>' : '') +
      (p.income ? '<div class="detail-row"><div class="detail-icon gold"><i class="fa-solid fa-indian-rupee-sign"></i></div><div class="detail-text"><span class="detail-label">Income</span><span class="detail-value">' + esc(p.income) + '</span></div></div>' : '') +
      (p.motherTongue ? '<div class="detail-row"><div class="detail-icon pink"><i class="fa-solid fa-language"></i></div><div class="detail-text"><span class="detail-label">Mother Tongue</span><span class="detail-value">' + esc(p.motherTongue) + '</span></div></div>' : '') +
      ((p.smoking && p.smoking !== 'No') || (p.drinking && p.drinking !== 'No') ? '<div class="detail-row"><div class="detail-icon purple"><i class="fa-solid fa-smoking-ban"></i></div><div class="detail-text"><span class="detail-label">Smoking / Drinking</span><span class="detail-value">' + esc(p.smoking || 'No') + ' / ' + esc(p.drinking || 'No') + '</span></div></div>' : '') +
      '<div class="detail-row"><div class="detail-icon pink"><i class="fa-solid fa-heart"></i></div><div class="detail-text"><span class="detail-label">Interests</span><span class="detail-value">' + esc(p.interests) + '</span></div></div>' +
      '<div class="detail-row"><div class="detail-icon gold"><i class="fa-solid fa-hands-praying"></i></div><div class="detail-text"><span class="detail-label">Religion</span><span class="detail-value">' + esc(p.religion) + '</span></div></div>' +
      '<div class="detail-row"><div class="detail-icon purple"><i class="fa-solid fa-users"></i></div><div class="detail-text"><span class="detail-label">Caste</span><span class="detail-value">' + esc(p.caste) + '</span></div></div>' +
      (p.subcaste ? '<div class="detail-row"><div class="detail-icon purple"><i class="fa-solid fa-user-group"></i></div><div class="detail-text"><span class="detail-label">Sub-caste</span><span class="detail-value">' + esc(p.subcaste) + '</span></div></div>' : '') +
    '</div><div class="card-actions">' + btns + '<button style="flex:0;min-width:36px;background:none;border:none;color:rgba(255,255,255,.3);font-size:.85rem;cursor:pointer;padding:8px" onclick="event.stopPropagation();showCardMenu(\'' + esc(p.rid) + '\',\'' + esc(p.name) + '\')"><i class="fa-solid fa-ellipsis-vertical"></i></button></div></div>';
}
function toggleCardDetails(el) { var d = el.querySelector('.card-details'), m = el.querySelector('.card-more'); if (!d) return; var open = d.classList.toggle('open'); if (m) m.innerHTML = open ? '<i class="fa-solid fa-chevron-up" style="font-size:.6rem"></i> Less' : '<i class="fa-solid fa-chevron-down" style="font-size:.6rem"></i> More details'; }
function updateDots(g) { var w = g.closest('.card-img-wrap'); if (!w) return; var dots = w.querySelectorAll('.card-dots span'); if (!dots.length) return; var idx = Math.round(g.scrollLeft / g.offsetWidth); dots.forEach(function(d, i) { d.classList.toggle('active', i === idx); }); }
function updateProfileDots(g) { var w = g.closest('.profile-hero'); if (!w) return; var dots = w.querySelectorAll('.profile-dots span'); if (!dots.length) return; var idx = Math.round(g.scrollLeft / g.offsetWidth); dots.forEach(function(d, i) { d.classList.toggle('active', i === idx); }); }

// ===== VIRTUAL SCROLL RENDER =====
var _scrollObserver = null;
var _renderedCount = 0; // Track how many cards are already in DOM
function renderProfilePage() {
  var c = document.getElementById("container");
  var end = (_displayPage + 1) * DISPLAY_PAGE_SIZE;
  var allVisible = (_allProfiles || []).slice(0, end);
  // Filter out blocked users
  var blocked = getBlockedUsers();
  allVisible = allVisible.filter(function(p) { return blocked.indexOf(p.rid) === -1; });
  var hasMore = end < (_allProfiles || []).length;
  var total = (_allProfiles || []).length;

  // Only render NEW cards (append, don't replace)
  if (_renderedCount === 0) {
    c.innerHTML = ''; // First render: clear
  } else {
    // Remove old sentinel/load-more
    var oldSentinel = document.getElementById('scrollSentinel');
    if (oldSentinel) oldSentinel.remove();
    var oldEnd = c.querySelector('.all-shown-msg');
    if (oldEnd) oldEnd.remove();
  }

  var newCards = allVisible.slice(_renderedCount);
  var html = newCards.map(function(p) {
    return cardHTML(p,
      '<button class="act-primary" onclick="event.stopPropagation();addToWishlist(\'' + esc(p.name) + '\',\'' + esc(p.rid) + '\')"><i class="fa-regular fa-star"></i> Shortlist</button>' +
      '<button class="act-primary" onclick="event.stopPropagation();sendInterest(\'' + esc(p.rid) + '\')"><i class="fa-regular fa-paper-plane"></i> Send Interest</button>');
  }).join('');
  c.insertAdjacentHTML('beforeend', html);
  _renderedCount = allVisible.length;

  if (_scrollObserver) { _scrollObserver.disconnect(); _scrollObserver = null; }
  if (hasMore) {
    c.insertAdjacentHTML('beforeend', '<div id="scrollSentinel" class="load-more-wrap" style="grid-column:1/-1;text-align:center;padding:24px 0"><button class="load-more-btn" onclick="loadMoreProfiles()">Show more <i class="fa-solid fa-chevron-down"></i></button><p style="font-size:.72rem;color:rgba(255,255,255,.25);margin-top:8px">' + Math.min(end, total) + ' of ' + total + '</p></div>');
    var sentinel = document.getElementById('scrollSentinel');
    if (sentinel) { _scrollObserver = new IntersectionObserver(function(e) { if (e[0].isIntersecting) loadMoreProfiles(); }, { rootMargin: '200px' }); _scrollObserver.observe(sentinel); }
  } else if (total > 0) { c.insertAdjacentHTML('beforeend', '<p class="all-shown-msg" style="grid-column:1/-1;text-align:center;padding:20px 0;font-size:.75rem;color:rgba(255,255,255,.2)">All ' + total + ' profiles shown</p>'); }
  initObservers();
}
function loadMoreProfiles() { if (_scrollObserver) { _scrollObserver.disconnect(); _scrollObserver = null; } _displayPage++; renderProfilePage(); }

var _profileRenderedFor = null; // Track which user profile is already rendered
function renderUserProfile() {
  var pi = document.getElementById('profile-container'); if (!_userProfile) return;
  // Skip re-render if already rendered for same data
  var sig = _userProfile.name + _userProfile.photos + _userProfile.phone + _userProfile.about;
  if (_profileRenderedFor === sig && pi.innerHTML) return;
  _profileRenderedFor = sig;
  var u = _userProfile;
  var uPhotos = String(u.photos || '').split(',').filter(function(x) { return x.trim(); });
  var uGallery = uPhotos.map(function(x, idx) { return '<img src="' + esc(x.trim()) + '" loading="lazy" onclick="openPhotoViewer(\'' + esc(u.photos) + '\',' + idx + ')" onerror="handleImgError(this)" style="cursor:pointer">'; }).join('');
  var uDots = uPhotos.length > 1 ? '<div class="profile-dots">' + uPhotos.map(function(_, i) { return '<span' + (i === 0 ? ' class="active"' : '') + '></span>'; }).join('') + '</div>' : '';
  pi.innerHTML = '<div class="profile-hero"><div class="profile-gallery" onscroll="updateProfileDots(this)">' + uGallery + '</div>' + uDots + '</div>' +
    '<div class="profile-header">' +
      '<h2 class="profile-name">' + esc(u.name) + ', ' + esc(u.age) + '</h2>' +
      '<p class="profile-location"><i class="fas fa-map-marker-alt"></i> ' + esc(u.location) + '</p>' +
      (function() { var pct = getProfileCompleteness(u); return pct < 100 ? '<div style="margin:12px auto;max-width:280px"><div style="display:flex;justify-content:space-between;font-size:.75rem;color:rgba(255,255,255,.6);margin-bottom:4px"><span>Profile completeness</span><span>' + pct + '%</span></div><div style="height:4px;background:rgba(255,255,255,.08);border-radius:4px;overflow:hidden"><div style="height:100%;width:' + pct + '%;background:linear-gradient(90deg,var(--pink-deep),var(--gold));border-radius:4px;transition:width .5s"></div></div></div>' : ''; })() +
      '<div class="profile-actions">' +
        '<button class="profile-edit-btn" onclick="loadUserProfileForEdit()"><i class="fa-solid fa-pen-to-square"></i> Edit Profile</button>' +
        '<button class="profile-logout-btn" onclick="confirmDeleteAccount()"><i class="fa-solid fa-trash"></i> Delete Account</button>' +
      '</div>' +
    '</div>' +
    '<div class="profile-details">' +
      (u.about ? '<div class="detail-row"><div class="detail-icon gold"><i class="fa-solid fa-quote-left"></i></div><div class="detail-text"><span class="detail-label">About</span><span class="detail-value">' + esc(u.about) + '</span></div></div>' : '') +
      (u.height ? '<div class="detail-row"><div class="detail-icon pink"><i class="fa-solid fa-ruler-vertical"></i></div><div class="detail-text"><span class="detail-label">Height</span><span class="detail-value">' + esc(u.height) + '</span></div></div>' : '') +
      (u.maritalStatus ? '<div class="detail-row"><div class="detail-icon gold"><i class="fa-solid fa-ring"></i></div><div class="detail-text"><span class="detail-label">Marital Status</span><span class="detail-value">' + esc(u.maritalStatus) + '</span></div></div>' : '') +
      (u.education ? '<div class="detail-row"><div class="detail-icon purple"><i class="fa-solid fa-graduation-cap"></i></div><div class="detail-text"><span class="detail-label">Education</span><span class="detail-value">' + esc(u.education) + '</span></div></div>' : '') +
      (u.occupation ? '<div class="detail-row"><div class="detail-icon purple"><i class="fa-solid fa-briefcase"></i></div><div class="detail-text"><span class="detail-label">Occupation</span><span class="detail-value">' + esc(u.occupation) + '</span></div></div>' : '') +
      (u.income ? '<div class="detail-row"><div class="detail-icon gold"><i class="fa-solid fa-indian-rupee-sign"></i></div><div class="detail-text"><span class="detail-label">Income</span><span class="detail-value">' + esc(u.income) + '</span></div></div>' : '') +
      (u.motherTongue ? '<div class="detail-row"><div class="detail-icon pink"><i class="fa-solid fa-language"></i></div><div class="detail-text"><span class="detail-label">Mother Tongue</span><span class="detail-value">' + esc(u.motherTongue) + '</span></div></div>' : '') +
      ((u.smoking && u.smoking !== 'No') || (u.drinking && u.drinking !== 'No') ? '<div class="detail-row"><div class="detail-icon purple"><i class="fa-solid fa-smoking-ban"></i></div><div class="detail-text"><span class="detail-label">Smoking / Drinking</span><span class="detail-value">' + esc(u.smoking || 'No') + ' / ' + esc(u.drinking || 'No') + '</span></div></div>' : '') +
      '<div class="detail-row"><div class="detail-icon pink"><i class="fa-solid fa-heart"></i></div><div class="detail-text"><span class="detail-label">Interests</span><span class="detail-value">' + esc(u.interests) + '</span></div></div>' +
      '<div class="detail-row"><div class="detail-icon gold"><i class="fa-solid fa-hands-praying"></i></div><div class="detail-text"><span class="detail-label">Religion</span><span class="detail-value">' + esc(u.religion) + '</span></div></div>' +
      '<div class="detail-row"><div class="detail-icon purple"><i class="fa-solid fa-users"></i></div><div class="detail-text"><span class="detail-label">Caste</span><span class="detail-value">' + esc(u.caste) + '</span></div></div>' +
      (u.subcaste ? '<div class="detail-row"><div class="detail-icon purple"><i class="fa-solid fa-user-group"></i></div><div class="detail-text"><span class="detail-label">Sub-caste</span><span class="detail-value">' + esc(u.subcaste) + '</span></div></div>' : '') +
      (u.rashi ? '<div class="detail-row"><div class="detail-icon gold"><i class="fa-solid fa-star"></i></div><div class="detail-text"><span class="detail-label">Rashi / Nakshatra</span><span class="detail-value">' + esc(u.rashi) + (u.nakshatra ? ' / ' + esc(u.nakshatra) : '') + '</span></div></div>' : '') +
      (u.timeOfBirth ? '<div class="detail-row"><div class="detail-icon pink"><i class="fa-solid fa-clock"></i></div><div class="detail-text"><span class="detail-label">Birth Time / Place</span><span class="detail-value">' + esc(u.timeOfBirth) + (u.placeOfBirth ? ', ' + esc(u.placeOfBirth) : '') + '</span></div></div>' : '') +
      (u.preferences ? '<div class="detail-row"><div class="detail-icon gold"><i class="fa-solid fa-clipboard-list"></i></div><div class="detail-text"><span class="detail-label">Partner Preferences</span><span class="detail-value">' + esc(u.preferences) + '</span></div></div>' : '') +
      (u.linkedin || u.instagram ? '<div class="detail-row"><div class="detail-icon purple"><i class="fa-solid fa-link"></i></div><div class="detail-text"><span class="detail-label">Social</span><span class="detail-value">' + (u.linkedin ? '<a href="' + esc(u.linkedin) + '" target="_blank" style="color:var(--pink);text-decoration:none">LinkedIn</a> ' : '') + (u.instagram ? '<a href="https://instagram.com/' + esc(u.instagram.replace('@','')) + '" target="_blank" style="color:var(--pink);text-decoration:none">Instagram</a>' : '') + '</span></div></div>' : '') +
      '<div class="detail-row"><div class="detail-icon pink"><i class="fa-solid fa-phone"></i></div><div class="detail-text"><span class="detail-label">Phone</span><span class="detail-value">' + esc(u.phone) + '</span></div></div>' +
    '</div>' +
    '<div style="text-align:center;margin-top:24px">' +
      '<button onclick="showSupportPopup()" style="padding:10px 24px;border:1px solid rgba(255,255,255,.1);border-radius:980px;background:transparent;color:rgba(255,255,255,.6);font-size:.82rem;font-weight:600;cursor:pointer;transition:all .2s"><i class="fa-solid fa-headset"></i> Need Help? Contact Support</button>' +
    '</div>' +
    '<div style="text-align:center;margin-top:16px;padding:20px;background:rgba(196,162,101,.06);border:1px solid rgba(196,162,101,.1);border-radius:16px">' +
      '<p style="font-size:.85rem;color:rgba(255,255,255,.6);margin-bottom:10px"><i class="fa-solid fa-heart" style="color:var(--pink)"></i> Enjoying rishtas.in? Help us keep it free.</p>' +
      '<button onclick="showDonatePopup()" style="padding:10px 28px;border:none;border-radius:980px;background:linear-gradient(135deg,var(--gold),var(--pink-deep));color:#fff;font-size:.82rem;font-weight:700;cursor:pointer;transition:all .3s"><i class="fa-regular fa-handshake"></i> Support Us</button>' +
    '</div>';
  document.getElementById("editName").value = u.name; document.getElementById("editAge").value = u.age;
  var r = document.querySelector('input[name="editGender"][value="' + u.gender + '"]'); if (r) r.checked = true;
  document.getElementById("editHeight").value = u.height || '';
  document.getElementById("editEducation").value = u.education || '';
  document.getElementById("editOccupation").value = u.occupation || '';
  document.getElementById("editIncome").value = u.income || '';
  document.getElementById("editMaritalStatus").value = u.maritalStatus || 'Never Married';
  document.getElementById("editAbout").value = u.about || '';
  document.getElementById("editMotherTongue").value = u.motherTongue || '';
  document.getElementById("editSmoking").value = u.smoking || 'No';
  document.getElementById("editDrinking").value = u.drinking || 'No';
  document.getElementById("editTimeOfBirth").value = u.timeOfBirth || '';
  document.getElementById("editPlaceOfBirth").value = u.placeOfBirth || '';
  document.getElementById("editRashi").value = u.rashi || '';
  document.getElementById("editNakshatra").value = u.nakshatra || '';
  document.getElementById("editPreferences").value = u.preferences || '';
  document.getElementById("editLinkedin").value = u.linkedin || '';
  document.getElementById("editInstagram").value = u.instagram || '';
  document.getElementById("editLocation").value = u.location; document.getElementById("editInterests").value = u.interests;
  document.getElementById("editCaste").value = u.caste; document.getElementById("editPhone").value = u.phone;
  document.getElementById("editEmail").value = u.email; document.getElementById("editPhotos").src = uPhotos[0] || '';
  document.getElementById("editReligion").value = u.religion; document.getElementById("editSubcaste").value = u.subcaste;
  document.getElementById("editPassword").value = u.password;
}

// ===== ACTION CAPTCHA (every 2 interest/shortlist actions) =====
var _actionCount = 0;
var _pendingAction = null;
var _funnyLines = [
  "Making sure robots aren't swiping right on humans!",
  "Even Cupid needs to verify sometimes!",
  "Just checking you're not an AI looking for love!",
  "Robots deserve love too, but not here!",
  "Quick check: are you human or a very romantic bot?",
  "Love is real, and so should you be!",
  "Sorry! Just making sure hearts, not circuits, are matching!"
];

function checkActionCaptcha(actionFn) {
  _actionCount++;
  if (_actionCount > 2 && _actionCount % 3 === 0) {
    // Show captcha challenge
    _pendingAction = actionFn;
    var line = _funnyLines[Math.floor(Math.random() * _funnyLines.length)];
    document.getElementById('captchaFunnyLine').textContent = line;
    document.getElementById('actionCaptchaModal').classList.add('active');
    // Re-render the recaptcha widget if needed
    if (typeof grecaptcha !== 'undefined') {
      try { grecaptcha.render('actionRecaptcha', { sitekey: '6LfbrHcqAAAAAGxxav5NeMjsN563xcrez3YUqXdX', callback: onActionCaptchaSuccess }); } catch(e) { /* already rendered */ resetCaptcha('loginCaptcha'); }
    }
  } else {
    actionFn();
  }
}

function onActionCaptchaSuccess() {
  document.getElementById('actionCaptchaModal').classList.remove('active');
  if (_pendingAction) { _pendingAction(); _pendingAction = null; }
}

// ===== DELETE ACCOUNT =====
function confirmDeleteAccount() {
  if (confirm('Are you sure you want to delete your account? This cannot be undone. All your data, photos, interests, and shortlists will be permanently removed.')) {
    showLoader('Deleting account...');
    api.deleteAccount().then(function() {
      hideLoader();
      sessionStorage.clear();
      try { var keys = []; for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k && k.indexOf(LS_PREFIX) === 0) keys.push(k); } keys.forEach(function(k) { localStorage.removeItem(k); }); } catch(e) {}
      _allProfiles = null; _userProfile = null;
      showAlert('Account deleted successfully.');
      showLanding();
    }).catch(function(err) { hideLoader(); showAlert('Failed to delete account: ' + err.message); });
  }
}

// ===== WISHLIST (with optimistic update) =====
function loadWishlist() { if (wishlistload) { showActionBar('Loading shortlists...'); smartLoad('wishlist', function() { return api.getUserWishlist(getSessionRid()); }, displayProfiles); wishlistload = false; } showView('wishlist'); }
function displayProfiles(profiles) {
  var c = document.getElementById("wishlist-container");
  c.innerHTML = !profiles.length ? '<div class="empty-state"><i class="fa-regular fa-star"></i><p>No profiles shortlisted yet.</p></div>' : profiles.map(function(p) { return cardHTML(p, '<button class="act-primary" onclick="event.stopPropagation();sendInterest(\'' + esc(p.rid) + '\')"><i class="fa-regular fa-paper-plane"></i> Send Interest</button><button class="act-danger" onclick="event.stopPropagation();removeFromWishlist(\'' + esc(p.name) + '\',\'' + esc(p.rid) + '\')"><i class="fa-solid fa-xmark"></i> Remove</button>'); }).join('');
  hideLoader(); hideActionBar(); initObservers();
}
function addToWishlist(n, rid) {
  if (isRateLimited('addToWishlist', 2000)) return;
  checkActionCaptcha(function() {
    var cached = lsGet('wishlist') || [];
    var profile = (_allProfiles || []).find(function(p) { return p.rid === rid; });
    if (profile && !cached.find(function(c) { return c.rid === rid; })) { cached.push(profile); lsSet('wishlist', cached); }
    showActionBar('Adding to shortlist...');
    api.addToWishlist(rid, getSessionRid()).then(function() { hideActionBar(); showAlert(n + ' added to Shortlists'); });
    wishlistload = true; lsSetTs('wishlist', 0);
  });
}
function removeFromWishlist(n, rid) {
  // Optimistic: remove from local cache immediately
  var cached = lsGet('wishlist') || [];
  cached = cached.filter(function(c) { return c.rid !== rid; });
  lsSet('wishlist', cached); displayProfiles(cached);
  showActionBar('Removing...');
  api.removeFromWishlist(rid, getSessionRid()).then(function() { hideActionBar(); showAlert(n + ' removed.'); });
  wishlistload = true; lsSetTs('wishlist', 0);
}

// ===== INTERESTS =====
function loadInterest() { if (interestlistload) { showActionBar('Loading interests...'); smartLoad('interests', function() { return api.getUserInterests(getSessionRid()); }, displayInterests); interestlistload = false; } showView('interest'); document.getElementById('statusFilter').value = 'all'; filterByStatus(); }
function displayInterests(profiles) {
  var c = document.getElementById("interest-container");
  if (!profiles.length) { c.innerHTML = '<div class="empty-state"><i class="fa-regular fa-envelope"></i><p>No interests yet.</p></div>'; }
  else { c.innerHTML = profiles.map(function(p) { var sc = getStatusClass(p.status), sh = '<div class="status-badge ' + sc + '">' + esc(p.status) + '</div>', b = ''; if (p.status === 'Received') b = '<button class="act-success" onclick="event.stopPropagation();acceptInterest(\'' + esc(p.rid) + '\')"><i class="fa-solid fa-check"></i> Accept</button><button class="act-danger" onclick="event.stopPropagation();cancelInterest(\'' + esc(p.rid) + '\')"><i class="fa-solid fa-xmark"></i> Decline</button>'; else if (p.status === 'Accepted') b = '<button onclick="event.stopPropagation()"><i class="fas fa-phone"></i> ' + esc(p.phone) + '</button><button class="act-danger" onclick="event.stopPropagation();cancelInterest(\'' + esc(p.rid) + '\')"><i class="fa-solid fa-xmark"></i> Decline</button>'; else if (p.status === 'Declined') b = '<button class="act-success" onclick="event.stopPropagation();acceptInterest(\'' + esc(p.rid) + '\')"><i class="fa-solid fa-check"></i> Accept</button>'; else b = '<button class="act-danger" onclick="event.stopPropagation();deleteInterest(\'' + esc(p.rid) + '\')"><i class="fa-solid fa-trash"></i> Delete</button>'; return cardHTML(p, b, sh); }).join(''); }
  hideLoader(); hideActionBar(); initObservers(); updateBadges();
}
function sendInterest(rid) {
  if (isRateLimited('sendInterest', 3000)) return;
  if (hasAlreadySentInterest(rid)) { showAlert('You have already sent interest to this person.'); return; }
  checkActionCaptcha(function() {
    showActionBar('Sending interest...');
    apiWithRetry(function() { return api.sendInterest(rid, getSessionRid()); }).then(function() { hideActionBar(); showAlert('Interest sent!'); }).catch(function() { hideActionBar(); showAlert('Failed to send interest. Please try again.'); });
    interestlistload = true; lsSetTs('interests', 0);
  });
}
function acceptInterest(rid) {
  checkActionCaptcha(function() {
    showActionBar('Accepting...'); interestlistload = true; lsSetTs('interests', 0);
    api.acceptInterest(rid, getSessionRid()).then(function() { hideActionBar(); showAlert('Interest accepted!'); loadInterest(); });
  });
}
function deleteInterest(rid) { showActionBar('Deleting...'); interestlistload = true; lsSetTs('interests', 0); api.deleteInterest(rid, getSessionRid()).then(function() { hideActionBar(); showAlert('Interest deleted.'); loadInterest(); }); }
function cancelInterest(rid) { showActionBar('Declining...'); interestlistload = true; lsSetTs('interests', 0); api.cancelInterest(rid, getSessionRid()).then(function() { hideActionBar(); showAlert('Interest declined.'); loadInterest(); }); }

// ===== SEARCH / FILTER =====
function filterCards(iid, cid) { var q = document.getElementById(iid).value.toUpperCase(); Array.from(document.getElementById(cid).getElementsByClassName('card')).forEach(function(c) { c.style.display = c.textContent.toUpperCase().includes(q) ? '' : 'none'; }); }
function filterByStatus() { var s = document.getElementById('statusFilter').value; Array.from(document.getElementById('interest-container').getElementsByClassName('card')).forEach(function(c) { var b = c.querySelector('.status-badge'); if (!b) return; c.style.display = (s === 'all' || b.textContent.trim().toLowerCase() === s.toLowerCase()) ? '' : 'none'; }); }

// Populate filter dropdowns from cached profiles
function populateFilters() {
  if (!_allProfiles || !_allProfiles.length) return;
  var religions = {}, locations = {};
  _allProfiles.forEach(function(p) {
    if (p.religion) religions[p.religion] = true;
    if (p.location) locations[p.location] = true;
  });
  var relSel = document.getElementById('filterReligion');
  var locSel = document.getElementById('filterLocation');
  if (relSel) { relSel.innerHTML = '<option value="">All Religions</option>'; Object.keys(religions).sort().forEach(function(r) { relSel.innerHTML += '<option value="' + esc(r) + '">' + esc(r) + '</option>'; }); }
  if (locSel) { locSel.innerHTML = '<option value="">All Locations</option>'; Object.keys(locations).sort().forEach(function(l) { locSel.innerHTML += '<option value="' + esc(l) + '">' + esc(l) + '</option>'; }); }
}

function applyFilters() {
  if (!_allProfiles) return;
  var religion = document.getElementById('filterReligion').value;
  var location = document.getElementById('filterLocation').value;
  var marital = document.getElementById('filterMarital').value;
  var ageRange = document.getElementById('filterAge').value;
  var searchQ = document.getElementById('searchInput').value.toUpperCase();

  var filtered = _allProfiles.filter(function(p) {
    if (religion && p.religion !== religion) return false;
    if (location && p.location !== location) return false;
    if (marital && p.maritalStatus !== marital) return false;
    if (ageRange) {
      var age = Number(p.age);
      if (ageRange === '18-25' && (age < 18 || age > 25)) return false;
      if (ageRange === '26-30' && (age < 26 || age > 30)) return false;
      if (ageRange === '31-35' && (age < 31 || age > 35)) return false;
      if (ageRange === '36-40' && (age < 36 || age > 40)) return false;
      if (ageRange === '40+' && age < 40) return false;
    }
    if (searchQ) {
      var text = [p.name, p.age, p.location, p.religion, p.caste, p.interests, p.education, p.occupation].join(' ').toUpperCase();
      if (!text.includes(searchQ)) return false;
    }
    return true;
  });

  // Render filtered results
  var c = document.getElementById("container");
  _renderedCount = 0;
  c.innerHTML = '';
  var end = Math.min(filtered.length, DISPLAY_PAGE_SIZE);
  c.innerHTML = filtered.slice(0, end).map(function(p) {
    return cardHTML(p,
      '<button class="act-primary" onclick="event.stopPropagation();addToWishlist(\'' + esc(p.name) + '\',\'' + esc(p.rid) + '\')"><i class="fa-regular fa-star"></i> Shortlist</button>' +
      '<button class="act-primary" onclick="event.stopPropagation();sendInterest(\'' + esc(p.rid) + '\')"><i class="fa-regular fa-paper-plane"></i> Send Interest</button>');
  }).join('');
  if (filtered.length > end) {
    c.insertAdjacentHTML('beforeend', '<p style="grid-column:1/-1;text-align:center;padding:20px 0;font-size:.75rem;color:rgba(255,255,255,.3)">' + end + ' of ' + filtered.length + ' matches shown</p>');
  } else if (filtered.length === 0) {
    c.innerHTML = '<div class="empty-state"><i class="fa-solid fa-filter"></i><p>No profiles match your filters.</p></div>';
  } else {
    c.insertAdjacentHTML('beforeend', '<p style="grid-column:1/-1;text-align:center;padding:20px 0;font-size:.75rem;color:rgba(255,255,255,.2)">' + filtered.length + ' profiles found</p>');
  }
  initObservers();
}

// ===== PASSWORD RESET =====
function showForgotPassword() {
  document.getElementById('landing-section').classList.add('hidden');
  document.getElementById('reset-section').classList.remove('hidden');
  document.getElementById('reset-step1').classList.remove('hidden');
  document.getElementById('reset-step2').classList.add('hidden');
}
function requestOTP() {
  var email = document.getElementById('resetEmail').value.trim();
  if (!email) { showAlert('Please enter your email.'); return; }
  var cap = getCaptchaResponse('regCaptcha');
  if (!cap) { showAlert('Please complete the CAPTCHA.'); return; }
  showActionBar('Sending OTP...');
  api.requestPasswordReset(email, cap).then(function(r) {
    hideActionBar();
    if (r.success) {
      showAlert(r.message);
      document.getElementById('reset-step1').classList.add('hidden');
      document.getElementById('reset-step2').classList.remove('hidden');
    } else { showAlert(r.message); }
  }).catch(function(err) { hideActionBar(); showAlert(err.message); });
}
function resetPassword() {
  var email = document.getElementById('resetEmail').value.trim();
  var otp = document.getElementById('resetOTP').value.trim();
  var pw = document.getElementById('resetNewPassword').value;
  var pw2 = document.getElementById('resetConfirmPassword').value;
  if (!otp) { showAlert('Please enter the OTP.'); return; }
  if (!pw) { showAlert('Please enter a new password.'); return; }
  if (pw !== pw2) { showAlert('Passwords do not match.'); return; }
  var cap = getCaptchaResponse('regCaptcha');
  if (!cap) { showAlert('Please complete the CAPTCHA.'); return; }
  showActionBar('Resetting password...');
  api.verifyOTPAndReset(email, otp, pw, cap).then(function(r) {
    hideActionBar();
    showAlert(r.message);
    if (r.success) {
      document.getElementById('reset-section').classList.add('hidden');
      showLoginForm();
    }
  }).catch(function(err) { hideActionBar(); showAlert(err.message); });
}
function backToLogin() {
  document.getElementById('reset-section').classList.add('hidden');
  showLanding();
}

// ===== LOGIN / LOGOUT =====
function login() {
  var e = document.getElementById('email').value.trim(), p = document.getElementById('password').value;
  if (!e) { showAlert('Please enter your email.'); return; }
  if (!p) { showAlert('Please enter your password.'); return; }
  var cap = getCaptchaResponse('loginCaptcha') || '';
  if (!cap) { showAlert('Please complete the CAPTCHA.'); return; }
  showLoader('Signing in...');
  api.checkLogin(e, p, cap).then(function(r) {
    if (r.success) {
      sessionStorage.setItem('authToken', r.token);
      sessionStorage.setItem('sessionEmail', e);
      sessionStorage.setItem('sessionRid', r.rid);
      sessionStorage.setItem('sessionG', r.gen === "Male" ? "63889cfb" : "b719ce18");
      currentEmail = e; currentGender = sessionStorage.getItem('sessionG');
      showApp(); showView('search');
      showLoader('Discovering profiles...');
      showInactiveNotice();
      initProfiles(e, currentGender);
    } else { hideLoader(); showAlert(r.message); resetCaptcha('loginCaptcha'); }
  }).catch(function(err) { hideLoader(); if (err.message !== 'AUTH_REQUIRED') showAlert('Login failed: ' + err.message); resetCaptcha('loginCaptcha'); });
}

function logout() {
  showLoader('Signing out...');
  api.logout().then(function() {
    sessionStorage.clear();
    try { var keys = []; for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k && k.indexOf(LS_PREFIX) === 0) keys.push(k); } keys.forEach(function(k) { localStorage.removeItem(k); }); } catch(e) {}
    _allProfiles = null; _userProfile = null;
    showLanding(); hideLoader();
    wishlistload = true; interestlistload = true;
  }).catch(function() { hideLoader(); });
}

// ===== REGISTRATION =====
function registerUser() {
  showLoader2('Creating your profile...');
  var f = { name:document.getElementById("fname").value, age:document.getElementById("age").value, gender:(document.querySelector('input[name="gender"]:checked')||{}).value, height:document.getElementById("height").value, education:document.getElementById("education").value, occupation:document.getElementById("occupation").value, income:document.getElementById("income").value, maritalStatus:document.getElementById("maritalStatus").value, about:document.getElementById("about").value, location:document.getElementById("location").value, interests:document.getElementById("interests").value, caste:document.getElementById("caste").value, subcaste:document.getElementById("subcaste").value, religion:document.getElementById("religion").value, phone:document.getElementById("phone").value, email:document.getElementById("emailR").value, password:document.getElementById("passwordR").value.trim(), confirmPassword:document.getElementById("confirmPassword").value.trim(), timeOfBirth:document.getElementById("timeOfBirth").value, placeOfBirth:document.getElementById("placeOfBirth").value, rashi:document.getElementById("rashi").value, nakshatra:document.getElementById("nakshatra").value, motherTongue:document.getElementById("motherTongue").value, preferences:document.getElementById("preferences").value, smoking:document.getElementById("smoking").value, drinking:document.getElementById("drinking").value, linkedin:document.getElementById("linkedin").value, instagram:document.getElementById("instagram").value };
  var ph = document.getElementById("photos").files[0], ph2 = document.getElementById("photos2").files[0], cap = getCaptchaResponse('regCaptcha');
  var chk = [[!cap,'Complete the CAPTCHA'],[!f.name,'Enter name.'],[!f.age,'Enter age.'],[!f.gender,'Select gender.'],[!f.location,'Enter location.'],[!f.interests,'Enter interests.'],[!f.caste,'Enter caste.'],[!f.phone,'Enter phone.'],[!f.email,'Enter email.'],[!f.password,'Enter password.'],[!f.confirmPassword,'Confirm password.'],[!ph,'Select at least one photo.'],[f.password!==f.confirmPassword,'Passwords do not match.'],[f.about&&f.about.length>50,'About Me must be 50 characters or less.'],[f.preferences&&f.preferences.length>50,'Preferences must be 50 characters or less.']];
  for (var i = 0; i < chk.length; i++) { if (chk[i][0]) { hideLoader2(); showAlert(chk[i][1]); return; } }

  compressImage(ph, 800, 0.75, function(b64) {
    showLoader2('Uploading photos...');
    api.uploadFile(b64).then(function(r) {
      var link1 = r.url;
      if (!ph2) return finishReg(link1);
      compressImage(ph2, 800, 0.75, function(b642) {
        api.uploadFile(b642).then(function(r2) { finishReg(link1 + ',' + r2.url); }).catch(function(err) { hideLoader2(); showAlert('Photo 2 upload failed: ' + err.message); });
      });
    }).catch(function(err) { hideLoader2(); showAlert('Photo upload failed: ' + err.message); });
  });

  function finishReg(allLinks) {
    showLoader2('Saving your profile...');
    var np = Object.assign({}, f, { photos: allLinks, captchaResponse: cap });
    api.appendProfile(np).then(function() {
      hideLoader2(); showAlert("Registration successful! Please login.");
      document.getElementById('registration-section').classList.add('hidden');
      showLanding();
    }).catch(function(err) { hideLoader2(); showAlert('Registration failed: ' + err.message); });
  }
}

// ===== EDIT PROFILE =====
function loadUserProfileForEdit() { document.getElementById("editProfileModal").classList.remove("hidden"); document.getElementById("profile-section").classList.add("hidden"); }
function closeEditProfileModal() { document.getElementById("editProfileModal").classList.add("hidden"); document.getElementById("profile-section").classList.remove("hidden"); }

function saveUserProfile() {
  showLoader('Updating profile...');
  var f = { email:document.getElementById("editEmail").value, name:document.getElementById("editName").value, age:document.getElementById("editAge").value, gender:(document.querySelector('input[name="editGender"]:checked')||{}).value, height:document.getElementById("editHeight").value, education:document.getElementById("editEducation").value, occupation:document.getElementById("editOccupation").value, income:document.getElementById("editIncome").value, maritalStatus:document.getElementById("editMaritalStatus").value, about:document.getElementById("editAbout").value, location:document.getElementById("editLocation").value, interests:document.getElementById("editInterests").value, caste:document.getElementById("editCaste").value, subcaste:document.getElementById("editSubcaste").value, religion:document.getElementById("editReligion").value, phone:document.getElementById("editPhone").value, password:document.getElementById("editPassword").value.trim(), timeOfBirth:document.getElementById("editTimeOfBirth").value, placeOfBirth:document.getElementById("editPlaceOfBirth").value, rashi:document.getElementById("editRashi").value, nakshatra:document.getElementById("editNakshatra").value, motherTongue:document.getElementById("editMotherTongue").value, preferences:document.getElementById("editPreferences").value, smoking:document.getElementById("editSmoking").value, drinking:document.getElementById("editDrinking").value, linkedin:document.getElementById("editLinkedin").value, instagram:document.getElementById("editInstagram").value };
  var ph = null, ph2 = null; try { ph = document.getElementById("newphotos").files[0]; } catch(e) {} try { ph2 = document.getElementById("newphotos2").files[0]; } catch(e) {}
  var chk = [[!f.age,'Enter age.'],[!f.gender,'Select gender.'],[!f.location,'Enter location.'],[!f.name,'Enter name.'],[!f.interests,'Enter interests.'],[!f.caste,'Enter caste.'],[!f.phone,'Enter phone.'],[!f.email,'Enter email.'],[!f.password,'Enter password.'],[f.about&&f.about.length>50,'About Me must be 50 characters or less.'],[f.preferences&&f.preferences.length>50,'Preferences must be 50 characters or less.']];
  for (var i = 0; i < chk.length; i++) { if (chk[i][0]) { hideLoader(); showAlert(chk[i][1]); return; } }
  var editCap = getCaptchaResponse('editCaptcha');
  if (!editCap) { hideLoader(); showAlert('Please complete the CAPTCHA.'); return; }

  function doUp(link) {
    var up = Object.assign({}, f, { photos: link });
    api.updateUserProfile(up, editCap).then(function() {
      _profileRenderedFor = null; // Force re-render with new data
      closeEditProfileModal(); showAlert("Profile updated!"); hideLoader();
      lsSetTs('allProfiles', 0); initProfiles(currentEmail, currentGender); showView('profile');
    }).catch(function() { hideLoader(); showAlert("Error updating."); });
  }
  function uploadBoth(link1) {
    if (!ph2) { doUp(link1); return; }
    compressImage(ph2, 800, 0.75, function(b64) { api.uploadFile(b64).then(function(r) { doUp(link1 + ',' + r.url); }).catch(function() { hideLoader(); showAlert("Upload error."); }); });
  }
  if (!ph && !ph2) { doUp(document.getElementById("editPhotos").src); }
  else if (ph) { compressImage(ph, 800, 0.75, function(b64) { api.uploadFile(b64).then(function(r) { uploadBoth(r.url); }).catch(function() { hideLoader(); showAlert("Upload error."); }); }); }
  else { uploadBoth(document.getElementById("editPhotos").src); }
}

// ===== INIT =====
window.onload = function() {
  showLoader('Welcome...');
  initObservers();
  var token = sessionStorage.getItem('authToken');
  var em = sessionStorage.getItem('sessionEmail');
  if (token && em) {
    // Validate session with server
    api.getSession().then(function(session) {
      currentEmail = session.email;
      currentGender = session.gender === "Male" ? "63889cfb" : (session.gender === "Female" ? "b719ce18" : session.gender);
      sessionStorage.setItem('sessionG', currentGender);
      sessionStorage.setItem('sessionRid', session.rid);
      showApp(); showView('search');
      showInactiveNotice();
      initProfiles(currentEmail, currentGender);
    }).catch(function() {
      // Token invalid/expired
      hideLoader(); showLanding();
    });
  } else {
    hideLoader(); showLanding();
  }
};

// ===== DONATE & ADVERTISE POPUPS =====
function showDonatePopup() { document.getElementById('donatePopup').classList.add('active'); }
function showAdvertisePopup() { document.getElementById('advertisePopup').classList.add('active'); }
function showSupportPopup() { document.getElementById('supportPopup').classList.add('active'); }
function submitDonate(e) {
  e.preventDefault();
  var amount = document.getElementById('donateAmount').value;
  if (!amount) { showAlert('Please enter an amount.'); return; }
  window.location.href = 'upi://pay?pa=shock.hdfc@axl&pn=Rishtas.In&am=' + amount + '&cu=INR';
}
function submitAdvertise(e) {
  e.preventDefault();
  var pn = document.getElementById('adProductName').value;
  var ph = document.getElementById('adPhone').value;
  var em = document.getElementById('adEmail').value;
  var desc = document.getElementById('adDescription').value;
  if (!pn || !em) { showAlert('Please fill in required fields.'); return; }
  var cap = getCaptchaResponse('regCaptcha');
  if (!cap) { showAlert('Please complete the CAPTCHA.'); return; }
  document.getElementById('advertisePopup').classList.remove('active');
  window.location.href = 'mailto:info.rishtas@gmail.com?subject=Advertisement Request for ' + encodeURIComponent(pn) +
    '&body=Product: ' + encodeURIComponent(pn) + '%0APhone: ' + encodeURIComponent(ph) +
    '%0AEmail: ' + encodeURIComponent(em) + '%0ADescription: ' + encodeURIComponent(desc);
}
function submitSupport(e) {
  e.preventDefault();
  var name = document.getElementById('supportName').value;
  var em = document.getElementById('supportEmail').value;
  var cat = document.getElementById('supportCategory').value;
  var msg = document.getElementById('supportMessage').value;
  if (!name || !em || !msg) { showAlert('Please fill in all fields.'); return; }
  var cap = getCaptchaResponse('regCaptcha');
  if (!cap) { showAlert('Please complete the CAPTCHA.'); return; }
  document.getElementById('supportPopup').classList.remove('active');
  window.location.href = 'mailto:info.rishtas@gmail.com?subject=Support Query [' + encodeURIComponent(cat) + '] from ' + encodeURIComponent(name) +
    '&body=Name: ' + encodeURIComponent(name) + '%0AEmail: ' + encodeURIComponent(em) +
    '%0ACategory: ' + encodeURIComponent(cat) + '%0A%0A' + encodeURIComponent(msg);
  showAlert('Support query sent! We will get back to you.');
}

// ===== PHOTO VIEWER =====
var _viewerPhotos = [];
var _viewerIndex = 0;
function openPhotoViewer(photosStr, startIndex) {
  _viewerPhotos = String(photosStr || '').split(',').filter(function(u) { return u.trim(); });
  _viewerIndex = startIndex || 0;
  if (!_viewerPhotos.length) return;
  var vImg = document.getElementById('photoViewerImg');
  vImg.style.display = 'block';
  vImg.onerror = function() { this.src = ''; this.alt = 'Photo unavailable'; this.style.background = 'rgba(255,255,255,.05)'; this.style.minHeight = '200px'; };
  vImg.src = _viewerPhotos[_viewerIndex].trim();
  updateViewerCounter();
  document.getElementById('photoViewer').classList.add('active');
  document.body.style.overflow = 'hidden';
}
function closePhotoViewer() {
  document.getElementById('photoViewer').classList.remove('active');
  document.body.style.overflow = '';
}
function photoViewerPrev() {
  if (_viewerPhotos.length <= 1) return;
  _viewerIndex = (_viewerIndex - 1 + _viewerPhotos.length) % _viewerPhotos.length;
  document.getElementById('photoViewerImg').src = _viewerPhotos[_viewerIndex].trim();
  updateViewerCounter();
}
function photoViewerNext() {
  if (_viewerPhotos.length <= 1) return;
  _viewerIndex = (_viewerIndex + 1) % _viewerPhotos.length;
  document.getElementById('photoViewerImg').src = _viewerPhotos[_viewerIndex].trim();
  updateViewerCounter();
}
function updateViewerCounter() {
  var el = document.getElementById('photoViewerCounter');
  if (_viewerPhotos.length > 1) { el.textContent = (_viewerIndex + 1) + ' / ' + _viewerPhotos.length; el.style.display = ''; }
  else { el.style.display = 'none'; }
}
// Close on escape key
document.addEventListener('keydown', function(e) { if (e.key === 'Escape') closePhotoViewer(); });
// Close on background click
document.getElementById('photoViewer').addEventListener('click', function(e) { if (e.target === this) closePhotoViewer(); });
// Swipe support
(function() {
  var viewer = document.getElementById('photoViewer');
  var startX = 0;
  viewer.addEventListener('touchstart', function(e) { startX = e.touches[0].clientX; });
  viewer.addEventListener('touchend', function(e) {
    var diff = e.changedTouches[0].clientX - startX;
    if (Math.abs(diff) > 50) { if (diff > 0) photoViewerPrev(); else photoViewerNext(); }
  });
})();

// ===== IMAGE ERROR HANDLER (429 / broken images) =====
function handleImgError(img) {
  // Replace broken image with avatar placeholder
  var fallback = document.createElement('div');
  fallback.className = 'img-fallback';
  fallback.innerHTML = '<i class="fa-solid fa-user"></i><span>Photo unavailable</span>';
  fallback.style.height = img.style.height || img.offsetHeight + 'px' || '340px';
  img.parentNode.replaceChild(fallback, img);
}
// Global handler for any image that fails
document.addEventListener('error', function(e) {
  if (e.target.tagName === 'IMG' && e.target.closest('.card-gallery,.profile-gallery,.photo-viewer')) {
    handleImgError(e.target);
  }
}, true);

// ===== #2 BLOCK/REPORT USER =====
function getBlockedUsers() { try { return JSON.parse(localStorage.getItem(LS_PREFIX + 'blocked') || '[]'); } catch(e) { return []; } }

var _menuRid = '', _menuName = '';
function blockUser(rid, name) {
  var blocked = getBlockedUsers();
  if (blocked.indexOf(rid) === -1) blocked.push(rid);
  localStorage.setItem(LS_PREFIX + 'blocked', JSON.stringify(blocked));
  showAlert(name + ' has been blocked.');
  if (_allProfiles) { _renderedCount = 0; renderProfilePage(); }
}
function reportUser(rid, name, reason) {
  var email = sessionStorage.getItem('sessionEmail') || 'anonymous';
  window.location.href = 'mailto:info.rishtas@gmail.com?subject=Report User: ' + encodeURIComponent(name) +
    '&body=Reporter: ' + encodeURIComponent(email) + '%0AReported RID: ' + encodeURIComponent(rid) +
    '%0AReason: ' + encodeURIComponent(reason);
  showAlert('Report submitted. Thank you for keeping the community safe.');
}

// ===== #3 DUPLICATE INTEREST PREVENTION =====
function hasAlreadySentInterest(rid) {
  var cached = lsGet('interests') || [];
  return cached.some(function(i) { return i.rid === rid; });
}

// ===== #4 PROFILE COMPLETENESS =====
function getProfileCompleteness(u) {
  if (!u) return 0;
  var fields = ['name','age','gender','height','education','occupation','income','maritalStatus','about','location','interests','phone','photos','religion','caste','motherTongue'];
  var filled = fields.filter(function(f) { return u[f] && String(u[f]).trim(); }).length;
  return Math.round((filled / fields.length) * 100);
}

// ===== #7 NOTIFICATION BADGES =====
function getReceivedInterestCount() {
  var cached = lsGet('interests') || [];
  return cached.filter(function(i) { return i.status === 'Received'; }).length;
}
function updateBadges() {
  var count = getReceivedInterestCount();
  var badges = document.querySelectorAll('.interest-badge');
  badges.forEach(function(b) {
    if (count > 0) { b.textContent = count; b.style.display = 'flex'; }
    else { b.style.display = 'none'; }
  });
}

// ===== #8 PASSWORD STRENGTH =====
function getPasswordStrength(pw) {
  if (!pw) return { score: 0, label: '', color: '' };
  var score = 0;
  if (pw.length >= 6) score++;
  if (pw.length >= 10) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  var labels = ['Very Weak', 'Weak', 'Fair', 'Strong', 'Very Strong'];
  var colors = ['#ff4444', '#ff8844', '#ffbb33', '#88cc44', '#44bb44'];
  var idx = Math.min(score, 4);
  return { score: score, label: labels[idx], color: colors[idx] };
}

// ===== #9 RATE LIMITING (client-side cooldown) =====
var _lastActionTime = {};
function isRateLimited(action, cooldownMs) {
  var now = Date.now();
  if (_lastActionTime[action] && (now - _lastActionTime[action]) < cooldownMs) {
    showAlert('Please wait a moment before trying again.');
    return true;
  }
  _lastActionTime[action] = now;
  return false;
}

// ===== #10 ERROR RECOVERY (retry wrapper) =====
function apiWithRetry(apiFn, maxRetries) {
  maxRetries = maxRetries || 2;
  var attempt = 0;
  function tryCall() {
    return apiFn().catch(function(err) {
      attempt++;
      if (attempt < maxRetries && err.message !== 'AUTH_REQUIRED') {
        return new Promise(function(resolve) { setTimeout(resolve, 1000 * attempt); }).then(tryCall);
      }
      throw err;
    });
  }
  return tryCall();
}

// ===== CARD MENU (block/report) =====
function showCardMenu(rid, name) {
  _menuRid = rid; _menuName = name;
  document.getElementById('blockReportName').textContent = name;
  document.getElementById('blockConfirmWrap').style.display = 'none';
  document.getElementById('reportFormWrap').style.display = 'none';
  document.getElementById('reportReason').value = '';
  document.getElementById('blockReportModal').classList.add('active');
}
function closeBlockReportModal() {
  document.getElementById('blockReportModal').classList.remove('active');
  _menuRid = ''; _menuName = '';
}
function confirmBlockUser() {
  document.getElementById('blockConfirmWrap').style.display = 'block';
  document.getElementById('reportFormWrap').style.display = 'none';
}
function executeBlock() {
  blockUser(_menuRid, _menuName);
  closeBlockReportModal();
}
function showReportForm() {
  document.getElementById('reportFormWrap').style.display = 'block';
  document.getElementById('blockConfirmWrap').style.display = 'none';
  resetCaptcha('reportCaptcha');
  document.getElementById('reportReason').focus();
}
function executeReport() {
  var reason = document.getElementById('reportReason').value.trim();
  if (!reason) { showAlert('Please describe the reason.'); return; }
  var cap = getCaptchaResponse('reportCaptcha');
  if (!cap) { showAlert('Please complete the CAPTCHA.'); return; }
  reportUser(_menuRid, _menuName, reason);
  closeBlockReportModal();
}

// ===== TERMS / PRIVACY MODALS =====
function showTermsModal() { document.getElementById('termsModal').classList.add('active'); }
function showPrivacyModal() { document.getElementById('privacyModal').classList.add('active'); }

// ===== PASSWORD STRENGTH UI =====
// Call this from password input: onkeyup="showPasswordStrength(this.value, 'strengthIndicator')"
function showPasswordStrength(pw, targetId) {
  var el = document.getElementById(targetId);
  if (!el) return;
  var s = getPasswordStrength(pw);
  if (!pw) { el.innerHTML = ''; return; }
  el.innerHTML = '<div style="display:flex;align-items:center;gap:8px;margin-top:6px"><div style="flex:1;height:3px;background:rgba(255,255,255,.06);border-radius:3px;overflow:hidden"><div style="width:' + (s.score * 20) + '%;height:100%;background:' + s.color + ';border-radius:3px;transition:width .3s"></div></div><span style="font-size:.7rem;color:' + s.color + ';font-weight:600">' + s.label + '</span></div>';
}

// ===== #6 SHARE PROFILE (minimal, requires login to see full) =====
function shareProfile(rid, name) {
  var url = window.location.origin + window.location.pathname + '?view=' + rid;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(url).then(function() { showAlert('Profile link copied! Share it with others.'); });
  } else {
    prompt('Copy this link to share ' + name + "'s profile:", url);
  }
}

// ===== RECAPTCHA EXPLICIT RENDERING =====
var _captchaWidgets = {};
function onRecaptchaLoad() {
  var sitekey = '6LfbrHcqAAAAAGxxav5NeMjsN563xcrez3YUqXdX';
  var ids = ['loginCaptcha','regCaptcha','resetCaptcha1','resetCaptcha2','editCaptcha','adCaptcha','supportCaptcha','reportCaptcha'];
  ids.forEach(function(id) {
    var el = document.getElementById(id);
    if (el && !el.hasChildNodes()) {
      _captchaWidgets[id] = grecaptcha.render(id, { sitekey: sitekey });
    }
  });
}
function getCaptchaResponse(widgetId) {
  if (typeof grecaptcha === 'undefined') return '';
  var wid = _captchaWidgets[widgetId];
  return (wid !== undefined) ? grecaptcha.getResponse(wid) : '';
}
function resetCaptcha(widgetId) {
  if (typeof grecaptcha === 'undefined') return;
  var wid = _captchaWidgets[widgetId];
  if (wid !== undefined) grecaptcha.reset(wid);
}

// ===== PROFILE COMPLETENESS =====
function getProfileCompleteness() {
  if (!_userProfile) return 0;
  var u = _userProfile;
  var fields = ['name','age','gender','height','education','occupation','location','interests','religion','caste','phone','photos','about','maritalStatus','motherTongue'];
  var filled = fields.filter(function(f) { return u[f] && String(u[f]).trim(); }).length;
  return Math.round((filled / fields.length) * 100);
}

// ===== PASSWORD STRENGTH =====
function checkPasswordStrength(pw) {
  if (!pw) return { score: 0, label: '', color: '' };
  var score = 0;
  if (pw.length >= 6) score++;
  if (pw.length >= 10) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  var labels = ['Very Weak','Weak','Fair','Good','Strong'];
  var colors = ['#ff4444','#ff8844','#ffaa00','#88cc44','#44cc88'];
  var idx = Math.min(score, 4);
  return { score: score, label: labels[idx], color: colors[idx] };
}
