# gh-monkey

Tampermonkey userscript that switches GitHub accounts automatically based on URL rules. Port of the "GitHub Account Switcher" browser extension.

## Install

[**Install**](https://raw.githubusercontent.com/mxttbennett/gh-monkey/main/github-account-switcher.user.js) with Tampermonkey (or any userscript manager). It updates itself from this repo when the `@version` is bumped.

## Set up

On the first GitHub page you open after installing, a setup dialog appears. Add rules saying which account each URL should use; nothing switches until you do.

Reopen it any time from the Tampermonkey menu → **GitHub Account Switcher → Settings…** (the menu also lists **Switch to <login>** for each signed-in account).

To copy your setup to a second browser profile, click **Export…** in Settings there, then **Import…** in the other profile and pick the file. Importing replaces that profile's rules and default account.

Rules are checked top to bottom; the first match wins:

| Type | Matches |
| --- | --- |
| `org` | the owner in the URL, e.g. `my-company` for `github.com/my-company/…` and `/orgs/my-company/…` |
| `path_prefix` | URL path starting with the value, e.g. `/my-company/private-repo` |
| `page_id` | the `?page_id=` query parameter |
| `regex` | tested against the full URL |

The default account applies to repo pages no rule matches. Every account you use must already be signed in to GitHub (account menu → Add account).
