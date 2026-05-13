# Accord Protocol website

This directory contains the static public website for Accord Protocol.

## Run locally

```bash
npm run site:serve
```

Open `http://localhost:4173`.

## Validate the site surface

```bash
npm run site:check
```

The check verifies the SEO-critical tags, structured data entry points, agent discovery files and core static assets.

## Deployment

Deploy the contents of `site/` as the web root for `https://accordprotocol.ai/`.

Important public files:

- `/index.html` - semantic landing page with JSON-LD, Open Graph and FAQ schema.
- `/robots.txt` - crawler and AI crawler access policy.
- `/sitemap.xml` - canonical crawl map.
- `/llms.txt` - compact LLM reference.
- `/llms-full.txt` - expanded LLM context.
- `/agents.txt` - advisory instructions for AI agents and retrieval systems.
- `/.well-known/accord.json` - structured protocol discovery.
- `/.well-known/security.txt` - security contact policy.

Keep the safety language aligned with `docs/status.md` and `SECURITY.md`.
