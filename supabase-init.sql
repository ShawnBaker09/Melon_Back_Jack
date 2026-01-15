-- Supabase initialization for Melon_Back_Jack
-- Run this in the Supabase SQL editor (Project -> SQL) to create tables and public policies

-- Create rooms table
CREATE TABLE IF NOT EXISTS public.rooms (
  id text PRIMARY KEY,
  host text
);

-- Create players table
CREATE TABLE IF NOT EXISTS public.players (
  id bigserial PRIMARY KEY,
  room_id text REFERENCES public.rooms(id) ON DELETE CASCADE,
  name text
);

-- Enable Row Level Security and create permissive public policies for testing
-- NOTE: For production, tighten these policies appropriately.

ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_select_rooms" ON public.rooms FOR SELECT USING (true);
CREATE POLICY "public_insert_rooms" ON public.rooms FOR INSERT WITH CHECK (true);

ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_select_players" ON public.players FOR SELECT USING (true);
CREATE POLICY "public_insert_players" ON public.players FOR INSERT WITH CHECK (true);

-- Optionally enable realtime on players in Supabase UI for subscriptions.
