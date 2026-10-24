# Optional author-style reposts

Anyone with permission to install apps can add Link Embedder to a Discord server. It works in channels where the required permissions are granted.

The hosted bot replaces eligible new messages in channels where it has the required permissions.

Discord webhooks can display the sender's name and avatar, but remain webhook-authored. Discord displays its APP badge; no extra attribution line is appended to the message text. Authors can manage newly tracked reposts through Apps → Manage Post; moderators can also remove them. This changes message IDs and timestamps and does not preserve native Discord reply relationships. Tell participating members before enabling.

Required effective channel permissions: View Channel, Send Messages, Embed Links, Read Message History, Manage Messages, Manage Webhooks. No Administrator. Grant extra permissions directly to this bot only in channels where author-style reposting is wanted. Do not grant Administrator. The developer portal permission calculator does not grant permissions. An existing installation needs actual server/channel permission updates.

Eligible plain-text posts work in text channels, voice-channel text chats, and active public threads under text, forum, and media channels. Same-channel and same-thread replies show a small reply-context line above your text: an italic “Click to see message” link to the exact reply target, with a bold author mention when the human author is verified. Reply context never copies the target’s text. The author mention opens their profile and permits a notification on initial posting. Edits and NSFW updates do not notify them again. This is not a native Discord reply. Missing or inaccessible references, attachments, stickers, polls, pins, thread starters, components, reactions, suppressed previews, overlong messages, and unsupported display names keep their original post without a separate preview response. Preserve surrounding original text; custom cards retain the source link once; avoid appending native links already present, and add preview cards without additional mentions. The existing provider-sharing approval still applies.

The bot creates/reuses its own Link Embedder Reposts webhook in an enabled channel. Webhook credentials stay in process memory and are never printed or persisted by this code. Discord retains the webhook until a server administrator removes it under Channel Settings → Integrations. Disable reposts before removing it or the bot can recreate it.

Replacement is confirmed before deletion. The source is fetched again to check text, edits, and eligibility. On failure, keep the source; remove the replacement only if the source is confirmed to still exist. Ambiguous network results can leave duplicates. Discord does not offer an atomic replace operation, so a final edit race cannot be eliminated. No history backfill; only new messages trigger processing.

Local tests cover send failure, lost delete acknowledgements, concurrent source edits, eligibility, permissions, and opt-in scope. Live verification uses a designated test channel; this does not restrict public installation or operation in other permitted channels.

## Author controls

Open a recorded repost’s options, then Apps and the Link Embedder management command. Choose **Manage Post**. The private menu contains action buttons without a heading. **Mark NSFW** is blue and available to anyone with channel access. **Delete Post** is red and only shown to the original sender; ownership is checked again before deletion. There is no custom Dismiss button, first-use channel notice, or DM.

Mark NSFW adds spoilers to supported custom-card media, not captions or links, and does not age-restrict the channel. The original poster can use **Remove spoiler** to uncover that media in place; other users cannot remove spoilers. Native previews are not covered by that control. Deleting removes the repost and does not restore the original. Unrecorded originals, old companion replies, and reposts without ownership records cannot be managed through the command.

Ownership is stored in `data/repost-owners.json` as repost, original-author, server, channel, and webhook IDs only. No message text or webhook tokens are stored. Writes are atomic and complete before deleting the original. Records remain until managed deletion, rollback, or an operator-verified deletion request. A missing record denies management; a corrupt store stops startup. Capacity is 10,000 records; reaching it preserves originals instead of silently evicting owners.

See [README.md](../README.md) for current card layouts and provider limits.

Threads support does not cover every mobile sharing format or guarantee previews for plain reposts.
