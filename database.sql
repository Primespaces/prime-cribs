-- ==========================================
-- PRIME CRIBS DATABASE
-- Property listings and approval system
-- ==========================================

-- 1. CREATE PROPERTIES TABLE

create table public.properties (
    id uuid primary key default gen_random_uuid(),

    landlord_id uuid not null references auth.users(id) on delete cascade,

    title text not null,
    location text not null,
    house_type text not null,
    rent numeric(12,2) not null check (rent > 0),
    bedrooms integer not null check (bedrooms >= 0),

    description text,
    photo_url text,
    whatsapp_number text not null,

    is_approved boolean not null default false,

    created_at timestamptz not null default now()
);

-- 2. ENABLE ROW LEVEL SECURITY

alter table public.properties enable row level security;

-- 3. PUBLIC CAN ONLY VIEW APPROVED PROPERTIES

create policy "Public can view approved properties"
on public.properties
for select
to anon, authenticated
using (is_approved = true);

-- 4. LANDLORDS CAN VIEW THEIR OWN SUBMISSIONS,
-- INCLUDING THOSE STILL WAITING FOR APPROVAL

create policy "Landlords can view their own properties"
on public.properties
for select
to authenticated
using (auth.uid() = landlord_id);

-- 5. AUTHENTICATED LANDLORDS CAN SUBMIT PROPERTIES

create policy "Landlords can submit properties"
on public.properties
for insert
to authenticated
with check (
    auth.uid() = landlord_id
    and is_approved = false
);

-- 6. LANDLORDS CAN UPDATE THEIR OWN UNAPPROVED LISTINGS

create policy "Landlords can update their own pending properties"
on public.properties
for update
to authenticated
using (
    auth.uid() = landlord_id
    and is_approved = false
)
with check (
    auth.uid() = landlord_id
    and is_approved = false
);

-- 7. LANDLORDS CAN DELETE THEIR OWN UNAPPROVED LISTINGS

create policy "Landlords can delete their own pending properties"
on public.properties
for delete
to authenticated
using (
    auth.uid() = landlord_id
    and is_approved = false
)