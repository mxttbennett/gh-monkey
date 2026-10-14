# gh-monkey

Tampermonkey userscript that switches GitHub accounts automatically based on URL rules. Port of the "GitHub Account Switcher" browser extension.

## Install

Open `github-account-switcher.user.js` in raw view; Tampermonkey offers to install it.

## Use

- Tampermonkey menu → **Settings…** edits the default account and rules (first match wins).
- Rule types: `org`, `page_id`, `path_prefix`, `regex`.
- The menu also lists **Switch to <login>** for each signed-in account.
