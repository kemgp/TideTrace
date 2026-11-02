-- Optional sample data: one published lesson with a summary and a topic. Not a migration; run it once by hand.
-- Add the sample slides afterwards from Admin > Tides > this lesson > Slides (PDF).
insert into public.tides(author_id,title,slug,summary,body,status,category_id)
select
 (select id from public.profiles where role='admin' order by created_at limit 1),
 'Reading the Shoreline',
 'reading-the-shoreline',
 'Three quick checks that tell you what the last tide did, so your traces say more.',
 E'## What you will learn\nHow to read three signs on the shore and record them in a trace.\n\n## Step by step\n1. **Waterline.** Find the wet sand line and note how far it sits from the dry sand.\n2. **Wrack line.** Seaweed and shells mark the last high tide. A thick line means a strong tide.\n3. **Weather.** Note the wind direction, recent rain and swell.\n\n## Try it yourself\n- Take one photo of the waterline\n- Take one photo of the wrack line\n- Write the weather in the trace description\n\n### Tip\nVisit at the same spot each week to see how the shore changes.\n\n## Key takeaways\n- The wrack line shows the **last high tide**\n- Photos and notes together make a useful trace',
 'published',
 (select id from public.categories where is_active order by created_at limit 1)
where exists (select 1 from public.profiles where role='admin')
  and not exists (select 1 from public.tides where slug='reading-the-shoreline');
