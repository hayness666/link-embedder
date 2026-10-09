# Optional author-style reposts

Release stage: **Alpha**. Public alpha: anyone with permission to install apps can add Link Embedder to a Discord server. It works in channels where the required permissions are granted.

Disabled by default. Set REPOST_AS_AUTHOR=yes only after the server owner approves deletion and webhook creation in the intended channels. Optional test scope can still restrict a development deployment.

Discord webhooks can display the sender's name and avatar, but remain webhook-authored. Discord displays its APP badge; no extra attribution line is appended to the message text. Authors can manage newly tracked reposts through Apps → Manage Post; moderators can also remove them. This changes message IDs and timestamps and does not preserve reply links. Tell participating members before enabling.

Required effective channel permissions: View Channel, Send Messages, Embed Links, Read Message History, Manage Messages, Manage Webhooks. No Administrator. Grant extra permissions directly to this bot only in channels where author-style reposting is wanted. Do not grant Administrator. The developer portal permission calculator does not grant permissions. An existing installation needs actual server/channel permission updates.

Only ordinary plain-text posts are eligible. Attachments, stickers, replies, polls, pins, threads, components, reactions, suppressed previews, overlong messages and unsupported display names keep their original post without a separate preview response. Preserve surrounding original text; custom cards retain the source link once; YouTube reposts remove known tracking while preserving native playback; avoid appending native links already present, and add preview cards without additional mentions. The existing provider-sharing approval still applies.

The bot creates/reuses its own Link Embedder Reposts webhook in an enabled channel. Webhook credentials stay in process memory and are never printed or persisted by this code. Discord retains the webhook until a server administrator removes it under Channel Settings → Integrations. Disable reposts before removing it or the bot can recreate it.

Replacement is confirmed before deletion. The source is fetched again to check text, edits and eligibility. On failure, keep the source; remove the replacement only if the source is confirmed to still exist. Ambiguous network results can leave duplicates. Discord does not offer an atomic replace operation, so a final edit race cannot be eliminated. No history backfill; only new messages trigger processing.

Local tests cover send failure, lost delete acknowledgements, concurrent source edits, eligibility, permissions and opt-in scope. Live verification uses a designated test channel; this does not restrict public installation or operation in other permitted channels.

For hosting, index.js reads the secret .env first, then optional pilot.env overrides for the five pilot settings only. Keep DISCORD_TOKEN solely in .env. pilot.env is ignored by Git. Unknown pilot keys stop startup with a fixed error.

## Author controls

Open a recorded repost’s options, then Apps and the Link Embedder management command. Choose **Manage Post**. The private menu contains only **MANAGE YOUR POST** and its buttons. **Mark NSFW** is blue and available to anyone with channel access. **Delete Post** is red and only shown to the original sender; ownership is checked again before deletion. There is no custom Dismiss button, first-use channel notice or DM.

Mark NSFW adds spoilers to supported custom-card media, not captions or links, and does not age-restrict the channel. Native previews are not covered by that control. Deleting removes the repost and does not restore the original. Unrecorded originals, old companion replies and reposts without ownership records cannot be managed through the command.

Ownership is stored in `data/repost-owners.json` as repost, original-author, server, channel and webhook IDs only. No message text or webhook tokens are stored. Writes are atomic and complete before deleting the original. Keep this directory on persistent host storage and back it up privately; never commit it. Records remain until managed deletion, rollback or an operator-verified deletion request. A missing record denies management; a corrupt store stops startup. Capacity is 10,000 records; reaching it preserves originals instead of silently evicting owners.

See [README.md](README.md) for current card layouts and provider limits.
