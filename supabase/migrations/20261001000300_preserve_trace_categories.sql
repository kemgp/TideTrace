-- Preserve category labels for existing readable Traces after deactivation.
-- The public category selector endpoint still returns active categories only.
alter policy categories_read on public.categories using (
 is_active or private.is_staff() or exists (
  select 1 from public.traces t where t.category_id=categories.id
 )
);
