# Adeeb Abdurahiman — Portfolio

A static portfolio built with plain HTML, CSS and JavaScript, with a custom Three.js particle sculpture as its signature feature. No framework, no build step, no backend.

## Design in brief

- **Palette:** warm near-black `#0b0c0a`, ivory `#ece8df`, one lime accent `#c8f43a`.
- **Type:** Instrument Serif (display), Hanken Grotesk (text), JetBrains Mono (metadata).
- **Particle sculpture:** a shell of points that starts as a loose sphere and, as you scroll through the hero, snaps into an ordered cubic lattice (chaos to infrastructure). It relaxes back to a sphere at the contact section. The cursor pushes and swirls nearby points, and the pointer tilts the whole structure. All motion runs in the vertex shader.
- **Performance:** point count scales with device (about 1,100 to 2,000 points), pixel ratio is capped and lowered automatically if frames are slow, rendering pauses when the tab is hidden, and a static fallback is shown without WebGL. `prefers-reduced-motion` renders a single still frame.

## Structure

```
portfolio/
├── index.html
├── css/style.css
├── js/
│   ├── config.js        <- edit your email, LinkedIn, form endpoint here
│   ├── main.js          <- entry point, contact form, small details
│   ├── scene.js         <- Three.js particle sculpture
│   ├── cursor.js        <- custom cursor
│   └── animations.js    <- reveals, nav, progress bar, tilt
├── assets/
│   ├── favicon.svg
│   └── vendor/          <- Three.js (MIT), vendored so the site has no CDN dependency
├── Dockerfile, nginx.conf, .dockerignore
├── .github/workflows/ci.yml
└── .gitignore
```

## What you need to replace

1. **Email** and **LinkedIn URL** in `js/config.js`. The footer and contact links update automatically. (The LinkedIn URL also appears as a fallback in `index.html`.)
2. **Contact form endpoint** in `js/config.js` (`formEndpoint`). See below.
3. **Project links.** The three "Source code" / "Live demo" links in `index.html` carry `data-placeholder` and do nothing until you replace `href="#"` with real URLs and remove `data-placeholder` and `aria-disabled`.
4. Optional: add real dates to the Learning timeline in `index.html` once you want them shown.

### Contact form

The site is static, so the form posts to a third-party form service instead of a backend:

1. Create a free form at [Formspree](https://formspree.io) (Web3Forms, Basin and Getform use the same JSON POST style).
2. Paste the endpoint into `formEndpoint` in `js/config.js`.
3. If you use a different provider, change the origin in `connect-src` in `nginx.conf`.

Until an endpoint is set, submitting opens the visitor's email app with the message pre-filled, so nothing is lost. Spam protection comes from a honeypot field plus the provider's own filtering and rate limits. There are no secrets in this repository.

## Run locally

ES modules need an HTTP server (opening `index.html` directly will not work):

```bash
python3 -m http.server 8000
# or
npx serve .
```

Then open http://localhost:8000. No `npm install` needed.

## Docker

```bash
docker build -t adeeb-portfolio .
docker run --rm -p 8080:8080 adeeb-portfolio
# http://localhost:8080
```

The image is `nginx-unprivileged` on Alpine, runs as a non-root user, serves on port 8080, and sets security headers including a Content-Security-Policy. `GET /healthz` returns `ok`.

## GitHub Actions

`.github/workflows/ci.yml` already runs on every push and pull request: JavaScript syntax check, required-file check, Docker build, and a smoke test of the running container. To enable it, push the project to GitHub. No secrets are required.

## Deployment (future)

| Option | Fit | Notes |
|---|---|---|
| **GitHub Pages** | Easiest, free | Works as-is: the site uses only relative paths. Serve the repo root (Settings, Pages, Deploy from branch). Pages ignores `nginx.conf`, so security headers won't apply. |
| **S3 + CloudFront** | Best production fit for a static site | Sync `index.html`, `css/`, `js/`, `assets/` to a bucket, put CloudFront in front with HTTPS, set the response headers from `nginx.conf` in a CloudFront response-headers policy. Add a deploy job to the workflow using GitHub OIDC (no long-lived keys). |
| **AWS EC2 + Docker** | Good for practising DevOps | Run the container behind Nginx/Caddy or an ALB with TLS. Push the image to ECR from CI, then pull it on the instance. |

For this architecture (static files, no backend), **S3 + CloudFront** is the most suitable and cheapest. Use **EC2 + Docker** if you want the deployment itself to be a portfolio piece, and **GitHub Pages** for the quickest first launch.

## Notes

- Google Fonts are loaded from Google. To self-host them, download the three families and replace the `<link>` in `index.html` with `@font-face` rules, then tighten `style-src` / `font-src` in `nginx.conf`.
- No `.env.example` is included because the site has no runtime secrets or environment variables.
- Three.js is vendored (minified from the official npm package, MIT licence in `assets/vendor/THREE-LICENSE.txt`).
- **Featured projects** are hand-written in `index.html` (duplicate an `<article class="project">` block to add one).
- **"More on GitHub"** is live: `js/repos.js` fetches your public repos from the GitHub API on each visit (cached for 10 minutes per browser session), so new repos appear automatically. Forks and archived repos are skipped. Hide repos with `hideRepos` in `js/config.js`. Repo descriptions come from GitHub, so add one to each repo's About box. The anonymous API limit is 60 requests per hour per visitor, which is plenty here. If you self-host with the Nginx config, `api.github.com` is already allowed in the CSP.
