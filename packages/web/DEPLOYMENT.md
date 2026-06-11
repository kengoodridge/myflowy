# Deployment

## Docker / Podman (self-hosted)

See the root [README](../../README.md) for build and run instructions.

---

## Vercel (static hosting)

Vercel auto-detects Vite projects. No adapter or SSR config needed — the output
is a plain static bundle.

### 1. Add cache-control headers

Create `packages/web/vercel.json` (Vercel reads it from the project root, which
is `packages/web/` if you set the root directory in the project settings):

```json
{
  "headers": [
    {
      "source": "/(index\\.html|sw\\.js|workbox-.+\\.js|registerSW\\.js)",
      "headers": [
        { "key": "Cache-Control", "value": "no-store, no-cache, must-revalidate" }
      ]
    },
    {
      "source": "/(.*\\.(js|css|png|ico|webmanifest|woff2?))",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
      ]
    }
  ]
}
```

This mirrors the nginx config: SW files are never cached so updates roll out
immediately; content-hashed assets are cached for one year.

### 2. Set the build-time environment variable

In the Vercel dashboard → Project → Settings → Environment Variables, add:

| Name                   | Value                        | Environment        |
|------------------------|------------------------------|--------------------|
| `VITE_GOOGLE_CLIENT_ID`| `<your OAuth client ID>`     | Production, Preview |

Vite bakes this value into the JS bundle at build time, so it must be set before
the build runs (not at runtime).

### 3. Configure the Vercel project

In Project Settings:

- **Framework Preset**: Vite
- **Root Directory**: `packages/web`
- **Build Command**: `cd ../.. && yarn build:core && yarn build:web`
- **Output Directory**: `dist`

The build command runs from the repo root so `@myflowy/core` is compiled first.

### 4. Authorize the Vercel domain in Google Cloud Console

Go to [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services
→ Credentials → your OAuth 2.0 Client ID → **Authorized JavaScript origins**.

Add:
- `https://<your-project>.vercel.app` (auto-assigned domain)
- Any custom domain you attach to the project

Without this, Google Sign-In will throw an `invalid_client` / origin mismatch
error.

### 5. Deploy

Push to the branch connected to your Vercel project, or run:

```bash
npx vercel --prod
```

from `packages/web/`.
