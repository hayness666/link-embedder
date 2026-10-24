# Architecture

Bot modules live directly in `src/`. `simple-cards.js` shares layout and metadata handling across most supported sites. Instagram has specialized fetching and card handling in `providers/instagram.js`; `providers/facebook.js` handles its distinct native-preview path. Shared text/title formatting lives in `card-format.js`. Adapters, URL recognition, branding, and tracking cleanup are shared modules. Dedicated files reflect special behavior, not a requirement for one file per site.

`src/website/` contains static HTML, CSS, browser JavaScript, and images. Its JavaScript powers interactive features such as the contact form; static policy pages do not need separate scripts.

Written guides live in `docs/`. The root `index.js` and package scripts retain the existing bot startup paths. Website publication does not deploy or restart the bot.

Shared website styles live in `src/website/styles.css`. The build retains the existing public `style.css` URL.

Tests are grouped under `test/cards/`, `test/providers/`, and `test/core/`; `npm test` discovers all groups.

Shared routing (`adapters.js`, `urls.js`, `short-links.js`) stays at the bot module level because it serves multiple platforms.

The website entry page stays at `src/website/index.html`; other standalone HTML pages live in `src/website/pages/`. The build publishes those pages at their existing root URLs.

CSS uses pinned Stylelint and Prettier development tools. Run `npm run format:css` to format styles, then `npm run lint:css` and `npm run format:check`. The Pages workflow requires both checks before publishing. These scripts target only website CSS.

Contact HTML and browser JavaScript live together in `src/website/pages/contact/`. Shared `styles.css` sits beside `index.html`; the build keeps the public `style.css` filename.

Threads support does not cover every mobile sharing format or guarantee previews for plain reposts.
