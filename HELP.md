# Link Embedder Alpha help

We know Twitter’s name has legally changed, but we still call it Twitter.

Public alpha: anyone with permission to install apps can add Link Embedder to a server. Give it the required permissions in every channel where you want it to work. The hosted bot uses replacement-only behavior for eligible new messages; installation does not grant every required channel permission.

## Sharing links

Post a supported public HTTPS link in an ordinary text channel. Your surrounding text is preserved. Known tracking parameters are cleaned on supported routes, while functional IDs and playback parameters are retained. Wrap links in angle brackets, spoilers or code to suppress previews. Message-level embed suppression is respected.

If the bot cannot safely replace a message, it leaves the original without sending a separate preview. Attachments, replies, polls, pinned messages and other ineligible message types are left alone. Existing posts are not updated or backfilled.

## Channel permissions

Replacement requires View Channel, Send Messages, Embed Links, Read Message History, Manage Messages and Manage Webhooks. The saved installation link requests basic preview permissions; channel administrators must supply the additional replacement permissions. Administrator is not required. Permissions are checked for every event; the bot never escalates them itself.

Production scope uses empty `TEST_GUILD_ID` and `TEST_CHANNEL_IDS`. Optional test scope and legacy test aliases remain supported. Replacement accepts eligible ordinary guild-text messages; replies, attachments, polls, pinned messages, messages with threads/reactions/components and unsupported channel types are left alone. DMs, bots, webhooks, system messages and suppressed previews are ignored. Age-restricted channel labels do not classify media or guarantee safe previews.

`PREVIEWS_DISABLED=yes` stops previews. The deprecated `REQUIRE_VERIFIED_SAFE_CONTENT=yes` alias also shuts down processing; it is not a content classifier. No automatic permission changes or first-use notices are implemented.

## Supported previews

With `REPOST_AS_AUTHOR=yes`, eligible messages are replaced through an author-style webhook. The replacement must be confirmed before deleting the original. If replacement is unavailable, the bot does not send a separate reply. Network ambiguity is handled conservatively to avoid deleting the only confirmed copy. Discord shows the APP badge. No extra “Reposted by Link Embedder” line is appended.

User prose is preserved. Preview URLs may be canonicalized independently. Explicit visible URL cleanup applies to Facebook photo album context, Netflix, Prime Video, Threads and YouTube tracking parameters. Functional IDs, timestamps and access parameters must not be indiscriminately stripped.

| Platform | Default before provider approval | Approved proxy default / limits |
| --- | --- | --- |
| Instagram Reels/posts | Basic link card | `oginstagram` → oginstagram.com; preserves carousel selection |
| TikTok video/photo | Basic link card | `fxtiktok` → tnktok.com; canonical links only |
| Twitter posts | Basic link card | `fxembed` → fxtwitter.com |
| Bluesky posts | Basic link card | `fxembed` → fxbsky.app |
| Reddit posts | Basic link card | `vxreddit` → vxreddit.com; upstream can be fragile |
| Twitch clips | Basic link card | `fxtwitch` → fxtwitch.seria.moe/clip/…; no streams/VODs |
| Snapchat public links | Basic link card | `snapchatez` → snapchatez.com; Spotlight, public shared moments and profile routes only |
| YouTube videos/Shorts | Tracking cleanup only | Plain-text replacement only when trackers are removed; Discord supplies native previews |
| Amazon products | Custom product card in replacement mode | Available public/native title, description and image; store only if verified |
| Facebook photos / reels | Photos/posts can reuse Discord native images; reels receive an unavailable notice | No Facebook media metadata fetch |
| LinkedIn / UpScrolled public posts | Basic link card | No verified inline video; narrow public URL shapes only |
| RedNote / Xiaohongshu notes | Basic link card | Preserves xsec_token/xsec_source; no verified free URL-proxy route implemented |
| Medal / Streamable / Imgur | Public metadata card | Direct media when public metadata supplies it; full canonical links only |
| iFunny / Vimeo / GIPHY / Tenor | Native cleaned link | Experimental native availability; no private access or extra helper |
| Mastodon | Basic link card | mastodon.social/mastodon.online only; no media proxy until warnings can be preserved |

| Twitter Spaces / Lists / Communities | Linked resource card | Matching Discord metadata when available; no audio player or private membership access |
| Threads public posts | Custom card | `fzthreads` → fzthreads.com after approval; public text and allowlisted photos/video when supplied. Spoiler/private responses and failures use a linked fallback. |
| Netflix / Prime Video | Linked title or storefront card | Matching Discord metadata/image when available; Prime Video titles also use public page metadata; no embedded playback |

