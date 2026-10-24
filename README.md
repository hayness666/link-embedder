# Link Embedder

Automatic previews for supported public links in Discord. **Anyone with permission to install apps can add it. Grant the required permissions in every channel where you want it to work.** Preview availability depends on the source platform.

## Install

[Add Link Embedder](https://discord.com/oauth2/authorize?client_id=1557858203897823304&scope=bot&permissions=275414871040&integration_type=0) · [Website](https://hayness666.github.io/link-embedder/) · [Setup](docs/SETUP.md)

After adding the bot, run `/permissions scope:server` for a private server summary, or `/permissions` for one channel. Results are private to the authorized administrator running the command; channel overrides may need adjustment.

Replacement needs View Channel, Send Messages, Embed Links, Read Message History, Manage Messages, and Manage Webhooks. Threads additionally need Send Messages in Threads. **Administrator is not required.** The install link requests these permissions; existing installations and channel overrides may need administrator updates. See [replacement setup](docs/REPOST.md).

Cards work in text channels, voice-channel text chats, and active public threads under text, forum, and media channels. Eligible same-channel and same-thread replies show an italic “Click to see message” link to the original message, with a bold author mention when the human author is verified. Attachments and thread starters stay untouched. Private, archived, locked, and announcement threads are excluded.

The bot confirms a replacement before deleting the original. It preserves surrounding text and removes known link trackers. Discord marks webhook reposts with APP. Unsupported links remain untouched. [Full behavior and limitations](docs/HELP.md).

## Supported links

Cards share a consistent layout. Only recognized public link formats are supported, and media availability varies.

The original site is the source unless a third-party helper is named.

| Links | Preview approach |
| --- | --- |
| ✅ Amazon | Public metadata |
| ✅ Bluesky | [fxbsky.app](https://github.com/FxEmbed/FxEmbed) |
| ✅ Facebook | [facebed.com](https://github.com/facebed/facebed) and public metadata |
| ✅ Instagram | [oginstagram.com](https://github.com/seirenkr/OGInstagram) |
| ✅ Pinterest | Public metadata |
| ✅ Reddit | [vxreddit.com](https://github.com/dylanpdx/vxReddit) |
| ✅ Snapchat | Public metadata |
| ✅ Threads | [fzthreads.com](https://github.com/AvianJay/fzthreads) |
| ✅ TikTok | [tnktok.com](https://github.com/okdargy/fxTikTok) |
| ✅ Twitter | [fxtwitter.com](https://github.com/FxEmbed/FxEmbed) |
| ✅ UpScrolled | Public metadata |

See [HELP](docs/HELP.md) for supported routes and private-content limits.

## Providers and privacy

Optional helpers require operator approval through `PROVIDER_SHARING_APPROVED=yes`. Recipients, per-platform modes, and data handling are documented in [Privacy](src/website/pages/privacy.html) and [HELP](docs/HELP.md). No private-content or login-gate bypass is used. Message bodies and tokens are not logged; author-control IDs persist privately.

## Manage your posts

On new tracked cards, use **⋯** in the top-right corner of the card, or **Apps → Manage Post**, to open its private controls. Original posters can edit or delete tracked reposts, and remove gallery spoilers; anyone with channel access can mark media NSFW. See [editing limits](docs/HELP.md#editing-reposts).

## Get help

[Help](docs/HELP.md) · [Terms](src/website/pages/terms.html) · [Privacy](src/website/pages/privacy.html) · [Contact](src/website/pages/contact/contact.html)

Code and documentation: [MIT License](LICENSE). Third-party content retains its own rights. Provider and Discord references are grouped in [HELP](docs/HELP.md#sources).

## Repository layout

`src/` contains the bot modules and `src/website/` contains the static website. Documentation is in `docs/`. Tests live in `test/`. GitHub Pages deploys `src/website/` through the Pages workflow; public URLs stay unchanged. The root `index.js` remains the hosting entry point.

Threads support does not cover every mobile sharing format or guarantee previews for plain reposts.

Server administrators can use `/permissions` to check the bot’s effective permissions in the current channel or choose another channel they can manage. Use `/permissions scope:server` for a grouped report and `page:2` for the next page. The report covers channels you can view and manage, including accessible active public threads; unavailable and unsupported areas are identified. Results are private; the command never changes roles or channel permissions.
