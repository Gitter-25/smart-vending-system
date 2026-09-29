-- Enable Realtime updates for vending_transactions.
-- Required by the vending simulator so Maya webhook payment
-- confirmations can automatically update the UI.

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'vending_transactions'
  ) then
    alter publication supabase_realtime
      add table public.vending_transactions;
  end if;
end
$$;