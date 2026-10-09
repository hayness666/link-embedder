# Optional author-style reposts

Release stage: **Alpha**. Experimental; currently limited to the configured test channel.

Disabled by default. Set REPOST_AS_AUTHOR=yes only after the server owner approves deletion and webhook creation in the intended channels. Optional test scope can still restrict a development deployment.

Discord webhooks can display the sender's name and avatar, but remain webhook-authored. Discord displays its APP badge; no extra attribution footer is appended. Authors can manage newly tracked reposts through Apps → Manage my post; moderators can also remove them. This changes message IDs and timestamps and does not preserve reply links. Tell participating members before enabling.

Required effective channel permissions: View Channel, Send Messages, Embed Links, Read Message History, Manage Messages, Manage Webhooks. No Administrator. Grant extra permissions directly to this bot only in channels where author-style reposting is wanted. Do not grant Administrator. The developer portal permission calculator does not grant permissions. An existing installation needs actual server/channel permission updates.

Only ordinary plain-text posts are eligible. Attachments, stickers, replies, polls, pins, threads, components, reactions, suppressed previews, overlong messages and unsupported display names keep their original post and use the ordinary preview response. Preserve surrounding original text; custom cards retain the source link once; native YouTube links are expanded to full watch URLs; avoid appending native links already present, and add preview cards without additional mentions. The existing provider-sharing approval still applies.

The bot creates/reuses its own Link Embedder Reposts webhook in an enabled channel. Webhook credentials stay in process memory and are never printed or persisted by this code. Discord retains the webhook until a server administrator removes it under Channel Settings → Integrations. Disable reposts before removing it or the bot can recreate it.

Replacement is confirmed before deletion. The source is fetched again to check text, edits and eligibility. On failure, keep the source; remove the replacement only if the source is confirmed to still exist. Ambiguous network results can leave duplicates. Discord does not offer an atomic replace operation, so a final edit race cannot be eliminated. No history backfill; only new messages trigger processing.

Local tests cover send failure, lost delete acknowledgements, concurrent source edits, eligibility, permissions and opt-in scope. Live testing remains required in the approved test channel before widening scope.

For hosting, index.js reads the secret .env first, then optional pilot.env overrides for the five pilot settings only. Keep DISCORD_TOKEN solely in .env. pilot.env is ignored by Git. Unknown pilot keys stop startup with a fixed error.

## Preview and author-control update — 9 October 2026

Custom cards put an available bold linked post title with ↗ above the media (Reddit: post title, then bold r/subname and plain u/username), then the creator. Identical title/caption text is shown once. Custom cards use a platform-colored accent, bold display name with a plain @username when metadata supplies them, media above a plain caption capped at 250 characters (main Twitter text is exempt), and a platform footer via @Link Embedder. The bot-profile mention does not send a notification. No statistics, dates, author portraits or provider buttons are added. Discord controls gallery width and aspect ratio; vertical videos cannot be forced to fill the card. Unknown author names are not invented.

Instagram, TikTok, Twitter, Bluesky, Reddit, Twitch and Snapchat helpers are approved for this deployment. Their metadata is requested directly with bounded responses and no cookies or redirect following. Medal, Streamable, Imgur and LinkedIn use public first-party metadata only. Media availability is experimental: unavailable metadata produces an honest link card. Facebook single photo/post messages can reuse Discord-provided native image metadata; unavailable and mixed messages stay untouched. Reels show an unavailable notice. RedNote, UpScrolled and selected Mastodon instances remain limited cards. YouTube, Amazon, iFunny, Vimeo, GIPHY and Tenor keep the original native preview and receive a separate custom companion card. Mixed messages containing a native platform also keep their source and receive custom companion cards. iFunny returned HTTP 401 in the public metadata check; no bypass is attempted. Imgur albums may show only their published preview image. LinkedIn often requires login. Native availability is controlled by Discord and the source site.

