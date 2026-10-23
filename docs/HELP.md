# Link Embedder Alpha help



Public alpha: anyone with permission to install apps can add Link Embedder to a server. Give it the required permissions in every channel where you want it to work. The hosted bot uses replacement-only behavior for eligible new messages; installation does not grant every required channel permission.

## Sharing links

Post a supported public HTTPS link in a text channel, voice-channel text chat, or active public thread under a text, forum, or media channel. Your surrounding text is preserved. Known tracking parameters are cleaned on supported routes, while functional IDs and playback parameters are retained. Wrap links in angle brackets, spoilers, or code to suppress previews. Message-level embed suppression is respected.

If the bot cannot safely replace a message, it leaves the original without sending a separate preview. Attachments, polls, pinned messages, thread starters, and other ineligible message types are left alone. Private, archived, locked, and announcement threads are excluded. Same-channel and same-thread replies show a small reply-context line above your text: a bold author mention followed by a clickable excerpt of up to 100 Unicode characters, plus an ellipsis when needed. The excerpt links to the exact reply target; spoiler text and empty messages use a neutral “message” link. The author mention opens their profile and permits a notification on initial posting. Edits and NSFW updates do not notify them again. This is a linked reference, not a native Discord reply; the link stops working if its target is later deleted. Existing posts are not updated or backfilled.

## Channel permissions

Replacement requires View Channel, Send Messages, Embed Links, Read Message History, Manage Messages, and Manage Webhooks. Threads additionally require Send Messages in Threads, with View Channel and Manage Webhooks on their parent channel. The installation link requests these seven permissions. Existing installations and channel overrides may need administrator updates. Administrator is not required. Permissions are checked for every event; the bot never escalates them itself.

Production scope uses empty `TEST_GUILD_ID` and `TEST_CHANNEL_IDS`. Optional test scope and legacy test aliases remain supported. Replacement accepts eligible messages in text channels, voice-channel text chats, and active public threads under text, forum, and media channels. Same-channel and same-thread replies show a bold author mention and a short excerpt linked to the original message; inaccessible or cross-channel references are left untouched. Attachments, polls, pinned messages, messages that start threads or contain reactions/components, and unsupported channel types are left alone. DMs, bots, webhooks, system messages, and suppressed previews are ignored. Age-restricted channel labels do not classify media or guarantee safe previews. A user’s message can reopen an unlocked archived thread; the bot then checks its current active state. It does not explicitly join, unlock, or unarchive threads.

`PREVIEWS_DISABLED=yes` stops previews. The deprecated `REQUIRE_VERIFIED_SAFE_CONTENT=yes` alias also shuts down processing; it is not a content classifier. No automatic permission changes or first-use notices are implemented.

## Supported previews

All supported cards must use our shared layout.

With `REPOST_AS_AUTHOR=yes`, eligible messages are replaced through an author-style webhook. The replacement must be confirmed before deleting the original. If replacement is unavailable, the bot does not send a separate reply. Network ambiguity is handled conservatively to avoid deleting the only confirmed copy. Discord shows the APP badge. No extra “Reposted by Link Embedder” line is appended.

User prose is preserved. Known tracking parameters are removed from visible supported-card links while functional parameters are retained. Preview URLs may be canonicalized independently. Recognized content routes retain their required selectors; unresolved redirects, access parameters, and signed media are handled conservatively.

