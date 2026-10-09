# Alpha operator setup

Alpha: the bot is online in one configured test channel on Silly Development, verified 9 October 2026 (UTC). This is a manual status report, not a live uptime monitor. The instructions below also apply to fresh deployments. Node.js 24.17+ is required. Install with `npm ci --ignore-scripts`, then run `npm test` and `npm run check`.

1. Read the provider recipients and processing details in [the privacy policy](docs/privacy.html). External helper activation requires operator approval; native/basic cards remain available without it.
2. Configure only View Channel, Send Messages, Embed Links and Send Messages in Threads. Enable Message Content intent; do not request Administrator or member/presence intents.
3. Store an approved bot token using the selected host’s secret mechanism. Never commit it or paste it into chat, logs, screenshots or command history. `.env.example` contains placeholders only.
4. Choose an always-on host and approve runtime startup. Configure `TEST_GUILD_ID` and optional `TEST_CHANNEL_IDS` with your own test identifiers before a pilot.
5. With posting authorization, check permitted and restricted channels, threads, native cards and approved helpers on desktop/mobile. Unit tests do not prove playable embeds.

GitHub Pages serves only the static `docs/` folder; it does not run the Discord bot. Publish from `main` / `docs` for this repository. Verify the new policy URLs before replacing the existing links in Discord.

Project code and documentation use the MIT License. Third-party dependencies retain their own licenses.

## Preview and author-control update — 9 October 2026

Custom cards use a platform-colored accent, bold display name with a plain @username when metadata supplies them, media above a plain caption capped at 250 characters, and a platform footer via @Link Embedder. The bot-profile mention does not send a notification. No statistics, dates, author portraits or provider buttons are added. Discord controls gallery width and aspect ratio; vertical videos cannot be forced to fill the card. Unknown author names are not invented.

Instagram, TikTok, Twitter, Bluesky, Reddit, Twitch and Snapchat helpers are approved for the pilot. Their metadata is requested directly with bounded responses and no cookies or redirect following. Medal, Streamable, Imgur and LinkedIn use public first-party metadata only. Media availability is experimental: unavailable metadata produces an honest link card. Facebook, RedNote, UpScrolled and selected Mastodon instances remain limited cards. YouTube, Amazon, iFunny, Vimeo, GIPHY and Tenor retain native previews; mixed messages containing a native platform retain the native/helper route. iFunny returned HTTP 401 in the public metadata check; no bypass is attempted. Imgur albums may show only their published preview image. LinkedIn often requires login. Native availability is controlled by Discord and the source site.

Go to the repost, open its options, choose **Apps**, choose **Link Embedder** if shown, then **Manage my post**. Only the original poster receives the private **Delete post · Mark NSFW · Dismiss** menu. Dismiss does not remove access: repeat those steps any time. Mark NSFW covers custom-card photos/videos with spoilers; captions and links stay visible. It does not age-restrict anything. Native previews cannot use this media control. Delete post removes the repost permanently and does not restore the original. Only new reposts with saved ownership records can be managed; older posts need a moderator.

Ownership is stored in `data/repost-owners.json` as repost, original-author, server, channel and webhook IDs only. No message text or webhook tokens are stored. Writes are atomic and complete before deleting the original. Keep this directory on persistent host storage and back it up privately; never commit it. Records remain until managed deletion, rollback or an operator-verified deletion request. A missing record denies management; a corrupt store stops startup. Capacity is 10,000 records; reaching it preserves originals instead of silently evicting owners.
