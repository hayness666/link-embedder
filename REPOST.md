# Optional author-style reposts

Disabled by default. Set REPOST_AS_AUTHOR=yes only after the server owner approves deletion and webhook creation in the explicitly configured TEST_GUILD_ID / TEST_CHANNEL_IDS. This mode refuses an unrestricted configuration.

Discord webhooks can display the sender's name and avatar, but remain webhook-authored. Each replacement states “Reposted by Link Embedder”. The original author cannot directly edit/delete the webhook post as their own; moderators can remove it. This changes message IDs and timestamps and does not preserve reply links. Tell participating members before enabling.

Required effective channel permissions: View Channel, Send Messages, Embed Links, Read Message History, Manage Messages, Manage Webhooks. No Administrator. Grant the extra permissions to this bot only in the pilot text channel; do not expand the shared robots role. The developer portal permission calculator does not grant permissions. An existing installation needs actual server/channel permission updates.

Only ordinary plain-text posts are eligible. Attachments, stickers, replies, polls, pins, threads, components, reactions, suppressed previews, overlong messages and unsupported display names keep their original post and use the ordinary preview response. Preserve all original text; append preview URLs/cards without additional mentions. The existing provider-sharing approval still applies.

The bot creates/reuses its own Link Embedder Reposts webhook in an enabled channel. Webhook credentials stay in process memory and are never printed or persisted by this code. Discord retains the webhook until a server administrator removes it under Channel Settings → Integrations. Disable reposts before removing it or the bot can recreate it.

Replacement is confirmed before deletion. The source is fetched again to check text, edits and eligibility. On failure, keep the source; remove the replacement only if the source is confirmed to still exist. Ambiguous network results can leave duplicates. Discord does not offer an atomic replace operation, so a final edit race cannot be eliminated. No history backfill; only new messages trigger processing.

Local tests cover send failure, lost delete acknowledgements, concurrent source edits, eligibility, permissions and opt-in scope. Live testing remains required in the approved test channel before widening scope.

For hosting, index.js reads the secret .env first, then optional pilot.env overrides for the five pilot settings only. Keep DISCORD_TOKEN solely in .env. pilot.env is ignored by Git. Unknown pilot keys stop startup with a fixed error.
