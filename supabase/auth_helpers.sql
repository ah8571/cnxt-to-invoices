create or replace function public.handle_new_invoice_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_products (user_id, product_key, status)
  values (new.id, 'invoice', 'active')
  on conflict (user_id, product_key) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_invoice on auth.users;
create trigger on_auth_user_created_invoice
after insert on auth.users
for each row execute function public.handle_new_invoice_user();
