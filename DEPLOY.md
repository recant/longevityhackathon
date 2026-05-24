# Private shareable demo

Keep the **GitHub repo private** while giving judges, teammates, or family a link to try the app.

## Recommended setup

| Layer | What to do |
|-------|------------|
| **Source code** | Leave [recant/longevityhackathon](https://github.com/recant/longevityhackathon) **private**. Add collaborators under **Settings → Collaborators** if others need the code. |
| **Live app** | Deploy to [Render](https://render.com) from the private repo (Render can read private GitHub repos you authorize). |
| **Access control** | Set `SHARE_USER` and `SHARE_PASSWORD` on Render so the URL is not public without a login. |

The app is **not indexed** and **not on GitHub Pages** (which requires a public repo on the free tier). Only people with the URL **and** the password can use the demo.

---

## 1. Deploy on Render (≈10 minutes)

1. Sign in at [render.com](https://render.com) and connect your GitHub account.
2. **New → Blueprint** (or **New Web Service** → connect `recant/longevityhackathon`).
3. If using the blueprint, Render reads [`render.yaml`](./render.yaml) at the repo root.
4. In the service **Environment** tab, set:
   - `SHARE_USER` — e.g. `demo`
   - `SHARE_PASSWORD` — a long random string (password manager or `openssl rand -base64 24`)
   - Optional: `OPENAI_API_KEY` or `OLLAMA_API_KEY` for AI insights
5. Deploy. Your URL will look like: `https://longevitree-demo.onrender.com`
6. Share **only** with people you trust:
   - Link: `https://longevitree-demo.onrender.com`
   - Username / password from step 4

Browsers will show a standard login prompt the first time they open the link.

**Note:** Free Render services sleep after inactivity; the first visit may take ~30s to wake up.

---

## 2. Run locally with the same protection

```powershell
cd server
$env:SHARE_USER = "demo"
$env:SHARE_PASSWORD = "your-secret-here"
uvicorn main:app --host 0.0.0.0 --port 8000
```

Others on your LAN can open `http://<your-ip>:8000` and use the same credentials.

---

## 3. Other private options

| Method | Best for |
|--------|----------|
| **GitHub Codespaces** | Developers with repo access; no public URL. Repo stays private. |
| **Cloudflare Tunnel** + Access | Team email allowlist in front of `localhost:8000`. |
| **ngrok** | Quick 1-hour share: `ngrok http 8000` (add basic auth in ngrok dashboard). |

---

## Environment variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `SHARE_USER` | For private link | HTTP Basic Auth username |
| `SHARE_PASSWORD` | For private link | HTTP Basic Auth password |
| `SHARE_REALM` | No | Browser login dialog title (default: `Longevitree demo`) |
| `PARENT_PACE_DATA_DIR` | On Render | Persistent SQLite + uploads (`/var/data` in `render.yaml`) |
| `ALLOWED_ORIGINS` | If using Vite dev | Comma-separated CORS origins |

`/api/health` stays public so Render health checks work without credentials.

---

## Security notes

- This is **demo-grade** protection (shared password), not HIPAA-grade auth.
- Do not put real PHI in the demo; use fictional parent profiles.
- Rotate `SHARE_PASSWORD` if the link leaks.
- Wellness / education only — see [SAFETY.md](./SAFETY.md).
