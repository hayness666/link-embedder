# Link Embedder — Alpha

Automatic, cleaned link previews for public media and Amazon products in Discord. Public multi-server routing needs **no per-server settings**: after installation, the bot handles new human messages wherever its actual channel permissions allow. Default reply mode preserves originals. Optional author-style reposts replace eligible originals after sending a webhook replacement; see [REPOST.md](REPOST.md). It never forces access, joins private threads, or requests Administrator. The current alpha is restricted to one configured test channel.

## Bot link and release status

[Add Link Embedder to Discord](https://discord.com/oauth2/authorize?client_id=1557858203897823304&scope=bot&permissions=274877926400&integration_type=0).

This is the saved Discord server-install link for application `1557858203897823304`, not an App Directory listing. **Alpha: online in the configured test channel, verified 9 October 2026 (UTC).** This is a manual status report, not a live uptime monitor. The Silly Development runtime connected successfully; YouTube playback and author-style reposting passed live pilot checks. Instagram uses the approved oginstagram.com helper; other helpers remain off. Instagram playback is pending live verification. Installing it alone does not start the service. The Discord profile has the approved icon and a description that labels other site integrations experimental.

[Terms of Service](docs/terms.html), [Privacy Policy](docs/privacy.html), [Help](docs/help.html), and [Contact](docs/contact.html) are in `docs/`. Website: https://hayness666.github.io/link-embedder/. Bot code and website are maintained together in this repository and licensed under [MIT](LICENSE). Third-party dependencies and linked content retain their own licenses and rights.

## Design your previews

Open the [visual playground](https://hayness666.github.io/link-embedder/playground.html) to edit a basic card, add/remove/reorder fields, try a local image, and export a draft or Discord embed JSON. It is a mockup, not a live Discord connection. Exports do not change the bot. The actual basic-card template is in `src/previews.js` inside `buildPayload`; native video/helper layouts are controlled by Discord and providers.

## Local verification

Node.js 24.17+ and npm are required. Run `npm ci --ignore-scripts`, `npm test`, and `npm run check`. Tests mock messages and never contact Discord or providers. `npm start` requires an approved `DISCORD_TOKEN` secret. No token is included; the alpha runtime is deployed separately on Silly Development. The dependency lockfile pins discord.js.

## Behavior and providers

| Platform | Default before provider approval | Approved proxy default / limits |
| --- | --- | --- |
| Instagram reels/posts | Basic link card | `oginstagram` → oginstagram.com; preserves carousel selection |
| TikTok video/photo | Basic link card | `fxtiktok` → tnktok.com; canonical links only |
| Twitter posts | Basic link card | `fxembed` → fxtwitter.com |
| Bluesky posts | Basic link card | `fxembed` → fxbsky.app |
| Reddit posts | Basic link card | `vxreddit` → vxreddit.com; upstream can be fragile |
| Twitch clips | Basic link card | `fxtwitch` → fxtwitch.seria.moe/clip/…; no streams/VODs |
| Snapchat public links | Basic link card | `snapchatez` → snapchatez.com; Spotlight, public shared moments and profile routes only |
| YouTube videos/Shorts | Native cleaned URL | Preserves video/list/time IDs; skips a matching embed already present |
| Amazon products | Native canonical /dp/ASIN URL | Keeps marketplace and ASIN; no custom card suppressing native media |
| Facebook reels/photos/posts | Basic link card | Experimental media helper not enabled |
| LinkedIn / UpScrolled public posts | Basic link card | No verified inline video; narrow public URL shapes only |
| RedNote / Xiaohongshu notes | Basic link card | Preserves xsec_token/xsec_source; no verified free URL-proxy route implemented |
| Mastodon | Basic link card | mastodon.social/mastodon.online only; no media proxy until warnings can be preserved |

Operator-level `PROVIDER_SHARING_APPROVED=yes` enables the named proxy defaults after explicit approval of the entire recipient list in [PRIVACY.md](PRIVACY.md). This is a local deployment safeguard, **not** a claim that Discord enforces universal informed consent before installation. Installers must see the public privacy/help disclosure. Global `PLATFORM_MODE=card|native|off|<listed helper>` overrides remain available; Mastodon only allows card/off. There are no per-server preference settings.

Cards contain platform/content type and a cleaned link, not invented media or metadata. Amazon cards, if explicitly selected, show its ASIN. No reliable official credential-free Amazon metadata source was verified; this bot does not add Creators API/Associates credentials or scrape Amazon. Discord decides native/helper unfurl results; playable media is not guaranteed. YouTube playback passed a live pilot check; other platforms remain unverified. Existing embeds can arrive after MessageCreate, so duplicate native previews can still occur; originals are never suppressed.

## Permissions and routing

Deployment status: A pilot installation has been confirmed. Message Content intent is enabled, Public Bot is on, and installation context is server-only. The alpha runtime is deployed on Silly Development and connected. YouTube playback and author-style reposting were verified in the configured test channel. Other servers and channels are excluded by the current pilot configuration.

Normal configuration enables supported ordinary public links wherever effective permissions allow, including age-restricted Discord channels and their threads. Channel age labels are not content classifications and do not trigger a blanket exclusion. The bot cannot classify linked images/videos or guarantee non-explicit previews. Use is intended for ordinary non-explicit public content; no dedicated adult-site adapters, classifiers, scrapers, media downloads or access-gate bypasses are implemented. The deployed alpha is deliberately limited to one test channel. `PREVIEWS_DISABLED=yes` is an emergency disabled-bot mode that stops EVERY preview, not a functioning safety mode. `.env.example` uses `PREVIEWS_DISABLED=no`. The old `REQUIRE_VERIFIED_SAFE_CONTENT=yes` setting is retained only as a deprecated shutdown alias; remove it from older local configuration to restore normal behavior.

Request only View Channel, Send Messages, Embed Links, and Send Messages in Threads (bitfield `274877926400`). Effective permissions are checked from current Discord state for every message. Forum/media posts are threads: the bot can respond inside accessible active post threads, but never creates a forum post. Archived/locked threads, private threads it has not joined, non-sendable channels, DMs, bots, webhooks, system messages, code, spoilers, masked links and suppressed links are ignored. Discord remains authoritative if permissions change between check and send; failed sends produce a static error code and no access escalation.

Production defaults cover all guilds. `TEST_GUILD_ID` and optional `TEST_CHANNEL_IDS` provide local isolation. Legacy `DISCORD_GUILD_ID`/`DISCORD_CHANNEL_IDS` are accepted as test aliases only. No channel allowlist is needed in production; owners control scope using standard Discord permissions.

Bots do not separately join normal channels. Current and future permitted channels work automatically; restricted channel/category overrides still require an administrator's choice. See HELP.md for exact instructions. No permission mutation, hidden-channel enumeration, settings UI, automatic DM or live onboarding notice is implemented. A single optional installation notice can use the text in SETUP.md after deployment/delivery authorization; it is not sent per channel or on reconnect.

## Privacy and resource limits

See [PRIVACY.md](PRIVACY.md) and [HELP.md](HELP.md) for publishable copy. No database or message-body/URL/token logging. Message caching is disabled. Guild-scoped in-memory message IDs expire after ten minutes (max 1,000 per guild), channel cooldowns after three seconds, and burst timestamps after one minute. Idle guild state expires after ten minutes when another event is processed. Global state is capped at 10,000 guilds; additional uncached guilds are skipped while the cap is full. These controls are isolated between servers.

Up to three distinct supported links per message, one response per channel per three seconds, and twenty responses per server per minute. Excess messages are skipped rather than queued. State resets on restart; run one process. No historical backfill, message-edit handling or deletion synchronization. Gateway/SDK keeps operational guild/channel/member metadata in memory; this is not a promise of zero data processing. Bot responses remain in Discord until deleted.

HTTPS and exact-host checks reject credentials, all explicit ports, encoded host tricks and unknown hosts. Known trackers are removed from generated links, including helper fallbacks. Platform canonicalization preserves content IDs, Facebook story/photo IDs, Instagram image selection and RedNote share-access parameters. No arbitrary fetching, URL expansion, redirects, cookies or private-content/anti-bot bypass. Short links are deliberately skipped; copy a canonical public URL. In default reply mode, original user messages remain unchanged and still contain any original tracking parameters. The optional alpha repost mode is documented in [REPOST.md](REPOST.md). Removing parameters does not make requests untrackable.

## Setup and hosting

Follow [SETUP.md](SETUP.md). Application creation, Message Content intent and Area 666 installation are complete. The alpha is deployed and connected in the configured test channel. Native YouTube playback and author-style reposting passed live checks. Broader channel rollout and third-party helper activation remain pending.

## Sources

[Discord permissions](https://docs.discord.com/developers/topics/permissions), [Message Content intent](https://docs.discord.com/developers/events/gateway), [June 2026 intent review rules](https://support-dev.discord.com/hc/en-us/articles/40281523410967-Changes-to-Privileged-Intent-Access-for-Discord-Apps), [OGInstagram](https://github.com/seirenkr/OGInstagram), [fxTikTok](https://github.com/okdargy/fxTikTok), [FxEmbed](https://github.com/FxEmbed/FxEmbed), [vxReddit](https://github.com/dylanpdx/vxReddit), [FxTwitch](https://github.com/seriaati/fxtwitch), [FxMastodon](https://github.com/Someguy123/fxmastodon), [Snapchat provider](https://embedez.com/snapchat), [RedNote provider](https://embedez.com/xiaohongshu), [Amazon ASIN](https://sell.amazon.com/blog/what-is-an-asin).

## Helper fallback

After 20 seconds, a helper preview without a matching photo or video is changed in place to its original public URL so Discord can attempt a native preview. Native media is not guaranteed. Moderator-edited or deleted messages are left alone. Pending checks are bounded and cleared on restart; a helper error page containing an image may not be distinguishable from a successful preview.
