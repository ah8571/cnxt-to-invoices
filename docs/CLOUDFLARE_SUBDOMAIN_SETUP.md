# Cloudflare Subdomain Setup

This guide explains how to put `cnxt-to-invoices` on a subdomain such as `invoices.yourdomain.com` when the domain was originally purchased at Namecheap.

## Short Answer

Buying the domain at Namecheap does not block anything.

What matters is where DNS is managed.

- If Cloudflare is already managing your DNS, you can create and use subdomains there.
- If Namecheap is still managing DNS, you can either move DNS to Cloudflare or keep DNS at Namecheap and point records to Cloudflare where needed.

For this project, the cleanest setup is usually:

- registrar: Namecheap
- DNS: Cloudflare
- app hosting: Cloudflare Pages
- auth and database: Supabase

## Recommended Setup For This Project

Because `cnxt-to-invoices` is a no-build HTML/CSS/JS app, Cloudflare Pages is a good fit.

Recommended URL:

- `invoices.yourdomain.com`

Recommended stack:

- static frontend on Cloudflare Pages
- custom subdomain connected through Cloudflare
- Supabase project for auth and data

## How Namecheap Fits In

Namecheap is just the registrar where you bought the domain.

That means:

- you still own the domain there
- renewals usually still happen there
- you may need to update nameservers there if you want Cloudflare to manage DNS

This is very common. Many people buy domains at Namecheap and use Cloudflare for DNS and hosting.

## Step 1: Check Whether Cloudflare Already Manages DNS

Open Cloudflare and select your main domain.

If you can see:

- the domain dashboard
- the `DNS` tab
- existing DNS records for the domain

then Cloudflare is probably already managing DNS.

If not, you likely still need to add the site to Cloudflare and update the nameservers at Namecheap.

## Step 2: If Needed, Move DNS Control From Namecheap To Cloudflare

Only do this if Cloudflare is not already managing the domain.

In Cloudflare:

1. Add your domain as a site.
2. Let Cloudflare scan existing DNS records.
3. Cloudflare will give you two nameservers.

In Namecheap:

1. Open `Domain List`.
2. Click `Manage` on your domain.
3. Go to the `Nameservers` section.
4. Change from Namecheap default nameservers to `Custom DNS`.
5. Paste the two Cloudflare nameservers.
6. Save.

Then wait for propagation. This can be quick, but sometimes takes a few hours.

Important:

- before switching nameservers, make sure all current DNS records you need are present in Cloudflare
- otherwise email, the main site, or other subdomains can temporarily break

## Step 3: Deploy `cnxt-to-invoices` To Cloudflare Pages

In Cloudflare:

1. Go to `Workers & Pages`.
2. Click `Create`.
3. Choose `Pages`.
4. Connect the GitHub repository, or upload the project manually.

For this project:

- build command: leave blank
- build output directory: the `cnxt-to-invoices` folder

This works because the app is static and the entry file is `index.html`.

## Step 4: Attach A Custom Subdomain

After the Pages project is deployed:

1. Open the Pages project.
2. Go to `Custom domains`.
3. Add a domain such as `invoices.yourdomain.com`.
4. Let Cloudflare create the needed DNS record.

If Cloudflare DNS already manages the zone, this is usually automatic.

## Step 5: Confirm The Subdomain Works

After setup, test:

- `https://invoices.yourdomain.com`

You should see the invoice app load over HTTPS.

## Suggested CNXT Subdomain Pattern

If you want a clean ecosystem structure, something like this works well:

- `yourdomain.com` for the main site
- `invoices.yourdomain.com` for `cnxt-to-invoices`
- `links.yourdomain.com` for `cnxt-to-links`
- `hire.yourdomain.com` for `cnxt-to-hire`

## Supabase Notes

This app still needs the correct Supabase config before production deployment.

Before publishing:

1. create the Supabase project
2. run [supabase/001_initial_setup.sql](../supabase/001_initial_setup.sql)
3. fill in `js/supabase-config.js` with the project URL and anon key
4. verify sign-in, draft save, and invoice save behavior on the deployed subdomain

## Common Beginner Questions

### Do I need to buy a second domain?

No.

If you own `yourdomain.com`, you can create subdomains like:

- `invoices.yourdomain.com`
- `app.yourdomain.com`
- `beta.yourdomain.com`

### Does Namecheap hosting matter?

Only if you are also actively hosting the site there.

If you are using Cloudflare Pages, the important pieces are:

- Namecheap for registration
- Cloudflare for DNS and Pages hosting

### Do I create the DNS record in Namecheap or Cloudflare?

Create it wherever DNS is currently managed.

- if nameservers point to Cloudflare, create it in Cloudflare
- if nameservers still point to Namecheap, create it in Namecheap

For the recommended setup in this project, DNS should live in Cloudflare.

### What if I already have a main website live?

That is fine.

You can keep the main website where it is and only point a subdomain like `invoices.yourdomain.com` to this app.

## Practical Checklist

Use this checklist when you are ready:

1. Confirm whether Cloudflare already manages your DNS.
2. If not, move nameservers from Namecheap to Cloudflare.
3. Deploy `cnxt-to-invoices` to Cloudflare Pages.
4. Add `invoices.yourdomain.com` as a custom domain in Pages.
5. Add Supabase config to the app.
6. Test sign-in, draft saving, invoice saving, and print flow on the live subdomain.

## Good Next Step

If you are doing this for the first time, the lowest-risk path is:

1. get the app working on the default Cloudflare Pages URL first
2. then attach `invoices.yourdomain.com`

That separates deployment problems from DNS problems and makes debugging much easier.