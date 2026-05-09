# Mobile MVP

This is a simple Expo React Native scaffold for the cnxt to invoices mobile app.

## What is included

- Create invoice flow with business, client, and line item fields
- Local draft autosave for the in-progress invoice
- Saved drafts tab stored on-device with AsyncStorage
- Account tab reserved for Supabase auth and sync

## Run locally

```bash
cd mobile
npm install
npm start
```

## Next integration step

Wire the same Supabase project used by the web app into the Account tab, then sync device drafts to `invoice_drafts` and finalized invoices to `invoices`.
