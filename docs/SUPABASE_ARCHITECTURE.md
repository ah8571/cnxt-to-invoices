# Supabase Architecture Notes

## Direction

Use Supabase for the parts of the invoice app that benefit from relational data and shared login:

- shared authentication across CNXT apps
- invoice business profiles
- clients
- invoices
- line items
- saved defaults such as branding, invoice numbering, and payment terms

Keep public delivery and lightweight edge hosting flexible. This product does not need a heavy backend everywhere, but it does benefit from a real database earlier than `cnxt-to-links`.

## What Stays Out of Scope for Now

- advanced accounting workflows
- payment processing
- team roles
- automated reminders
- full hiring platform relationships

## Why This Split Makes Sense

`cnxt-to-links` can remain mostly Cloudflare-native because its public data model is simple and already working.

`cnxt-to-invoice` needs structured persistence sooner because users are likely to want:

- saved invoices
- customer history
- branding presets including logo support
- recurring invoices
- cross-device access

Those requirements are a stronger fit for Supabase than KV or object-only storage.

## Recommended First Phase

1. Use Supabase Auth as the shared identity layer.
2. Store invoice-specific records in Supabase tables with row-level security.
3. Keep product data isolated even if login is shared across apps.
4. Add storage for uploaded logos later through Supabase Storage if needed.

## Practical Rule

- shared login can be ecosystem-wide
- invoice data should remain product-specific
- links profile rendering can stay on Cloudflare unless the current model stops being sufficient
