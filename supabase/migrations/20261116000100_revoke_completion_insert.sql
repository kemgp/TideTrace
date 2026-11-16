-- Phase A step 7: lesson completion is written only by public.complete_tide (security definer), which also issues the
-- Tide Energy award in the same transaction. Close the direct insert path so nothing can record a completion without it.
-- Apply after 20261110000100_tide_energy.sql, and only once the API calling PUT /api/tides/:id/completion
-- (which calls complete_tide) is live everywhere. Safe to run again.
begin;
drop policy if exists completions_insert on public.tide_completions;
revoke insert on public.tide_completions from public, anon, authenticated;
revoke insert (user_id, tide_id, completed_at) on public.tide_completions from public, anon, authenticated;
-- Reads stay as they were: members read their own completions through completions_read.
commit;
