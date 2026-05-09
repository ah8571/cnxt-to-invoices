insert into public.user_products (user_id, product_key, status)
values
  ('00000000-0000-0000-0000-000000000000', 'invoice', 'active')
on conflict (user_id, product_key) do nothing;

-- Replace the placeholder UUID above with a real auth.users id if you want seed data.
-- The rest of the inserts are intentionally omitted until a real user exists.
