# M_H_S Movies frontend

## Files
- `index.html` — page structure
- `style.css` — responsive dark theme
- `app.js` — demo movie cards and optional Supabase read connection

## Run locally
Open `index.html` in a browser, or use VS Code Live Server.

## Supabase setup
In `app.js`, fill in:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY` (publishable/anon key only; never service_role)

Expected public `movies` columns: `id`, `title`, `description`, `poster_url`, `drive_file_id`, `subtitle_url`, `category`, `created_at`.
Enable SELECT access safely for published movies using RLS. Enable Realtime for the `movies` table if you want database changes to update without refreshing.

Admin login and writes are intentionally not enabled yet. Configure Supabase Auth and restrictive RLS policies before adding any admin write features. Never store a password in frontend code or commit secret keys to GitHub.

## Google Drive note
Google Drive sharing/preview links are not guaranteed to work as direct MP4 sources for an HTML5 video element. The current player opens the Drive preview in a separate tab. Separate `.srt`/`.vtt` subtitles can only be added to the custom player when a compatible direct video source is available. Use only content you own or have permission to distribute.
