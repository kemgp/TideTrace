// One-off backfill for egress PR 1b: makes the smaller copies of Trace photos uploaded before thumbnails existed.
//   thumbnail:    <name>.thumb.webp, 480 px, for every photo without one (cards, lists, the landing strip)
//   display copy: <name>.display.webp, 1600 px, for photos over --min-kb (default 500) without one (the Trace page)
// The original file is never changed or deleted. Photos of deleted Traces are skipped.
//
// Run from the repository root on your own computer, against one project at a time (staging first):
//   npm install --no-save sharp
//   read -s SUPABASE_SERVICE_ROLE_KEY && export SUPABASE_SERVICE_ROLE_KEY     (paste the key; it is not shown)
//   SUPABASE_URL=https://<project>.supabase.co node scripts/backfill-media-variants.mjs            (dry run)
//   SUPABASE_URL=https://<project>.supabase.co node scripts/backfill-media-variants.mjs --apply    (writes)
// The service role key bypasses row-level security: keep it out of files, commits and chat. It is never printed.
// A dry run reads only the database: it downloads no photos, so it costs no Storage egress.
import { createClient } from "@supabase/supabase-js";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const minKb = Number(args.find((arg) => arg.startsWith("--min-kb="))?.split("=")[1] ?? 500);
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment first (see the comment at the top of this file).");
  process.exit(1);
}
if (!Number.isFinite(minKb) || minKb < 0) {
  console.error("--min-kb must be a number of kilobytes, for example --min-kb=500.");
  process.exit(1);
}

let sharp = null;
if (apply) {
  try { sharp = (await import("sharp")).default; }
  catch {
    console.error("This script needs the sharp image library. Run `npm install --no-save sharp` from the repository root, then try again.");
    process.exit(1);
  }
}

const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const base = (path) => path.replace(/\.[a-z0-9]+$/, "");
const kb = (bytes) => `${Math.round(bytes / 1024)} kB`;

const rows = [];
for (let from = 0; ; from += 500) {
  const { data, error } = await db.from("trace_media")
    .select("id,object_path,mime_type,size_bytes,thumb_path,display_path,trace:traces!inner(status,deleted_at)")
    .like("mime_type", "image/%").is("trace.deleted_at", null)
    .order("created_at").range(from, from + 499);
  if (error) { console.error(`Could not read trace_media: ${error.message}`); process.exit(1); }
  rows.push(...data);
  if (data.length < 500) break;
}

const work = rows.map((row) => ({
  row,
  thumb: !row.thumb_path,
  display: !row.display_path && row.size_bytes > minKb * 1024,
})).filter((item) => item.thumb || item.display);

console.log(`${url.replace(/^https:\/\//, "")}: ${rows.length} photos on Traces that are not deleted; ${work.length} need copies.`);
for (const { row, thumb, display } of work) {
  console.log(`  ${row.id}  ${row.trace.status.padEnd(18)} ${kb(row.size_bytes).padStart(8)}  ${[thumb && "thumbnail", display && "display copy"].filter(Boolean).join(" + ")}`);
}
if (!apply) {
  console.log("\nDry run: nothing was downloaded or written. Add --apply to make these copies.");
  process.exit(0);
}

let made = 0;
let failed = 0;
const upload = async (path, buffer) => {
  const { error } = await db.storage.from("trace-media").upload(path, buffer, { contentType: "image/webp", upsert: true, cacheControl: "31536000" });
  if (error) throw new Error(`upload ${path.split("/").pop()}: ${error.message}`);
};
for (const { row, thumb, display } of work) {
  try {
    const { data: file, error } = await db.storage.from("trace-media").download(row.object_path);
    if (error) throw new Error(`download: ${error.message}`);
    const original = Buffer.from(await file.arrayBuffer());
    // rotate() applies the camera orientation; sharp drops other metadata (such as GPS) from the copies.
    const changes = {};
    if (thumb) {
      const copy = await sharp(original).rotate().resize({ width: 480, height: 480, fit: "inside", withoutEnlargement: true }).webp({ quality: 78 }).toBuffer();
      await upload(`${base(row.object_path)}.thumb.webp`, copy);
      changes.thumb_path = `${base(row.object_path)}.thumb.webp`;
    }
    if (display) {
      const copy = await sharp(original).rotate().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
      if (copy.length < original.length) {
        await upload(`${base(row.object_path)}.display.webp`, copy);
        changes.display_path = `${base(row.object_path)}.display.webp`;
      }
    }
    if (Object.keys(changes).length) {
      const { error: saveError } = await db.from("trace_media").update(changes).eq("id", row.id);
      if (saveError) throw new Error(`save: ${saveError.message}`);
    }
    made += 1;
    console.log(`  done ${row.id}${changes.display_path ? " (with display copy)" : ""}`);
  } catch (problem) {
    failed += 1;
    console.error(`  failed ${row.id}: ${problem.message}`);
  }
}
console.log(`\nFinished: ${made} photos updated, ${failed} failed. Run again to retry failures; finished photos are skipped.`);
process.exit(failed ? 1 : 0);
