-- Opcional: úsalo solo si el chat muestra aviso de que no puede guardar en Supabase.
-- Permite que cada usuario autenticado vea y escriba solo su propia conversación.

alter table public.conversations enable row level security;
alter table public.messages enable row level security;

drop policy if exists "customers can read own conversations" on public.conversations;
create policy "customers can read own conversations"
on public.conversations for select
to authenticated
using (customer_id = auth.uid());

drop policy if exists "customers can create own conversations" on public.conversations;
create policy "customers can create own conversations"
on public.conversations for insert
to authenticated
with check (customer_id = auth.uid());

drop policy if exists "customers can update own conversations" on public.conversations;
create policy "customers can update own conversations"
on public.conversations for update
to authenticated
using (customer_id = auth.uid())
with check (customer_id = auth.uid());

drop policy if exists "customers can read own messages" on public.messages;
create policy "customers can read own messages"
on public.messages for select
to authenticated
using (
  exists (
    select 1 from public.conversations c
    where c.id = messages.conversation_id
    and c.customer_id = auth.uid()
  )
);

drop policy if exists "customers can create messages in own conversations" on public.messages;
create policy "customers can create messages in own conversations"
on public.messages for insert
to authenticated
with check (
  exists (
    select 1 from public.conversations c
    where c.id = messages.conversation_id
    and c.customer_id = auth.uid()
  )
);
