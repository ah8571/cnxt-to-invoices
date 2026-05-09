# cnxt to invoices

Free invoice creation for the CNXT ecosystem.

## Initial Direction

- Use Supabase Auth as the shared login layer across CNXT apps.
- Keep invoice records, clients, branding presets, and recurring invoice data in Supabase.
- Keep frontend hosting and edge delivery flexible so this product can still be served cheaply.

## Current Scope

This folder currently contains the initial backend planning artifacts for the invoice product:

- a static no-build invoice generator in [index.html](index.html)
- a static auth page in [auth.html](auth.html)
- a Supabase-focused architecture note
- a starter SQL schema for invoice data
- trigger helpers and seed placeholders for Supabase setup

The goal is to support early persistence without overcomplicating the product before the first usable invoice flow exists.

## Quick Start

- Open [index.html](index.html) to use the generator locally.
- Open [auth.html](auth.html) to create or access an account.
- Edit the invoice, preview it live, and print or save to PDF.
- The Expo mobile MVP scaffold lives in [mobile](mobile) and stores drafts on-device for now.
- See [docs/CLOUDFLARE_SUBDOMAIN_SETUP.md](docs/CLOUDFLARE_SUBDOMAIN_SETUP.md) for deploying this app to a Cloudflare-hosted subdomain when your domain was purchased through Namecheap.
- For a brand new Supabase project, run [supabase/001_initial_setup.sql](supabase/001_initial_setup.sql) first. It includes the invoice schema, drafts table, row-level security, update triggers, and auth helper trigger in one file.
- The older split SQL files in [supabase](supabase) are now reference files; use the consolidated setup file for first-time project creation.

## Internal Setup

- Configure the Supabase project URL and anon key in `js/supabase-config.js` before deployment.
- End users should only see email sign-in and sign-up, not project configuration fields.
