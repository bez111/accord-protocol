# Launch artifacts

This directory holds archived launch drafts from the earlier
`ergo-agent-economy` line plus copy that may be adapted for Accord Protocol.
Do not post any draft here without first reconciling it with
[`docs/status.md`](../status.md), [`SECURITY.md`](../../SECURITY.md), and the
current package matrix.

* `hn-launch.md` — Show HN draft.
* `x-thread.md` — X (Twitter) launch thread.
* `discord-announcement.md` — Discord post for relevant servers.
* `mcp-so-listing.md` — copy for the [mcp.so](https://mcp.so) listing.
* `hn-accord-launch.md` — current Accord Protocol Show HN draft with canonical website links.
* `reddit-accord-launch.md` — current Reddit launch/discussion draft.
* `x-accord-thread.md` — current X thread draft with website, learn, status and demo links.
* `discord-accord-announcement.md` — current community announcement copy.
* `external-link-outreach.md` — prioritized list of external-link targets and exact URLs/copy.
* `github-release-v0.4.2.md` — GitHub Release notes for the staged `v0.4.2` evidence release.
* `github-release-v0.4.1.md` — GitHub Release notes for the `v0.4.1` package line.
* `manual-indexing-checklist.md` — owner-account checklist for search-console and community launch tasks.
* `og-image-spec.md` — what an OG image (open graph preview) should
  look like, with a placeholder URL until we have one.
* [`../PARTNERSHIP_DISCLOSURE.md`](../PARTNERSHIP_DISCLOSURE.md) — policy for
  hardware-wallet reviews, affiliate offers, sponsored content and
  co-marketing.

Each draft must stay short, factual, and linked back to canonical artifacts in
the repo. Current public wording must say Accord is alpha / testnet-first, not
production-certified, and not mainnet-certified.

## Order of operations for the launch

1. Verify package availability and public website health.
2. Publish or refresh the GitHub Release with `NOT CERTIFIED FOR MAINNET`
   language and links to public status/security pages.
3. Submit `https://accordprotocol.ai/sitemap.xml` in Google Search Console and
   Bing Webmaster Tools.
4. Get one external auditor commitment (even informal). Without that,
   the "NOT CERTIFIED FOR MAINNET" banner stays loud.
5. Submit `mcp.json` to the mcp.so listing.
6. Post Show HN. Capture the discussion in `hn-launch.md` afterwards
   for the next iteration.
7. X thread within 24h of HN post.
8. Discord posts in agent-dev communities (one per community, no
   cross-posting).
9. Reach out to 3-5 design partners in private — agent teams that
   already need a payment rail.
10. Handle any sponsor, review-device or affiliate offer through
    [`docs/PARTNERSHIP_DISCLOSURE.md`](../PARTNERSHIP_DISCLOSURE.md) before it
    touches public launch copy.
11. After the public website is live, make sure every external post uses
   the canonical homepage: https://accordprotocol.ai/

The first 48 hours determine whether discovery happens at all.

## Don't post until

* Package availability matches [`docs/PACKAGE_MATRIX.md`](../PACKAGE_MATRIX.md).
* The preferred demo path from [`README.md`](../../README.md) runs from a
  clean clone.
* The CHANGELOG entry is finalised and the GitHub Release is published or refreshed.
* `npm run release:check`, `npm run audit:check`, and `npm run site:check`
  pass on the release branch.
