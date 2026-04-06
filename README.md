# V2: External Hosting + REST API

## What Changed from V1

| Aspect | V1 | V2 |
|--------|----|----|
| HTML hosting | Apps Script HtmlService | GitHub Pages (or any static host) |
| API calls | `google.script.run` | `fetch()` via `api.js` |
| Landing + App | Separate files (main.html + iframe) | Single combined `index.html` |
| Page load | Hits Apps Script doGet() every time | Served from CDN, cached by browser |
| File structure | 2 HTML files + 1 GS file | 4 static files + 1 GS file |

## File Structure

```
v2/
├── index.html    Combined landing page + app (single page)
├── styles.css    All CSS (extracted from inline styles)
├── api.js        fetch() wrapper for Apps Script REST API
├── app.js        All application logic (auth, profiles, cache, etc.)
├── code.gs       Apps Script backend (doGet/doPost as JSON router)
└── README.md     This file
```

## Setup

### 1. Deploy Apps Script as Web App
1. Create a Google Sheet
2. Extensions > Apps Script > paste `code.gs`
3. Deploy > New Deployment > Web App > Execute as "Me" > Access "Anyone"
4. Copy the deployment URL

### 2. Configure api.js
Open `api.js` and replace `YOUR_APPS_SCRIPT_DEPLOYMENT_URL_HERE` with your URL.

### 3. Host Static Files
Upload `index.html`, `styles.css`, `api.js`, `app.js` to GitHub Pages (or any static host).

### 4. Set Up Cleanup Trigger
In Apps Script: Triggers > Add Trigger > `cleanupInactiveUsers` > Time-driven > Day timer

### 5. Set Up GitHub Actions (Profile Cache)
The GitHub Action fetches all profiles every 3 hours, encrypts them, and stores in `v2/data/profiles.json`. This eliminates heavy backend calls for profile discovery.

1. In Apps Script > Project Settings > Script Properties, add: `DUMP_SECRET` = any secret string
2. In your GitHub repo > Settings > Secrets and variables > Actions, add these secrets:
   - `API_URL`: Your Apps Script deployment URL
   - `DUMP_SECRET`: Same secret string as step 1
   - `ENCRYPT_KEY`: `r1sht4s_pr0f1l3s_2024_s3cur3` (must match `PROFILE_ENCRYPT_KEY` in app.js)
3. The workflow runs automatically every 3 hours, or trigger manually from Actions tab

## Benefits Over V1

- **Faster page loads**: HTML/CSS/JS served from CDN, not Apps Script
- **No iframe**: Landing and app are one page, no cross-frame communication
- **Cacheable assets**: Browser caches CSS/JS files, only data calls hit the server
- **Cleaner code**: CSS, JS, HTML in separate files
- **Easier development**: Edit CSS/JS locally without redeploying Apps Script
