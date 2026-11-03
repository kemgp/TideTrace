-- Optional sample data: a published lesson that shows the chapter reader (needs the 20261105000100 migration). Not a migration; run it once by hand.
-- Images can't be seeded from SQL: open Admin > Tides > this lesson and use "Images in the text" to add some.
insert into public.tides(author_id,title,slug,summary,body,status,paged,category_id)
select
 (select id from public.profiles where role='admin' order by created_at limit 1),
 'Understanding Tides',
 'understanding-tides',
 'What causes tides, how to read them on the shore, and how to record what you see.',
 E'Tides shape every shoreline you will trace. This short lesson walks through what causes them, how to read them on the shore, and how to record what you see.\n\n## Why tides happen\nThe moon''s gravity pulls on the ocean and makes the water bulge on the side facing it. A second bulge forms on the far side of the Earth, so most coasts see **two high tides and two low tides** each day.\n\n- The sun adds a smaller pull of its own.\n- The shape of the coast changes how high the water climbs.\n- Wind and air pressure can push the tide higher or lower than predicted.\n\n## Spring and neap tides\nWhen the sun, moon and Earth line up, their pulls add together.\n\n1. **Spring tides** happen at new and full moon. High tides are higher and low tides are lower.\n2. **Neap tides** happen at the quarter moons. The pulls partly cancel, so the range is small.\n\nPlan shoreline visits for a low spring tide if you want to see the most exposed ground.\n\n## Reading the shore\nThree signs tell you what the last tide did:\n\n1. **Waterline.** The edge of the wet sand. Note how far it sits from the dry sand.\n2. **Wrack line.** The row of seaweed and debris left at the highest reach of the last tide.\n3. **Ripple marks.** Small ridges in the sand that show which way the water moved.\n\n### What to photograph\nInclude the wrack line and something for scale, such as a shoe or a ruler.\n\n## Recording a trace\nOpen **Submit a trace**, add a clear title, and describe what you saw in a sentence or two. Add the time of your visit, because the same spot looks very different at high and low tide.\n\nFinish with a photo and your location, then save a draft or submit for review.',
 'published',
 true,
 (select id from public.categories where is_active order by created_at limit 1)
where exists (select 1 from public.profiles where role='admin')
  and not exists (select 1 from public.tides where slug='understanding-tides');
