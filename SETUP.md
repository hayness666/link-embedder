# Alpha operator setup

Alpha: the bot is available in installed servers where channel permissions allow on Silly Development, verified 9 October 2026 (UTC). This is a manual status report, not a live uptime monitor. The instructions below also apply to fresh deployments. Node.js 24.17+ is required. Install with `npm ci --ignore-scripts`, then run `npm test` and `npm run check`.

1. Read the provider recipients and processing details in [the privacy policy](docs/privacy.html). External helper activation requires operator approval; native/basic cards remain available without it.
2. For replacement mode, grant View Channel, Send Messages, Embed Links, Read Message History, Manage Messages and Manage Webhooks in intended ordinary text channels. Enable Message Content intent; do not request Administrator or member/presence intents.
3. Store an approved bot token using the selected host’s secret mechanism. Never commit it or paste it into chat, logs, screenshots or command history. `.env.example` contains placeholders only.
4. Choose an always-on host and approve runtime startup. Use optional `TEST_GUILD_ID` and `TEST_CHANNEL_IDS` for development; leave both empty for all installed servers, subject to channel permissions.
5. With posting authorization, check permitted and restricted channels, threads, native cards and approved helpers on desktop/mobile. Unit tests do not prove playable embeds.

GitHub Pages serves only the static `docs/` folder; it does not run the Discord bot. Publish from `main` / `docs` for this repository. Verify the new policy URLs before replacing the existing links in Discord.

Project code and documentation use the MIT License. Third-party dependencies retain their own licenses.

## Runtime behavior

Replacement requires View Channel, Send Messages, Embed Links, Read Message History, Manage Messages and Manage Webhooks. The saved installation link requests basic preview permissions; channel administrators must supply the additional replacement permissions. Administrator is not required. Permissions are checked for every event; the bot never escalates them itself.

Production scope uses empty `TEST_GUILD_ID` and `TEST_CHANNEL_IDS`. Optional test scope and legacy test aliases remain supported. Replacement accepts eligible ordinary guild-text messages; replies, attachments, polls, pinned messages, messages with threads/reactions/components and unsupported channel types are left alone. DMs, bots, webhooks, system messages and suppressed previews are ignored. Age-restricted channel labels do not classify media or guarantee safe previews.

`PREVIEWS_DISABLED=yes` stops previews. The deprecated `REQUIRE_VERIFIED_SAFE_CONTENT=yes` alias also shuts down processing; it is not a content classifier. No automatic permission changes or first-use notices are implemented.

## Persistent author controls

Open a recorded repost’s options, then Apps and the Link Embedder management command. Choose **Manage Post**. The private menu contains only **MANAGE YOUR POST** and its buttons. **Mark NSFW** is blue and available to anyone with channel access. **Delete Post** is red and only shown to the original sender; ownership is checked again before deletion. There is no custom Dismiss button, first-use channel notice or DM.

Mark NSFW adds spoilers to supported custom-card media, not captions or links, and does not age-restrict the channel. Native previews are not covered by that control. Deleting removes the repost and does not restore the original. Unrecorded originals, old companion replies and reposts without ownership records cannot be managed through the command.

Ownership is stored in `data/repost-owners.json` as repost, original-author, server, channel and webhook IDs only. No message text or webhook tokens are stored. Writes are atomic and complete before deleting the original. Keep this directory on persistent host storage and back it up privately; never commit it. Records remain until managed deletion, rollback or an operator-verified deletion request. A missing record denies management; a corrupt store stops startup. Capacity is 10,000 records; reaching it preserves originals instead of silently evicting owners.

Current provider routes and card layouts are documented in [README.md](README.md) and [HELP.md](HELP.md). Keep runtime deployment separate from static website publication.
