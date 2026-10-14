# gh-monkey

Tampermonkey userscript that switches GitHub accounts automatically based on URL rules. Port of the "GitHub Account Switcher" browser extension.

## Install

[**Install**](https://raw.githubusercontent.com/mxttbennett/gh-monkey/main/github-account-switcher.user.js) with Tampermonkey (or any userscript manager). It updates itself from this repo when the `@version` is bumped.

## Use

- Tampermonkey menu → **Settings…** edits the default account and rules (first match wins).
- Rule types: `org`, `page_id`, `path_prefix`, `regex`.
- The menu also lists **Switch to <login>** for each signed-in account.