| Site | Preview approach |
| --- | --- |
| Amazon | Public metadata |
| Bluesky | [fxbsky.app](https://github.com/FxEmbed/FxEmbed) |
| Facebook | [facebed.com](https://github.com/facebed/facebed) and public metadata |
| Instagram | [oginstagram.com](https://github.com/seirenkr/OGInstagram) |
| Pinterest | Public metadata |
| Reddit | [vxreddit.com](https://github.com/dylanpdx/vxReddit) |
| Snapchat | Public metadata |
| ✅ Threads | [fzthreads.com](https://github.com/AvianJay/fzthreads) |
| TikTok | [tnktok.com](https://github.com/okdargy/fxTikTok) |
| Twitter (X) | [fxtwitter.com](https://github.com/FxEmbed/FxEmbed) |
| ✅ UpScrolled | Public metadata |

Amazon preview details: Available public/native title, description, and image; store only if verified. Resolved Amazon short shares display the clean product URL. Native preview metadata is associated only through a validated same-platform redirect and can fill missing product fields; unavailable metadata still produces an honest fallback. Representative Amazon short-share and direct-product QA passed for B08KTZ8249: clean visible and card-target product URLs, title and image, with UTM and empty ltclid removed from the resolved short share. This does not establish every product or actual Android/iOS app provenance. Amazon previews with generic titles or missing product fields get up to two refreshes (after one and two seconds). Useful images and real titles are retained across refreshes; incomplete upstream data can still produce a simpler card. Canonical Amazon metadata can use one exact same-host 301 redirect from /dp/ASIN to /clp/the-same-ASIN, with matching canonical identity and a real product title. The existing eight-second and 512 KiB limits remain; further redirects, challenge responses, and generic-shell images are rejected. Displayed product links stay /dp/. Fresh test1 verification for B08KTZ8249 confirmed a real Kindle Paperwhite title and actual product photos after a verified restart, with a clean /dp/ link and UTM parameters removed. Amazon representative QA is complete: the user accepted the fresh test2 examples. This is not a guarantee for every Amazon product or marketplace, and real-device Android/iOS provenance was not established. Product metadata remains dependent on public availability; store names are never guessed.

Operator-level `PROVIDER_SHARING_APPROVED=yes` enables the six documented helpers after approval of the recipients in [PRIVACY.md](PRIVACY.md). Installers should see the privacy/help disclosure. Platform overrides use `PLATFORM_MODE=card|native|off|<listed helper>`. Native-only modes other than Amazon are left untouched in replacement mode. Legacy reply mode remains available in code but is not the requested replacement-only deployment behavior.



Facebook public photo, video, Reel, and post cards use Facebed and public metadata. Generic login or unavailable responses leave the original message untouched. No Facebook login is used. Captions and post text preserve the first 300 Unicode code points, with an ellipsis only when longer. Normal post text appears above images; photo, video, and Reel captions appear below media. Required content IDs and signed media URLs are preserved while optional tracking is removed. Unknown author handles are omitted rather than guessed.

Reddit website-only posts show the actual clickable destination URL without an arrow or thumbnail gallery. Crossposts can reuse the original video through the approved Reddit helper while retaining crosspost attribution. A link to the video page is shown when playable media cannot be obtained. Availability of Reddit video playback is not guaranteed.

Reddit representative QA is complete for the current alpha: text/self posts, external website links, single images, two-image galleries, native video/GIF, crosspost video playback, redd.it links, modern /s/ shares, and word-safe title truncation have been checked. Supported repost URLs remove nonempty utm_* query keys case-insensitively. Visible short-link formats are intentionally retained; card destinations resolve to canonical post URLs when available. This is not universal Reddit compatibility: m.reddit.com, comment-specific URLs, and app deep links are unsupported; visible fragments remain, and Android/iOS share variants were tested synthetically rather than on real devices. Provider availability can change.



## Card layout

Unavailable-preview notices use one short sentence without extra instructions to open the link. Custom cards use bold linked titles in regular card text, no decorative title arrows, a small gap below the title, and a divider above the footer. Cards prefer the original title when available. Examples include Instagram post, Twitter post, and Bluesky post cards, with specific types such as Instagram Reel, Snapchat Story, and Snapchat Spotlight. Platform colors identify the card; Instagram uses #E1306C. Discord controls final media sizing; there is no supported arbitrary width/height setting.

Display names are bold and handles are plain, without mentions. Reddit uses a bold r/subreddit beside a plain u/username below the title. Missing author data is omitted. Cards omit engagement counts, dates, author portraits, and provider buttons. The platform footer includes a fixed-label Link Embedder profile hyperlink rather than a mention; the visible name does not depend on Discord resolving a user in forwarded messages. Profile navigation still depends on the Discord client.

Bluesky uses the same card layout as Twitter: a linked post title, bold display name with plain handle, full main text before the media gallery, text-only quotes below media showing up to 300 Unicode characters, followed by an ellipsis only when longer, and the platform footer. No author avatar, engagement counts, or extra action buttons are added. Main videos may use the approved helper’s pds-cache.fxbsky.app public DID/CID route; Discord retrieves that media. This does not guarantee playback or reproduce Twitter-only features such as Spaces.

Bluesky representative live QA is complete: text with UTM query cleanup, one-image posts, a five-image gallery, main-video playback controls, and text-only quote layout were checked after deployment. The main video changed from Play to Pause with playback controls visible; this is not an audio or universal-playback guarantee. An external-link post displayed text and a thumbnail, but its separate outbound destination was not verified. Provider availability and Discord rendering still vary.

Instagram accepts canonical and username-prefixed post/reel links, legacy TV links, and carousel slide selection. Instagram profile links are left untouched. Individual Story links and highlights receive linked unavailable cards without helper requests or login access. Instagram audio pages and account Stories pages are ignored.

Media normally appears above the caption. Captions show the first 300 Unicode characters, with an ellipsis appended only when longer. Twitter, Threads, and Bluesky use full main-post text above any available media; supplied quoted text is indented below the media and limited to the first 300 Unicode characters, with an ellipsis appended only when longer. No separate quote link is added. A linked Space section may appear inside a Twitter post; direct Spaces and Lists have linked resource cards. Twitter Community links are left untouched. Their titles, availability, and audio are not invented. Threads without usable metadata uses a linked unavailable-card layout. The total Discord text budget can still prevent creation of an oversized custom card.

## Manage a repost

Use **⋯** beside a new custom card’s title, or open the recorded repost’s **Apps → Manage Post** command. The private panel shows action buttons without a heading. The controls apply to the whole repost, including posts containing several cards. Existing messages are not bulk updated. **Mark NSFW** is blue and available to anyone with channel access. **Delete Post** is red and only shown to the original sender; ownership is checked again before deletion. There is no custom Dismiss button, first-use channel notice, or DM.

Mark NSFW adds spoilers to supported custom-card media, not captions or links, and does not age-restrict the channel. Native previews are not covered by that control. Deleting removes the repost and does not restore the original. Unrecorded originals, old companion replies, and reposts without ownership records cannot be managed through the command.

## Troubleshooting and privacy

If nothing happens, check effective channel permissions, message eligibility, suppression, and provider availability. Cooldowns can skip rapid posts. This website is not a live uptime monitor. Missing or login-restricted media may show a linked unavailable card; the bot never bypasses access restrictions.

Ownership records contain IDs, not message bodies or tokens. Old unrecorded reposts need moderator help. See [Privacy](../src/website/pages/privacy.html) for retention and provider details, and [Contact](../src/website/pages/contact/contact.html) for support. Do not send tokens, private links, or other secrets.

### Provider behavior


Pinterest uses the shared large-image card, red accent, linked pin title, and standard attribution/footer. Only pinterest.com/pin/numeric-ID URLs are supported. Public HTML requests retain the eight-second/512 KiB bounds and reject redirects; matching Discord previews can supply allowed i.pinimg.com images. Private or unavailable pins show a fallback. Pin.it, boards, profiles, and video playback are not supported. Local implementation is awaiting live verification.


## Design your previews — detailed reference

Open the [visual playground](https://hayness666.github.io/link-embedder/playground.html) to edit a basic card, add/remove/reorder fields, try a local image, and export a draft or Discord embed JSON. It is a mockup, not a live Discord connection. Exports do not change the bot. Custom media layouts live in `src/simple-cards.js` and `src/providers/instagram.js and src/card-format.js`; brand colors/logos are in `src/platform-brands.js`. `src/previews.js` handles native/mixed fallbacks. The playground exports legacy embed drafts, not Components V2 production cards.


## Behavior and providers — detailed reference

Reddit website-only posts show the actual clickable destination URL without an arrow or thumbnail gallery. Crossposts can reuse the original video through the approved Reddit helper while preserving the crosspost title and attribution. When playable media cannot be obtained, a link to the video page is shown. Availability of Reddit video playback is not guaranteed.


## Managing reposts — detailed reference

Ownership is stored in `data/repost-owners.json` as repost, original-author, server, channel, and webhook IDs only. No message text or webhook tokens are stored. Writes are atomic and complete before deleting the original. Keep this directory on persistent host storage and back it up privately; never commit it. Records remain until managed deletion, rollback, or an operator-verified deletion request. A missing record denies management; a corrupt store stops startup. Capacity is 10,000 records; reaching it preserves originals instead of silently evicting owners.


## Privacy and resource limits — detailed reference

See [PRIVACY.md](PRIVACY.md) and [HELP.md](HELP.md) for publishable copy. No message-body/URL/token logging. Repost ownership IDs persist locally as described below. Message caching is disabled. Guild-scoped in-memory message IDs expire after ten minutes (max 1,000 per guild), channel cooldowns after three seconds, and burst timestamps after one minute. Idle guild state expires after ten minutes when another event is processed. Global state is capped at 10,000 guilds; additional uncached guilds are skipped while the cap is full. These controls are isolated between servers.

Up to three distinct supported links per message, one response per channel per three seconds, and twenty responses per server per minute. Excess messages are skipped rather than queued. State resets on restart; run one process. No historical backfill, message-edit handling, or deletion synchronization. Gateway/SDK keeps operational guild/channel/member metadata in memory; this is not a promise of zero data processing. Bot responses remain in Discord until deleted.

HTTPS and exact-host checks reject credentials, all explicit ports, encoded host tricks, and unknown hosts. Known trackers are removed from generated links, including helper fallbacks. Platform canonicalization preserves content IDs, Facebook story/photo IDs, and Instagram image selection. Recognized short links for Amazon, TikTok, Instagram, Facebook, Reddit, and Twitter can expand through up to four HTTPS redirects within six seconds. Reddit compact /comments/ID destinations are recognized. If a Reddit share redirect is unavailable, a matching Discord native preview can supply its post ID from an exact share.redd.it preview URL. Conflicting preview IDs leave the share link unchanged. Crosspost video redirects can supply parent media while preserving the shared post’s attribution. Long card titles end at a word boundary with an ellipsis. Only known same-platform routes are followed; unresolved links stay unchanged. No cookies, login access, or JavaScript challenges are used.


## Provider availability — detailed reference

Public helpers and media URLs can fail or expire. Initial metadata failure uses an honest linked fallback where supported. There is no delayed backup timer removing working previews. No cookies, private-content access, login-gate bypasses, paid APIs, or guessed metadata are used. Unapproved media redirects are not followed.


## Sources

[Discord permissions](https://docs.discord.com/developers/topics/permissions), [Message Content intent](https://docs.discord.com/developers/events/gateway), [June 2026 intent review rules](https://support-dev.discord.com/hc/en-us/articles/40281523410967-Changes-to-Privileged-Intent-Access-for-Discord-Apps), [OGInstagram](https://github.com/seirenkr/OGInstagram), [fxTikTok](https://github.com/okdargy/fxTikTok), [FxEmbed](https://github.com/FxEmbed/FxEmbed), [vxReddit](https://github.com/dylanpdx/vxReddit), [Amazon ASIN](https://sell.amazon.com/blog/what-is-an-asin).

## Editing reposts

The original poster can open ⋯ → Edit Post, or Apps → Manage Post → Edit Post, change text or supported links, and save the same repost. Edit is hidden from other users and ownership is checked again on submission. Text-only edits preserve previews; changed links rebuild supported previews. Spoiler media and existing attachments are retained, and mentions are suppressed. Unavailable previews, incompatible native/custom format changes, or stale forms leave the existing post unchanged. Forms expire after ten minutes or a restart; reopen Manage Post. Older untracked reposts cannot be edited. No message bodies are persisted; the current repost supplies the form text.

## Pinterest attribution and Snapchat

Pinterest pin 155303888141933052 passed live large-image and visible tracking-cleanup verification. Linked handles are now derived only from a validated Pinterest author profile URL in matching metadata; unknown handles are omitted. This handle addition awaits deployment.

Snapchat Spotlight cards support public token routes, optionally prefixed by @username. Public Open Graph metadata must identify the same Spotlight and advertise an MP4 on the exact bolt-gcdn.sc-cdn.net host and /u/ path. Existing eight-second/512 KiB limits remain. The public red-panda Spotlight sample passed live custom-card QA with its author and description, Play/Download controls, and observed video playback. This verifies that sample, not every Spotlight or device. Profiles, private stories, and unrecognized short links remain unsupported.



## Preview sources at a glance

The original site is the source unless a third-party helper is named.

| Site | Source and rendering |
| --- | --- |
| Amazon | Public metadata |
| Bluesky | [fxbsky.app](https://github.com/FxEmbed/FxEmbed) |
| Facebook | [facebed.com](https://github.com/facebed/facebed) and public metadata |
| Instagram | [oginstagram.com](https://github.com/seirenkr/OGInstagram) |
| Pinterest | Public metadata |
| Reddit | [vxreddit.com](https://github.com/dylanpdx/vxReddit) |
| Snapchat | Public metadata |
| ✅ Threads | [fzthreads.com](https://github.com/AvianJay/fzthreads) |
| TikTok | [tnktok.com](https://github.com/okdargy/fxTikTok) |
| Twitter (X) | [fxtwitter.com](https://github.com/FxEmbed/FxEmbed) |
| ✅ UpScrolled | Public metadata |

## Detailed route limits

Content availability varies; these limits do not indicate a different card layout. UpScrolled uses public structured post data with allowlisted images and video posters; in-card video playback is unavailable. Missing metadata can produce a linked unavailable notice.

- **Instagram Reels/posts:** Basic link card. `oginstagram` → oginstagram.com; preserves carousel selection
- **TikTok video/photo:** Basic link card. `fxtiktok` → tnktok.com; canonical content links, including username-free share targets; unresolved tiktok.com/t/ shares receive an unavailable card; other unresolved or homepage-only links stay untouched; generic marketing/login metadata is rejected and private slideshow media is not fetched
- **Twitter posts:** Basic link card. `fxembed` → fxtwitter.com
- **Bluesky posts:** Basic link card. `fxembed` → fxbsky.app
- **Reddit posts:** Basic link card. `vxreddit` → vxreddit.com; upstream can be fragile
- **Amazon:** Custom product card in replacement mode. Public metadata; availability varies
- **Facebook:** Approved Facebed photo, video, Reel, and post previews use verified public metadata. Optional public author lookups omit unavailable handles and preserve useful media.
- **UpScrolled public posts:** Shared text-first cards for canonical posts and validated same-post share redirects; video posters link through the normal title or source URL.
- **Snapchat:** Cards for public Spotlight and Stories. Representative Spotlight and individual Story video/photo samples passed live QA; 8 MiB attachment limit.
- **Pinterest:** Custom image card. Public metadata or exact Discord preview; no short links
- **Twitter Spaces / Lists:** Linked resource card. Matching Discord metadata when available; no audio player or private membership access
- **Threads public posts:** Custom card. `fzthreads` → fzthreads.com after approval; public text and allowlisted photos/video when supplied. Spoiler/private responses and failures use a linked fallback.

Spotlight videos are downloaded only from the validated Snapchat CDN, with no redirects, an eight-second timeout, MP4 signature validation, and an aggregate 8 MiB attachment limit. They are uploaded as named MP4 attachments; Attach Files permission is required. Failed downloads leave a text fallback, and failed reposts preserve the original. The tested public Spotlight sample passed live playback verification; this does not guarantee every post or device.

Public individual Story video and photo samples passed live Discord QA, alongside a fresh Spotlight sample. Saved Story collections have local test coverage but have not been verified live. Individual links select only their exact Snap; saved Stories show up to ten Snaps in one card, with a count and full-Story link when more exist. Validated Story HTML has a 2 MiB decompressed limit; Spotlight and other providers retain 512 KiB. Eight-second request timeouts and an aggregate 8 MiB attachment budget remain. Private, expired, mismatched, unsupported-overlay, or unavailable content does not yield a media gallery.

Cards share small spacing after the title and one visible divider immediately above the footer, after media, captions, and any quote or Story count.

Threads quotes use the verified display name and handle when available. Self-quotes reuse the name only for a matching identity; other authors may use one bounded fzthreads.com profile lookup. Missing or mismatched names retain a generic quoted-post label. Representative self-quotes and different-author quotes passed live QA; the separate global clickable-link update passed live QA.

Recognized content links retain only functional parameters in the displayed URL and card target, such as Instagram carousel selection and Facebook content IDs. Unresolved short links are preserved until their destination is known. Signed media URLs are not modified. Representative displayed-link and target cleanup passed live QA.

URLs in post text, captions, and quotes are rendered as clickable links with visible destinations. Known tracking is removed where safe; signed URLs retain their parameters. A URL cut off by the 300-character caption or quote limit stays unlinked. The NASA external link passed live clickability verification, and its literal hyphen was preserved.

Threads representative QA is complete for text, single images, galleries, video, self-quotes, quotes of another author, long replies with links, short post routes, and tracking cleanup. These examples do not establish every mobile app sharing format or distinct plain-repost support. Global clickable-link verification passed.

Threads representative text, single-image, gallery, video, self-quote, different-author quote, long-reply, short-route, and tracking-cleanup examples passed live QA. This does not establish every mobile app sharing format or distinct plain-repost support. The separate global clickable-source-link update passed live QA.

UpScrolled’s public text and video-poster examples passed live Discord QA. Cards show the display name, handle, full text, icon, and shared layout. Video opens through the normal linked title or source URL; the card has no in-card video player or extra video CTA. Real quote-post metadata and additional media formats remain unverified.

Threads omits the helper-generated leading reply annotation, matching Twitter and Bluesky. Its removal passed live QA; ordinary post text and genuine quotes remain unchanged.

Facebook handle enrichment is optional and bounded to 1.5 seconds. It requires matching public content and owner metadata; access challenges are not followed. Successful lookups cache in memory for five minutes, failures for 30 seconds, with a maximum of 128 entries. Lookup failure preserves the useful Facebed card. The host video sample resolved a handle; the photo sample remained blocked. Text-only cards and revised post ordering have local test coverage; final deployment verification is pending.

Server administrators can use `/permissions` to check the bot’s effective permissions in the current channel or choose another channel they can manage. Results are private; the command never changes roles or channel permissions.
