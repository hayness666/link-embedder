# Server setup

Add Link Embedder using the [installation link in the README](../README.md#install). You need permission to install apps in the server.

Run `/permissions scope:server` for a private summary of channels you can view and manage, or `/permissions` for a specific channel. The command reports missing permissions without changing roles or channel settings. Existing installations and channel overrides may need administrator adjustments.

## Runtime behavior

Replacement requires View Channel, Send Messages, Embed Links, Read Message History, Manage Messages, and Manage Webhooks. Threads additionally require Send Messages in Threads, with View Channel and Manage Webhooks on their parent channel. The installation link requests these seven permissions. Existing installations and channel overrides may need administrator updates. Administrator is not required. Permissions are checked for every event; the bot never escalates them itself.

Replacement accepts eligible messages in text channels, voice-channel text chats, and active public threads under text, forum, and media channels. Same-channel and same-thread replies show an italic “Click to see message” link to the original message, with a bold author mention when the human author is verified; inaccessible or cross-channel references are left untouched. Attachments, polls, pinned messages, messages that start threads or contain reactions/components, and unsupported channel types are left alone. DMs, bots, webhooks, system messages, and suppressed previews are ignored. Age-restricted channel labels do not classify media or guarantee safe previews. A user’s message can reopen an unlocked archived thread; the bot then checks its current active state. It does not explicitly join, unlock, or unarchive threads.

`PREVIEWS_DISABLED=yes` stops previews. The deprecated `REQUIRE_VERIFIED_SAFE_CONTENT=yes` alias also shuts down processing; it is not a content classifier. No automatic permission changes or first-use notices are implemented.

## Persistent author controls

Open a recorded repost’s options, then Apps and the Link Embedder management command. Choose **Manage Post**. The private menu contains action buttons without a heading. **Mark NSFW** is blue and available to anyone with channel access. **Delete Post** is red and only shown to the original sender; ownership is checked again before deletion. There is no custom Dismiss button, first-use channel notice, or DM.

Mark NSFW adds spoilers to supported custom-card media, not captions or links, and does not age-restrict the channel. The original poster can use **Remove spoiler** to uncover that media in place; other users cannot remove spoilers. Native previews are not covered by that control. Deleting removes the repost and does not restore the original. Unrecorded originals, old companion replies, and reposts without ownership records cannot be managed through the command.

Ownership is stored in `data/repost-owners.json` as repost, original-author, server, channel, and webhook IDs only. No message text or webhook tokens are stored. Writes are atomic and complete before deleting the original. Records remain until managed deletion, rollback, or an operator-verified deletion request. A missing record denies management; a corrupt store stops startup. Capacity is 10,000 records; reaching it preserves originals instead of silently evicting owners.

Current provider routes and card layouts are documented in [README.md](../README.md) and [HELP.md](HELP.md).