Go to the repost, open its options, choose **Apps**, choose **Link Embedder** if shown, then **Manage my post**. Anyone with access to the repost channel can open the private **MANAGE YOUR POST** menu and use **Mark NSFW**. Only the original poster sees **Delete Post**, and ownership is checked again before deletion. There is no custom Dismiss button; Discord’s own Dismiss message control closes the menu. Repeat those steps any time to reopen it. Mark NSFW covers custom-card photos/videos with spoilers; captions and links stay visible. It does not age-restrict anything. Native previews cannot use this media control. Delete post removes the repost permanently and does not restore the original. Only reposts with saved ownership records can be managed; older posts need a moderator.

Ownership is stored in `data/repost-owners.json` as repost, original-author, server, channel and webhook IDs only. No message text or webhook tokens are stored. Writes are atomic and complete before deleting the original. Keep this directory on persistent host storage and back it up privately; never commit it. Records remain until managed deletion, rollback or an operator-verified deletion request. A missing record denies management; a corrupt store stops startup. Capacity is 10,000 records; reaching it preserves originals instead of silently evicting owners.

Twitter cards keep the main tweet in full. Quoted tweets appear as an indented block with up to 250 caption characters, including an ellipsis when shortened. Use the main tweet link to reach the quoted post; no separate quote link is added. Discord does not support a nested card. Posts exceeding the combined card text budget retain the original/helper route instead of silently truncating the main tweet.

Recognized short links for Amazon, TikTok, Instagram, Facebook, Reddit, Twitter, LinkedIn, RedNote and Snapchat can expand through up to four HTTPS redirects within six seconds. Only known same-platform routes are followed; unresolved links stay unchanged. No cookies, login access or JavaScript challenges are used. YouTube short links normalize directly.

Custom preview headings link to the original post with ↗: an available post title (Reddit places r/subname beside the author below the title), otherwise View reel on Instagram, View post on Instagram, View tweet on Twitter, or the matching platform/type label. Native YouTube and Amazon cards keep Discord/site-supplied clickable titles; the bot cannot rewrite their internal title or append an arrow without replacing the native preview.

Custom cards use linked titles using Discord’s smallest heading style and a bold display name followed by a plain @handle when supplied. Reddit uses a title alone, then bold r/subreddit and a plain u/username. Handles do not ping Discord users. Missing author data is omitted, not guessed. Native player interiors remain controlled by Discord; a custom title/author companion is added separately. The sender’s exact text and URL remain above the preview; expansion and tracker cleanup select preview URLs without rewriting that source. Unavailable media uses “Media preview unavailable.”; untitled cards use a View post/reel on Platform ↗ link.

Facebook policy: single photo/post messages can reuse an image from Discord’s matching native preview, checked for up to six seconds. Missing images and mixed messages keep their original native preview. Reels receive only “Facebook reel preview unavailable. Open the link above to watch.” beneath the exact original message. No direct Facebook metadata request is made; the bot reads Discord message embeds only.


Reddit video posts require playable media from the approved helper. A bare v.redd.it URL returned as description is not playable media; when no image/video is supplied but a valid v.redd.it address is available, the card offers “View video on Reddit ↗” instead. Other missing media still shows “Media preview unavailable.” Reddit authors use u/username.


Reddit website-only posts use a compact card with the clickable destination URL (without an arrow) and no thumbnail gallery.


Facebook photo URLs omit the album-context set parameter when reposted, while preserving fbid and message prose. This is an explicit exception to exact source URL preservation. If no native image metadata is available, a cleaned Facebook photo URL uses Discord’s native preview instead of a custom card.


All 21 configured platforms use custom cards or custom companion sections. Native-mode sources stay untouched to preserve working players. YouTube and Vimeo use public official oEmbed title/author metadata; Amazon, iFunny, GIPHY and Tenor attempt bounded public page metadata and fall back to a linked card when unavailable. No private content, cookies, access-gate bypasses, paid APIs, or invented author data are used. Facebook retains its specific reel notice and native-image-reuse rules. Custom presentation does not guarantee media availability.

Public alpha runtime: leave TEST_GUILD_ID and TEST_CHANNEL_IDS empty to operate across installed servers. Effective Discord channel permissions remain required. REPOST_AS_AUTHOR=yes permits eligible reposts only where Manage Messages, Manage Webhooks, Read Message History and preview permissions are granted; otherwise ordinary previews preserve originals. The management command is registered globally for servers. Live verification is performed in the existing test channel, not in unrelated servers.
