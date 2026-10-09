# Optional author-style reposts

Release stage: **Alpha**. Experimental; currently limited to the configured test channel.

Disabled by default. Set REPOST_AS_AUTHOR=yes only after the server owner approves deletion and webhook creation in the explicitly configured TEST_GUILD_ID / TEST_CHANNEL_IDS. This mode refuses an unrestricted configuration.

Discord webhooks can display the sender's name and avatar, but remain webhook-authored. Discord displays its APP badge; no extra attribution footer is appended. Authors can manage newly tracked reposts through Apps → Manage my post; moderators can also remove them. This changes message IDs and timestamps and does not preserve reply links. Tell participating members before enabling.

Required effective channel permissions: View Channel, Send Messages, Embed Links, Read Message History, Manage Messages, Manage Webhooks. No Administrator. Grant the extra permissions to this bot only in the pilot text channel; do not expand the shared robots role. The developer portal permission calculator does not grant permissions. An existing installation needs actual server/channel permission updates.

Only ordinary plain-text posts are eligible. Attachments, stickers, replies, polls, pins, threads, components, reactions, suppressed previews, overlong messages and unsupported display names keep their original post and use the ordinary preview response. Preserve surrounding original text; custom cards retain the source link once; native YouTube links are expanded to full watch URLs; avoid appending native links already present, and add preview cards without additional mentions. The existing provider-sharing approval still applies.

The bot creates/reuses its own Link Embedder Reposts webhook in an enabled channel. Webhook credentials stay in process memory and are never printed or persisted by this code. Discord retains the webhook until a server administrator removes it under Channel Settings → Integrations. Disable reposts before removing it or the bot can recreate it.

Replacement is confirmed before deletion. The source is fetched again to check text, edits and eligibility. On failure, keep the source; remove the replacement only if the source is confirmed to still exist. Ambiguous network results can leave duplicates. Discord does not offer an atomic replace operation, so a final edit race cannot be eliminated. No history backfill; only new messages trigger processing.

Local tests cover send failure, lost delete acknowledgements, concurrent source edits, eligibility, permissions and opt-in scope. Live testing remains required in the approved test channel before widening scope.

For hosting, index.js reads the secret .env first, then optional pilot.env overrides for the five pilot settings only. Keep DISCORD_TOKEN solely in .env. pilot.env is ignored by Git. Unknown pilot keys stop startup with a fixed error.

## Preview and author-control update — 9 October 2026

Custom cards use a platform-colored accent, bold display name with a plain @username when metadata supplies them, media above a plain caption capped at 250 characters, and a platform footer via @Link Embedder. The bot-profile mention does not send a notification. No statistics, dates, author portraits or provider buttons are added. Discord controls gallery width and aspect ratio; vertical videos cannot be forced to fill the card. Unknown author names are not invented.

Instagram, TikTok, Twitter, Bluesky, Reddit, Twitch and Snapchat helpers are approved for the pilot. Their metadata is requested directly with bounded responses and no cookies or redirect following. Medal, Streamable, Imgur and LinkedIn use public first-party metadata only. Media availability is experimental: unavailable metadata produces an honest link card. Facebook, RedNote, UpScrolled and selected Mastodon instances remain limited cards. YouTube, Amazon, iFunny, Vimeo, GIPHY and Tenor retain native previews; mixed messages containing a native platform retain the native/helper route. iFunny returned HTTP 401 in the public metadata check; no bypass is attempted. Imgur albums may show only their published preview image. LinkedIn often requires login. Native availability is controlled by Discord and the source site.

Go to the repost, open its options, choose **Apps**, choose **Link Embedder** if shown, then **Manage my post**. Only the original poster receives the private **Delete post · Mark NSFW · Dismiss** menu. Dismiss does not remove access: repeat those steps any time. Mark NSFW covers custom-card photos/videos with spoilers; captions and links stay visible. It does not age-restrict anything. Native previews cannot use this media control. Delete post removes the repost permanently and does not restore the original. Only new reposts with saved ownership records can be managed; older posts need a moderator.

Ownership is stored in `data/repost-owners.json` as repost, original-author, server, channel and webhook IDs only. No message text or webhook tokens are stored. Writes are atomic and complete before deleting the original. Keep this directory on persistent host storage and back it up privately; never commit it. Records remain until managed deletion, rollback or an operator-verified deletion request. A missing record denies management; a corrupt store stops startup. Capacity is 10,000 records; reaching it preserves originals instead of silently evicting owners.
