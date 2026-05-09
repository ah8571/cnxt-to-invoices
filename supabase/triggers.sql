create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_user_products_updated_at on public.user_products;

drop trigger if exists set_invoice_business_profiles_updated_at on public.invoice_business_profiles;
create trigger set_invoice_business_profiles_updated_at
before update on public.invoice_business_profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_invoice_clients_updated_at on public.invoice_clients;
create trigger set_invoice_clients_updated_at
before update on public.invoice_clients
for each row execute function public.set_updated_at();

drop trigger if exists set_invoices_updated_at on public.invoices;
create trigger set_invoices_updated_at
before update on public.invoices
for each row execute function public.set_updated_at();

drop trigger if exists set_recurring_invoice_templates_updated_at on public.recurring_invoice_templates;
create trigger set_recurring_invoice_templates_updated_at
before update on public.recurring_invoice_templates
for each row execute function public.set_updated_at();
