# Link Embedder Alpha help

Share a canonical HTTPS link to a supported public post or Amazon product. Link Embedder automatically posts a cleaned preview in channels and active threads where it has permission. No commands or per-server setup are required. Default reply mode preserves the original. The current alpha pilot uses optional author-style reposts; see [REPOST.md](REPOST.md). It is restricted to one configured test channel.

Ordinary supported public links also work in age-restricted Discord channels. Channel labels do not tell the bot whether a linked image or video is explicit, and the bot has no media classifier. Use it for ordinary non-explicit content; no guarantee of automatic explicit-content filtering is made. It supports no dedicated adult-site adapters and never bypasses a source site's age, login or privacy restrictions.

Amazon and YouTube use Discord's normal previews. Other services may show a simple link card or an external provider preview, depending on the operator's globally approved providers. See the privacy disclosure for destinations. A basic card does not promise a thumbnail or playable video.

To prevent a preview, wrap the URL in angle brackets, a spoiler or code. The bot also respects message-level embed suppression. To disable the bot in an area, deny its View Channel or relevant send permission through Discord. Administrator permission is not needed.

## Server admin access checklist

Bots do not join ordinary text channels separately. Link Embedder automatically handles current and newly created channels when effective permissions allow it; there is no production channel list to maintain.

For a restricted channel, open **Edit Channel → Permissions**, select the **Link Embedder** role or bot member, and allow **View Channel**, **Send Messages** and **Embed Links**. To enable replies in threads/forum posts, also allow **Send Messages in Threads** on the parent channel. If a channel inherits permissions from a category, apply the intended permissions there or deliberately adjust the channel's overrides. Review all applicable role/member denies; do not assume a server-level grant overrides them.

Private threads require access through Discord's normal membership controls; the bot will not force a join. Archived/locked threads remain skipped. Server administrators decide which areas are accessible. Link Embedder cannot guarantee access to every channel, does not change roles or permissions, and never needs Administrator. It does not list hidden channels or reveal their names in notices. The same rules apply regardless of a channel's age-restriction label.

No preview? Check its View Channel, Embed Links and Send Messages permissions (Send Messages in Threads for threads). Archived/locked or unjoined private threads are skipped. Wait a few seconds if messages were rapid. Use a canonical full link: short redirects, private posts, deleted posts, login-only/age-restricted media and unsupported routes can fail. Native/helper availability varies by platform. No account cookies or private-account access will fix this through Link Embedder.

Supported route families: Instagram reels/posts; TikTok videos/photos; Twitter posts; Bluesky posts; Reddit posts; Twitch clips; public Snapchat Spotlight/moments/profiles; YouTube videos/Shorts; Amazon products; selected Facebook reels/photos/posts; LinkedIn/UpScrolled public posts; RedNote full note URLs; Mastodon posts on the currently reviewed instance allowlist. YouTube playback passed a live alpha check; Instagram playback also passed a live check; added providers remain experimental.

Existing previews remain after a source-message edit/deletion. Ask a moderator to delete the bot response if needed. Support is available at https://hayness666.github.io/link-embedder/contact.html.

## Preview and author-control update — 9 October 2026

Custom cards use a platform-colored accent, bold display name with a plain @username when metadata supplies them, media above a plain caption capped at 250 characters, and a platform footer via @Link Embedder. The bot-profile mention does not send a notification. No statistics, dates, author portraits or provider buttons are added. Discord controls gallery width and aspect ratio; vertical videos cannot be forced to fill the card. Unknown author names are not invented.

Instagram, TikTok, Twitter, Bluesky, Reddit, Twitch and Snapchat helpers are approved for the pilot. Their metadata is requested directly with bounded responses and no cookies or redirect following. Medal, Streamable, Imgur and LinkedIn use public first-party metadata only. Media availability is experimental: unavailable metadata produces an honest link card. Facebook, RedNote, UpScrolled and selected Mastodon instances remain limited cards. YouTube, Amazon, iFunny, Vimeo, GIPHY and Tenor retain native previews; mixed messages containing a native platform retain the native/helper route. iFunny returned HTTP 401 in the public metadata check; no bypass is attempted. Imgur albums may show only their published preview image. LinkedIn often requires login. Native availability is controlled by Discord and the source site.

Go to the repost, open its options, choose **Apps**, choose **Link Embedder** if shown, then **Manage my post**. Only the original poster receives the private **Delete post · Mark NSFW · Dismiss** menu. Dismiss does not remove access: repeat those steps any time. Mark NSFW covers custom-card photos/videos with spoilers; captions and links stay visible. It does not age-restrict anything. Native previews cannot use this media control. Delete post removes the repost permanently and does not restore the original. Only new reposts with saved ownership records can be managed; older posts need a moderator.

Ownership is stored in `data/repost-owners.json` as repost, original-author, server, channel and webhook IDs only. No message text or webhook tokens are stored. Writes are atomic and complete before deleting the original. Keep this directory on persistent host storage and back it up privately; never commit it. Records remain until managed deletion, rollback or an operator-verified deletion request. A missing record denies management; a corrupt store stops startup. Capacity is 10,000 records; reaching it preserves originals instead of silently evicting owners.
