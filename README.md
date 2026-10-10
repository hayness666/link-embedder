# Link Embedder — Alpha

We know Twitter’s name has legally changed, but we still call it Twitter.

Automatic previews for supported public links in Discord. **Public alpha — anyone with permission to install apps can add Link Embedder to a server. Give it the required permissions in every channel where you want it to work.** This project is in pre-release alpha. Repository behavior and the hosted bot can differ until deployment; this README is not a live uptime report or release log.

## Install and setup

[Add Link Embedder to Discord](https://discord.com/oauth2/authorize?client_id=1557858203897823304&scope=bot&permissions=274877926400&integration_type=0). This is a server-install link, not an App Directory listing. Installation alone does not start the hosting process or grant every replacement permission. Follow [SETUP.md](SETUP.md) and [REPOST.md](REPOST.md).

The app supports installed servers without a per-server allowlist. Effective channel permissions determine where it works. The hosted service is deployed separately on Silly Development. Keep the bot token in approved secret storage; never commit it.

[Terms](docs/terms.html), [Privacy](docs/privacy.html), [Help](docs/help.html), and [Contact](docs/contact.html) are in `docs/`. Website: https://hayness666.github.io/link-embedder/. Code and documentation use the [MIT License](LICENSE); third-party content retains its own rights.

## Design your previews

Open the [visual playground](https://hayness666.github.io/link-embedder/playground.html) to edit a basic card, add/remove/reorder fields, try a local image, and export a draft or Discord embed JSON. It is a mockup, not a live Discord connection. Exports do not change the bot. Custom media layouts live in `src/simple-cards.js` and `src/instagram-card.js`; brand colors/logos are in `src/platform-brands.js`. `src/previews.js` handles native/mixed fallbacks. The playground exports legacy embed drafts, not Components V2 production cards.

## Local verification

Node.js 24.17+ and npm are required. Run `npm ci --ignore-scripts`, `npm test`, and `npm run check`. Tests mock messages and never contact Discord or providers. `npm start` requires an approved `DISCORD_TOKEN` secret. No token is included; the alpha runtime is deployed separately on Silly Development. The dependency lockfile pins discord.js.

## Behavior and providers

With `REPOST_AS_AUTHOR=yes`, eligible messages are replaced through an author-style webhook. The replacement must be confirmed before deleting the original. If replacement is unavailable, the bot does not send a separate reply. Network ambiguity is handled conservatively to avoid deleting the only confirmed copy. Discord shows the APP badge. No extra “Reposted by Link Embedder” line is appended.

User prose is preserved. Preview URLs may be canonicalized independently. Explicit visible URL cleanup applies to Facebook photo album context, Netflix, Prime Video, Threads and YouTube tracking parameters. Functional IDs, timestamps and access parameters must not be indiscriminately stripped.

| Platform | Default before provider approval | Approved proxy default / limits |
| --- | --- | --- |
| Instagram Reels/posts | Basic link card | `oginstagram` → oginstagram.com; preserves carousel selection |
| TikTok video/photo | Basic link card | `fxtiktok` → tnktok.com; canonical links only |
| Twitter posts | Basic link card | `fxembed` → fxtwitter.com |
| Bluesky posts | Basic link card | `fxembed` → fxbsky.app |
| Reddit posts | Basic link card | `vxreddit` → vxreddit.com; upstream can be fragile |
| Twitch clips | Basic link card | `fxtwitch` → fxtwitch.seria.moe/clip/…; no streams/VODs |
| Snapchat public links | Basic link card | `snapchatez` → snapchatez.com; Spotlight, public shared moments and profile routes only |
| YouTube videos/Shorts | Tracking cleanup only | Plain-text replacement only when trackers are removed; Discord supplies native previews |
| Amazon products | Custom product card in replacement mode | Available public/native title, description and image; store only if verified |
| Facebook content links | Custom cards reuse useful Discord metadata; missing previews receive type-specific notices | No Facebook media metadata fetch |
| LinkedIn / UpScrolled public posts | Basic link card | No verified inline video; narrow public URL shapes only |
| RedNote / Xiaohongshu notes | Basic link card | Preserves xsec_token/xsec_source; no verified free URL-proxy route implemented |
| Medal / Streamable / Imgur | Public metadata card | Direct media when public metadata supplies it; full canonical links only |
| iFunny / Vimeo / GIPHY / Tenor | Native cleaned link | Experimental native availability; no private access or extra helper |
| Mastodon | Basic link card | mastodon.social/mastodon.online only; no media proxy until warnings can be preserved |

| Twitter Spaces / Lists / Communities | Linked resource card | Matching Discord metadata when available; no audio player or private membership access |
| Threads public posts | Custom card | `fzthreads` → fzthreads.com after approval; public text and allowlisted photos/video when supplied. Spoiler/private responses and failures use a linked fallback. |
| Netflix / Prime Video | Linked title or storefront card | Matching Discord metadata/image when available; Prime Video titles also use public page metadata; no embedded playback |

Operator-level `PROVIDER_SHARING_APPROVED=yes` enables the eight documented helpers after approval of the recipients in [PRIVACY.md](PRIVACY.md). Installers should see the privacy/help disclosure. Platform overrides use `PLATFORM_MODE=card|native|off|<listed helper>`; Mastodon allows card/off only. Native-only modes other than Amazon are left untouched in replacement mode. Legacy reply mode remains available in code but is not the requested replacement-only deployment behavior.

YouTube cleanup preserves video IDs, timestamps, playlists, fragments and other functional parameters. Already-clean links are untouched. YouTube-containing messages use plain text, no custom card or helper request; Discord controls whether its native player appears.

Single Facebook links use custom cards for photos, reels, posts, profiles/pages, groups, videos/Watch, Marketplace listings, events, albums, stories and known share/short-link routes. Matching Discord metadata supplies useful titles, descriptions and images; generic login previews are discarded. Missing media receives a type-specific unavailable notice. No Facebook login or direct media fetch is used. Photo cleanup removes album `set` while preserving `fbid`. Messages containing Facebook plus another recognized content link remain untouched. Facebook fallbacks say “Photo preview unavailable.” for photos, “Story preview unavailable.” for story/permalink posts, and “Reel preview unavailable.” for reels.

Reddit website-only posts show the actual clickable destination URL without an arrow or thumbnail gallery. When the helper supplies only a v.redd.it address rather than playable media, a link to the video page is shown. Availability of Reddit video playback is not guaranteed.

Netflix and Prime Video cards do not fetch authenticated playback. Prime Video title pages can supply a public title, synopsis and poster after matching the canonical title ID. Storefront links remain storefronts rather than being presented as film titles. Known trackers and handoff parameters such as Netflix `trackId`/`tctx` and Prime Video `xdsso`/`ref_` are removed from visible repost URLs; other parameters are preserved.

## Card presentation

Custom cards use bold linked titles in regular card text, no decorative title arrows, a small gap below the title and a divider above the footer. Real titles are preferred; untitled content uses labels such as Instagram Reel, Instagram Post and Post on Twitter. Platform colors identify the card; Instagram uses #E1306C. Discord controls final media sizing; there is no supported arbitrary width/height setting.

Display names are bold and handles are plain, without mentions. Reddit uses a bold r/subreddit beside a plain u/username below the title. Missing author data is omitted. Cards omit engagement counts, dates, author portraits and provider buttons. The platform footer includes a fixed-label Link Embedder profile hyperlink rather than a mention; the visible name does not depend on Discord resolving a user in forwarded messages. Profile navigation still depends on the Discord client.

Media normally appears above the caption. Captions are limited to 250 characters. Twitter, Threads, Bluesky and Mastodon use full main-post text above any available media; supplied quoted text is indented below the media and capped at 250 characters. No separate quote link is added. A linked Space section may appear inside a Twitter post; direct Spaces, Lists and Communities have linked resource cards. Their titles, availability and audio are not invented. Threads without usable metadata uses the same linked unavailable-card layout as Facebook photos. Mastodon remains limited to basic cards until content-warning handling and a media source are verified. The total Discord text budget can still prevent creation of an oversized custom card.

## Managing reposts

Open a recorded repost’s options, then Apps and the Link Embedder management command. Choose **Manage Post**. The private menu contains only **MANAGE YOUR POST** and its buttons. **Mark NSFW** is blue and available to anyone with channel access. **Delete Post** is red and only shown to the original sender; ownership is checked again before deletion. There is no custom Dismiss button, first-use channel notice or DM.

Mark NSFW adds spoilers to supported custom-card media, not captions or links, and does not age-restrict the channel. Native previews are not covered by that control. Deleting removes the repost and does not restore the original. Unrecorded originals, old companion replies and reposts without ownership records cannot be managed through the command.

Ownership is stored in `data/repost-owners.json` as repost, original-author, server, channel and webhook IDs only. No message text or webhook tokens are stored. Writes are atomic and complete before deleting the original. Keep this directory on persistent host storage and back it up privately; never commit it. Records remain until managed deletion, rollback or an operator-verified deletion request. A missing record denies management; a corrupt store stops startup. Capacity is 10,000 records; reaching it preserves originals instead of silently evicting owners.

## Permissions and routing

Replacement requires View Channel, Send Messages, Embed Links, Read Message History, Manage Messages and Manage Webhooks. The saved installation link requests basic preview permissions; channel administrators must supply the additional replacement permissions. Administrator is not required. Permissions are checked for every event; the bot never escalates them itself.

Production scope uses empty `TEST_GUILD_ID` and `TEST_CHANNEL_IDS`. Optional test scope and legacy test aliases remain supported. Replacement accepts eligible ordinary guild-text messages; replies, attachments, polls, pinned messages, messages with threads/reactions/components and unsupported channel types are left alone. DMs, bots, webhooks, system messages and suppressed previews are ignored. Age-restricted channel labels do not classify media or guarantee safe previews.

`PREVIEWS_DISABLED=yes` stops previews. The deprecated `REQUIRE_VERIFIED_SAFE_CONTENT=yes` alias also shuts down processing; it is not a content classifier. No automatic permission changes or first-use notices are implemented.

## Privacy and resource limits

See [PRIVACY.md](PRIVACY.md) and [HELP.md](HELP.md) for publishable copy. No message-body/URL/token logging. Repost ownership IDs persist locally as described below. Message caching is disabled. Guild-scoped in-memory message IDs expire after ten minutes (max 1,000 per guild), channel cooldowns after three seconds, and burst timestamps after one minute. Idle guild state expires after ten minutes when another event is processed. Global state is capped at 10,000 guilds; additional uncached guilds are skipped while the cap is full. These controls are isolated between servers.

Up to three distinct supported links per message, one response per channel per three seconds, and twenty responses per server per minute. Excess messages are skipped rather than queued. State resets on restart; run one process. No historical backfill, message-edit handling or deletion synchronization. Gateway/SDK keeps operational guild/channel/member metadata in memory; this is not a promise of zero data processing. Bot responses remain in Discord until deleted.

HTTPS and exact-host checks reject credentials, all explicit ports, encoded host tricks and unknown hosts. Known trackers are removed from generated links, including helper fallbacks. Platform canonicalization preserves content IDs, Facebook story/photo IDs, Instagram image selection and RedNote share-access parameters. Recognized short links for Amazon, TikTok, Instagram, Facebook, Reddit, Twitter, LinkedIn, RedNote and Snapchat can expand through up to four HTTPS redirects within six seconds. Only known same-platform routes are followed; unresolved links stay unchanged. No cookies, login access or JavaScript challenges are used. YouTube short links normalize directly.

## Provider availability

Public helpers and media URLs can fail or expire. Initial metadata failure uses an honest linked fallback where supported. There is no delayed backup timer removing working previews. No cookies, private-content access, login-gate bypasses, paid APIs or guessed metadata are used. LinkedIn may require login; Imgur albums may expose only a preview image; unapproved media redirects are not followed.

## Sources

[Discord permissions](https://docs.discord.com/developers/topics/permissions), [Message Content intent](https://docs.discord.com/developers/events/gateway), [June 2026 intent review rules](https://support-dev.discord.com/hc/en-us/articles/40281523410967-Changes-to-Privileged-Intent-Access-for-Discord-Apps), [OGInstagram](https://github.com/seirenkr/OGInstagram), [fxTikTok](https://github.com/okdargy/fxTikTok), [FxEmbed](https://github.com/FxEmbed/FxEmbed), [vxReddit](https://github.com/dylanpdx/vxReddit), [FxTwitch](https://github.com/seriaati/fxtwitch), [FxMastodon](https://github.com/Someguy123/fxmastodon), [Snapchat provider](https://embedez.com/snapchat), [RedNote provider](https://embedez.com/xiaohongshu), [Amazon ASIN](https://sell.amazon.com/blog/what-is-an-asin).
