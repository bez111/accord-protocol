# Open Graph image - spec

When social platforms (X, LinkedIn, Bluesky, Discord embeds) preview an
Accord link, they should receive the canonical website card at:

* `assets/og-card.svg` - editable source
* `assets/og-card.png` - crawler-ready PNG used by `og:image`
* `site/assets/og-card.svg` and `site/assets/og-card.png` - deploy mirror

## What to render

Website Open Graph / Twitter card ratio: **1200 x 630**.

GitHub repository social preview can reuse the same PNG unless a separate
GitHub-only crop is designed later. The important invariant for the website is
that the committed PNG is exactly 1200 x 630, because `index.html` advertises
that size in `og:image:width` and `og:image:height`.

Recommended composition:

* Top-left: Accord mark.
* Centre / large: `Accord Protocol`.
* Supporting line: `Agreement + receipt layer for agent commerce`.
* Core positioning: `x402 verifies payment. Accord verifies completion.`
* Right side: visible receipt stack:
  ```
  Agreement Object
  Verification Receipt
  Settlement Receipt
  ```
* Footer posture: `Testnet-first. Audit-gated. Mainnet blocked until signed manifests.`
* No stock illustrations, cyberpunk neon, vague finance imagery or claims that
  imply mainnet certification.

## Guardrail

`npm run site:check` must fail if `site/assets/og-card.png` is missing or is
not a 1200 x 630 PNG. Keep that check in place whenever the image changes.

## Optional GitHub upload

1. Render the committed SVG to PNG.
2. Settings -> Social preview -> Edit -> upload PNG.
3. Verify the embed at https://www.opengraph.xyz/url/https%3A%2F%2Fgithub.com%2Faccord-protocol%2Faccord-protocol

## Logo (separate, smaller scope)

A logo for the repo / npm packages is a separate task. For now the
README and npm pages use no logo. Adding one means:

* Designing or commissioning a 512×512 mark.
* Committing it to `assets/logo.svg`.
* Linking from each package's README and from the docs site.
* Updating the OG image with the same mark.

This is a "do once, do right" task. Do not ship a placeholder mark.
