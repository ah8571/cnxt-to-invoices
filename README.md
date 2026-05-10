# cnxt to invoices

A free, open-source invoice generator for independent contractors and small businesses. Part of the [cnxt](https://cnxt.to) ecosystem — a suite of tools built for people who work for themselves.

No subscriptions. No watermarks. No account required to get started. Just fill in your details, preview your invoice live, and download it as a PDF.

Licensed under the [GNU General Public License v3.0](LICENSE) — free to use, free to modify, free to share.

---

## What it does

- Create professional invoices in seconds
- Live preview as you type
- Download as a PDF on any device (desktop or mobile)
- Add your logo, business details, client info, line items, tax, and discount
- Save drafts and access previous invoices across devices when signed in
- Business info saved to your account so you never have to retype it

## How it works

This is a static web app — no server, no build step. It runs entirely in the browser. When you sign in, your data syncs to [Supabase](https://supabase.com) so you can pick up where you left off on any device.

Authentication is shared across all cnxt products. One account, all the tools.

## Part of the cnxt ecosystem

cnxt is a collection of independent tools for contractors, freelancers, and small business owners:

- **cnxt to invoices** — this app
- **cnxt to links** — a link-in-bio profile page (like Linktree but yours)
- **cnxt to hire** — coming soon

Each tool works standalone, but they share the same login. The goal is a lightweight, open alternative to the big SaaS platforms — built in public, licensed openly, and designed to stay free.

## Getting started

1. Visit [invoices.cnxt.to](https://invoices.cnxt.to) to use it immediately — no account needed
2. Create an account to save drafts and sync invoices across devices
3. Fill in your business info once and it loads automatically every time

## Self-hosting / contributing

This project has no build step. Clone the repo and open `index.html` in a browser.

To enable account features you need a [Supabase](https://supabase.com) project:

1. Create a free Supabase project
2. Run `supabase/setup.sql` in the SQL editor
3. Fill in your project URL and anon key in `js/supabase-config.js`

Contributions welcome. See [LICENSE](LICENSE) for terms.
