# Security policy

## The short version

Diviide is a static site. Every page is prerendered, there is no server, no database and no
accounts, and nothing you do in the tool leaves your browser: the color you picked, your recent
icons and your label text live in `localStorage` and are never transmitted.

That design rules out most vulnerability classes outright. The one place untrusted input meets the
code is a bookmark URL's `?icon=` and `?color=` parameters, and both are validated before they go
anywhere: `color` has to match a hex pattern or it falls back to the default, and `icon` is only
ever used as a lookup key against a fixed set of shapes built at compile time. Neither is
interpolated into markup.

## Reporting a vulnerability

If you find something anyway, please report it privately rather than in a public issue.

- Email **hello@divii.de**, or
- Open a [private security advisory](https://github.com/samwilsonme/diviide/security/advisories/new)
  on this repository.

Tell me what you found, how to reproduce it, and what an attacker could do with it. I'll confirm
I've received it within a week. This is a solo side project, so I can't promise a fix window, but
I'll tell you what I plan to do and when. Please give me a fair chance to fix an issue before making
it public.

## What's worth reporting

- Cross-site scripting, if you find a way past the input validation described above, through the
  bookmark URL parameters, the label field, or anything else that reaches the DOM.
- A way to make the tool produce a bookmark URL that navigates somewhere unexpected.
- A supply-chain problem in the dependency tree that affects what ships in `dist/`.

## What isn't

- Infrastructure for the hosted site at divii.de. That's a separate deployment, though you're
  welcome to email the same address about it.
- Missing security headers on a copy of this repo you host yourself. This repo ships no host
  config, by design, so headers are whatever your host sets.
- Automated scanner output with no demonstrated impact.
