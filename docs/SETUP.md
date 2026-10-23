# Alpha operator setup

Alpha: the bot is available in installed servers where channel permissions allow on Silly Development, connection verified 21 October 2026 (UTC). This is a manual status report, not a live uptime monitor. The instructions below also apply to fresh deployments. Node.js 24.17+ is required. Install with `npm ci --ignore-scripts`, then run `npm test` and `npm run check`.

1. Read the provider recipients and processing details in [the privacy policy](../src/website/pages/privacy.html). External helper activation requires operator approval; native/basic cards remain available without it.
2. For replacement mode, grant View Channel, Send Messages, Embed Links, Read Message History, Manage Messages, and Manage Webhooks in intended text channels and voice-channel text chats. For threads, also grant Send Messages in Threads and ensure View Channel and Manage Webhooks on the parent channel. Enable Message Content intent; do not request Administrator or member/presence intents.
3. Store an approved bot token using the selected host’s secret mechanism. Never commit it or paste it into chat, logs, screenshots, or command history. `.env.example` contains placeholders only.
4. Choose an always-on host and approve runtime startup. Use optional `TEST_GUILD_ID` and `TEST_CHANNEL_IDS` for development; leave both empty for all installed servers, subject to channel permissions.
5. With posting authorization, check permitted and restricted channels, threads, native cards, and approved helpers on desktop/mobile. Unit tests do not prove playable embeds.

GitHub Pages deploys the static `src/website/` folder through `.github/workflows/pages.yml`; it does not run the Discord bot. Set the repository’s Pages build source to GitHub Actions. Verify the new policy URLs before replacing the existing links in Discord.

Project code and documentation use the MIT License. Third-party dependencies retain their own licenses.

## Runtime behavior

Replacement requires View Channel, Send Messages, Embed Links, Read Message History, Manage Messages, and Manage Webhooks. Threads additionally require Send Messages in Threads, with View Channel and Manage Webhooks on their parent channel. The installation link requests these seven permissions. Existing installations and channel overrides may need administrator updates. Administrator is not required. Permissions are checked for every event; the bot never escalates them itself.

Production scope uses empty `TEST_GUILD_ID` and `TEST_CHANNEL_IDS`. Optional test scope and legacy test aliases remain supported. Replacement accepts eligible messages in text channels, voice-channel text chats, and active public threads under text, forum, and media channels. Same-channel and same-thread replies show a bold author mention and a short excerpt linked to the original message; inaccessible or cross-channel references are left untouched. Attachments, polls, pinned messages, messages that start threads or contain reactions/components, and unsupported channel types are left alone. DMs, bots, webhooks, system messages, and suppressed previews are ignored. Age-restricted channel labels do not classify media or guarantee safe previews. A user’s message can reopen an unlocked archived thread; the bot then checks its current active state. It does not explicitly join, unlock, or unarchive threads.

`PREVIEWS_DISABLED=yes` stops previews. The deprecated `REQUIRE_VERIFIED_SAFE_CONTENT=yes` alias also shuts down processing; it is not a content classifier. No automatic permission changes or first-use notices are implemented.

## Persistent author controls

Open a recorded repost’s options, then Apps and the Link Embedder management command. Choose **Manage Post**. The private menu contains only **MANAGE YOUR POST** and its buttons. **Mark NSFW** is blue and available to anyone with channel access. **Delete Post** is red and only shown to the original sender; ownership is checked again before deletion. There is no custom Dismiss button, first-use channel notice, or DM.

Mark NSFW adds spoilers to supported custom-card media, not captions or links, and does not age-restrict the channel. Native previews are not covered by that control. Deleting removes the repost and does not restore the original. Unrecorded originals, old companion replies, and reposts without ownership records cannot be managed through the command.

Ownership is stored in `data/repost-owners.json` as repost, original-author, server, channel, and webhook IDs only. No message text or webhook tokens are stored. Writes are atomic and complete before deleting the original. Keep this directory on persistent host storage and back it up privately; never commit it. Records remain until managed deletion, rollback, or an operator-verified deletion request. A missing record denies management; a corrupt store stops startup. Capacity is 10,000 records; reaching it preserves originals instead of silently evicting owners.

Current provider routes and card layouts are documented in [README.md](../README.md) and [HELP.md](HELP.md). Keep runtime deployment separate from static website publication.

The existing host has an active five-minute auto-start schedule: power action `start`, with Only When Online disabled. It starts a stopped service; it is not a playback or application-health monitor. The Reddit repair at c850fd6 passed 139 local tests and fresh live QA; see README for coverage and limits.

Bluesky runtime b4d8d42 was saved and restarted once; both readiness markers and representative live QA were confirmed. The active five-minute auto-start schedule was preserved. Documentation publication does not require another runtime restart. See README for coverage and external-link limitations.

Deployment verification: after saving runtime files, confirm a restart actually reset process uptime and produced fresh `link_embedder_ready` and `manage_post_command_ready` logs. Test only newly posted messages after that restart; matching saved-file hashes alone do not prove the running process loaded them.

Threads representative text, single-image, gallery, video, self-quote, different-author quote, long-reply, short-route, and tracking-cleanup examples passed live QA. This does not establish every mobile app sharing format or distinct plain-repost support. The separate global clickable-source-link update passed live QA.
