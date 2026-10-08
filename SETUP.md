# Operator setup

Prelaunch: the bot remains offline. Node.js 24.17+ is required. Install with `npm ci --ignore-scripts`, then run `npm test` and `npm run check`.

1. Read the provider recipients and processing details in [the privacy policy](docs/privacy.html). External helper activation requires operator approval; native/basic cards remain available without it.
2. Configure only View Channel, Send Messages, Embed Links and Send Messages in Threads. Enable Message Content intent; do not request Administrator or member/presence intents.
3. Store an approved bot token using the selected host’s secret mechanism. Never commit it or paste it into chat, logs, screenshots or command history. `.env.example` contains placeholders only.
4. Choose an always-on host and approve runtime startup. Configure `TEST_GUILD_ID` and optional `TEST_CHANNEL_IDS` with your own test identifiers before a pilot.
5. With posting authorization, check permitted and restricted channels, threads, native cards and approved helpers on desktop/mobile. Unit tests do not prove playable embeds.

GitHub Pages serves only the static `docs/` folder; it does not run the Discord bot. Publish from `main` / `docs` for this repository. Verify the new policy URLs before replacing the existing links in Discord.

Project code and documentation use the MIT License. Third-party dependencies retain their own licenses.