Operator-level `PROVIDER_SHARING_APPROVED=yes` enables the eight documented helpers after approval of the recipients in [PRIVACY.md](PRIVACY.md). Installers should see the privacy/help disclosure. Platform overrides use `PLATFORM_MODE=card|native|off|<listed helper>`; Mastodon allows card/off only. Native-only modes other than Amazon are left untouched in replacement mode. Legacy reply mode remains available in code but is not the requested replacement-only deployment behavior.

YouTube cleanup preserves video IDs, timestamps, playlists, fragments and other functional parameters. Already-clean links are untouched. YouTube-containing messages use plain text, no custom card or helper request; Discord controls whether its native player appears.

Facebook custom cards are limited to individual photos, stories, reels, videos and normal posts (including posts within groups). Profiles, pages, group homepages, events, Marketplace listings, albums and video collections are left untouched. Known Facebook short/share links trigger a card only when they resolve to a supported individual content type. Matching Discord metadata supplies useful titles, descriptions and images; generic login previews are discarded. Missing media receives a type-specific unavailable notice. No Facebook login or direct media fetch is used. Photo cleanup removes album `set` while preserving `fbid`. Messages containing Facebook plus another recognized content link remain untouched. Facebook fallbacks say “Photo preview unavailable.” for photos, “Story preview unavailable.” for story/permalink posts, and “Reel preview unavailable.” for reels. Reel cards include the linked Facebook Reel title and standard Facebook footer.

Reddit website-only posts show the actual clickable destination URL without an arrow or thumbnail gallery. When the helper supplies only a v.redd.it address rather than playable media, a link to the video page is shown. Availability of Reddit video playback is not guaranteed.

Netflix and Prime Video cards do not fetch authenticated playback. Prime Video title pages can supply a public title, synopsis and poster after matching the canonical title ID. Storefront links remain storefronts rather than being presented as film titles. Known trackers and handoff parameters such as Netflix `trackId`/`tctx` and Prime Video `xdsso`/`ref_` are removed from visible repost URLs; other parameters are preserved.

## Card layout

Unavailable-preview notices use one short sentence without extra instructions to open the link. Custom cards use bold linked titles in regular card text, no decorative title arrows, a small gap below the title and a divider above the footer. Real titles are preferred; untitled content uses labels such as Instagram Reel, Instagram Post and Post on Twitter. Platform colors identify the card; Instagram uses #E1306C. Discord controls final media sizing; there is no supported arbitrary width/height setting.

Display names are bold and handles are plain, without mentions. Reddit uses a bold r/subreddit beside a plain u/username below the title. Missing author data is omitted. Cards omit engagement counts, dates, author portraits and provider buttons. The platform footer includes a fixed-label Link Embedder profile hyperlink rather than a mention; the visible name does not depend on Discord resolving a user in forwarded messages. Profile navigation still depends on the Discord client.

Instagram accepts canonical and username-prefixed post/reel links, legacy TV links, and carousel slide selection. Stories, highlights, profiles and audio pages receive linked unavailable cards without helper requests or login access.

Media normally appears above the caption. Captions are limited to 250 characters. Twitter, Threads, Bluesky and Mastodon use full main-post text above any available media; supplied quoted text is indented below the media and capped at 250 characters. No separate quote link is added. A linked Space section may appear inside a Twitter post; direct Spaces, Lists and Communities have linked resource cards. Their titles, availability and audio are not invented. Threads without usable metadata uses the same linked unavailable-card layout as Facebook photos. Mastodon remains limited to basic cards until content-warning handling and a media source are verified. The total Discord text budget can still prevent creation of an oversized custom card.

## Manage a repost

Open a recorded repost’s options, then Apps and the Link Embedder management command. Choose **Manage Post**. The private menu contains only **MANAGE YOUR POST** and its buttons. **Mark NSFW** is blue and available to anyone with channel access. **Delete Post** is red and only shown to the original sender; ownership is checked again before deletion. There is no custom Dismiss button, first-use channel notice or DM.

Mark NSFW adds spoilers to supported custom-card media, not captions or links, and does not age-restrict the channel. Native previews are not covered by that control. Deleting removes the repost and does not restore the original. Unrecorded originals, old companion replies and reposts without ownership records cannot be managed through the command.

## Troubleshooting and privacy

If nothing happens, check effective channel permissions, message eligibility, suppression, and provider availability. Cooldowns can skip rapid posts. This website is not a live uptime monitor. Missing or login-restricted media may show a linked unavailable card; the bot never bypasses access restrictions.

Ownership records contain IDs, not message bodies or tokens. Old unrecorded reposts need moderator help. See [Privacy](privacy.html) for retention and provider details, and [Contact](contact.html) for support. Do not send tokens, private links or other secrets.
