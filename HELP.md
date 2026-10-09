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

Supported route families: Instagram Reels/posts; TikTok videos/photos; Twitter posts; Bluesky posts; Reddit posts; Twitch clips; public Snapchat Spotlight/moments/profiles; YouTube videos/Shorts; Amazon products; selected Facebook reels/photos/posts; LinkedIn/UpScrolled public posts; RedNote full note URLs; Mastodon posts on the currently reviewed instance allowlist. YouTube playback passed a live alpha check; Instagram playback also passed a live check; added providers remain experimental.

Existing previews remain after a source-message edit/deletion. Ask a moderator to delete the bot response if needed. Support is available at https://hayness666.github.io/link-embedder/contact.html.

## Preview and author-control update — 9 October 2026

Custom cards put an available bold linked post title with ↗ above the media (Reddit: post title, then bold r/subname and plain u/username), then the creator. Identical title/caption text is shown once. Custom cards use a platform-colored accent, bold display name with a plain @username when metadata supplies them, media above a plain caption capped at 250 characters (main Twitter text is exempt), and a platform footer via @Link Embedder. The bot-profile mention does not send a notification. No statistics, dates, author portraits or provider buttons are added. Discord controls gallery width and aspect ratio; vertical videos cannot be forced to fill the card. Unknown author names are not invented.

Instagram, TikTok, Twitter, Bluesky, Reddit, Twitch and Snapchat helpers are approved for the pilot. Their metadata is requested directly with bounded responses and no cookies or redirect following. Medal, Streamable, Imgur and LinkedIn use public first-party metadata only. Media availability is experimental: unavailable metadata produces an honest link card. Facebook single photo/post messages can reuse Discord-provided native image metadata; unavailable and mixed messages stay untouched. Reels show an unavailable notice. RedNote, UpScrolled and selected Mastodon instances remain limited cards. YouTube, Amazon, iFunny, Vimeo, GIPHY and Tenor keep the original native preview and receive a separate custom companion card. Mixed messages containing a native platform also keep their source and receive custom companion cards. iFunny returned HTTP 401 in the public metadata check; no bypass is attempted. Imgur albums may show only their published preview image. LinkedIn often requires login. Native availability is controlled by Discord and the source site.

Go to the repost, open its options, choose **Apps**, choose **Link Embedder** if shown, then **Manage my post**. Anyone in the configured channel can open the private **MANAGE YOUR POST** menu and use **Mark NSFW**. Only the original poster sees **Delete Post**, and ownership is checked again before deletion. There is no custom Dismiss button; Discord’s own Dismiss message control closes the menu. Repeat those steps any time to reopen it. Mark NSFW covers custom-card photos/videos with spoilers; captions and links stay visible. It does not age-restrict anything. Native previews cannot use this media control. Delete post removes the repost permanently and does not restore the original. Only new reposts with saved ownership records can be managed; older posts need a moderator.

Ownership is stored in `data/repost-owners.json` as repost, original-author, server, channel and webhook IDs only. No message text or webhook tokens are stored. Writes are atomic and complete before deleting the original. Keep this directory on persistent host storage and back it up privately; never commit it. Records remain until managed deletion, rollback or an operator-verified deletion request. A missing record denies management; a corrupt store stops startup. Capacity is 10,000 records; reaching it preserves originals instead of silently evicting owners.


Twitter cards keep the main tweet in full. Quoted tweets appear as an indented block with up to 250 caption characters, including an ellipsis when shortened. Use the main tweet link to reach the quoted post; no separate quote link is added. Discord does not support a nested card. Posts exceeding the combined card text budget retain the original/helper route instead of silently truncating the main tweet.

Recognized short links for Amazon, TikTok, Instagram, Facebook, Reddit, Twitter, LinkedIn, RedNote and Snapchat can expand through up to four HTTPS redirects within six seconds. Only known same-platform routes are followed; unresolved links stay unchanged. No cookies, login access or JavaScript challenges are used. YouTube short links normalize directly.

Custom preview headings link to the original post with ↗: an available post title (Reddit places r/subname beside the author below the title), otherwise Instagram Reel, Instagram Post, Tweet on Twitter, or the matching platform/type label. Native YouTube and Amazon cards keep Discord/site-supplied clickable titles; the bot cannot rewrite their internal title or append an arrow without replacing the native preview.

Playback verification, 9 October 2026: a fresh card for the public Instagram Reel DeQTySKtHmM played successfully with the current code. The approved helper returned a signed media URL; its Instagram CDN destination served HTTP 206 video/mp4 for a small range request. The earlier Discord playback error was intermittent; no parser regression or expired URL was established. For Facebook photo 1806517487514738 (set a.638414764325022), the local public request returned HTTP 200 with one accepted image, but the hosting server received HTTP 302 to a Facebook access gate with an empty body and no image metadata. The pilot displayed the bot’s fallback card, not a native image preview. No gate was followed or bypassed.

Custom cards use linked titles using Discord’s medium heading style and a bold display name followed by a plain @handle when supplied. Reddit uses a title alone, then bold r/subreddit and a plain u/username. Handles do not ping Discord users. Missing author data is omitted, not guessed. Native player interiors remain controlled by Discord; a custom title/author companion is added separately. The sender’s exact text and URL remain above the preview; expansion and tracker cleanup select preview URLs without rewriting that source. Unavailable media uses “Media preview unavailable.”; untitled cards use a Platform post/reel ↗ link.

Facebook policy: single photo/post messages can reuse an image from Discord’s matching native preview, checked for up to six seconds. Missing images and mixed messages keep their original native preview. Reels receive only “Facebook reel preview unavailable. Open the link above to watch.” beneath the exact original message. No direct Facebook metadata request is made; the bot reads Discord message embeds only.


Reddit video posts require playable media from the approved helper. A bare v.redd.it URL returned as description is not playable media; when no image/video is supplied but a valid v.redd.it address is available, the card offers “View video on Reddit ↗” instead. Other missing media still shows “Media preview unavailable.” Reddit authors use u/username.


Live check, 9 October 2026: the smallest heading style visibly enlarged custom-card titles toward normal message size, and Reddit u/ attribution passed. The dog-video example supplied no playable media via the approved helper. The new Facebook test supplied no native preview during the bounded wait, so its original message stayed untouched; successful Facebook image reuse remains unverified.


Reddit website-only posts use a compact card with the clickable destination URL (without an arrow) and no thumbnail gallery.


Facebook photo URLs omit the album-context set parameter when reposted, while preserving fbid and message prose. This is an explicit exception to exact source URL preservation. If no native image metadata is available, a cleaned Facebook photo URL uses Discord’s native preview instead of a custom card.


All 21 configured platforms use custom cards or custom companion sections. Native-mode sources stay untouched to preserve working players. YouTube and Vimeo use public official oEmbed title/author metadata; Amazon, iFunny, GIPHY and Tenor attempt bounded public page metadata and fall back to a linked card when unavailable. No private content, cookies, access-gate bypasses, paid APIs, or invented author data are used. Facebook retains its specific reel notice and native-image-reuse rules. Custom presentation does not guarantee media availability.

The private MANAGE YOUR POST menu lets anyone in the configured channel mark repost media NSFW. Only the original poster sees Delete Post and can delete; deletion is checked again on every action. Reopening directions are included. Discord’s own Dismiss message control can close it.
