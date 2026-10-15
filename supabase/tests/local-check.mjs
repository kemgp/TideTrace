// Isolated SQL validation with PostgreSQL/PGlite; no Supabase credentials needed.
// Pass an absolute path to an installed @electric-sql/pglite dist/index.js.
import { readFile, readdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const { PGlite } = await import(process.argv[2] ? pathToFileURL(process.argv[2]).href : '@electric-sql/pglite');
const db = new PGlite();
try {
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create schema auth;
    create schema storage;
    grant usage on schema public,auth,storage to anon,authenticated;
    create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text,owner_id text,metadata jsonb,created_at timestamptz not null default now(),unique(bucket_id,name));
    alter table storage.objects enable row level security;
    grant all on storage.objects to anon,authenticated;
    create function storage.foldername(name text) returns text[] language sql immutable as
      $$ select (string_to_array(name,'/'))[1:array_length(string_to_array(name,'/'),1)-1] $$;
    alter default privileges in schema public grant all on tables to anon,authenticated,service_role;
    alter default privileges in schema public grant execute on functions to anon,authenticated,service_role;
  `);
  const migrationDir = new URL('../migrations/', import.meta.url);
  for (const name of (await readdir(migrationDir)).filter((name) => name.endsWith('.sql')).sort()) {
    await db.exec(await readFile(new URL(name, migrationDir), 'utf8'));
    console.log(`PASS: migration ${name} executed on PostgreSQL (PGlite with Auth/Storage stubs).`);
  }
  // A SQL Editor install may precede the deployment migration runner.
  // Replay the whole settings migration, then run the same workflow checks.
  await db.exec(await readFile(new URL('20261005000200_workflow_settings.sql', migrationDir), 'utf8'));
  const { rows: triggers } = await db.query(`select tgname from pg_trigger where not tgisinternal and tgname in ('validate_workflow_settings','enforce_submission_setting','enforce_media_limit')`);
  if (triggers.length !== 3) throw new Error('Settings migration retry must retain exactly three workflow triggers');
  console.log('PASS: workflow settings migration can be reapplied without duplicate triggers.');
  // SQL Editor/manual bucket setup can precede the migration runner. Keep
  // existing uploads while restoring the intended bucket settings on retry.
  await db.exec(`
    insert into storage.objects(bucket_id,name,owner_id,metadata)
    values('profile-photos','existing-owner/keep.png','existing-owner','{"mimetype":"image/png","size":4096}');
    update storage.buckets set public=true,file_size_limit=10485760,allowed_mime_types=array['image/png']
    where id='profile-photos';
  `);
  for (let attempt = 0; attempt < 2; attempt++) {
    for (const name of ['20261014000100_profile_photos.sql', '20261014000200_trace_author_photos.sql', '20261015000100_photo_management_and_comment_avatars.sql']) {
      await db.exec(await readFile(new URL(name, migrationDir), 'utf8'));
    }
  }
  const { rows: buckets } = await db.query(`select * from storage.buckets where id='profile-photos'`);
  if (buckets.length !== 1 || buckets[0].public !== false || Number(buckets[0].file_size_limit) !== 5242880 ||
      JSON.stringify(buckets[0].allowed_mime_types) !== JSON.stringify(['image/jpeg','image/png','image/webp'])) {
    throw new Error('Photo migration retry must retain one private bucket with the intended upload limits');
  }
  const { rows: uploads } = await db.query(`select * from storage.objects where bucket_id='profile-photos' and name='existing-owner/keep.png'`);
  if (uploads.length !== 1 || uploads[0].owner_id !== 'existing-owner' || uploads[0].metadata.size !== 4096) {
    throw new Error('Photo migration retry must preserve existing uploads and metadata');
  }
  const { rows: photoPolicies } = await db.query(`select policyname from pg_policies where schemaname='storage' and tablename='objects' and policyname in ('tidetrace_avatar_upload','tidetrace_avatar_read','tidetrace_published_author_photo_read','tidetrace_avatar_cleanup')`);
  if (photoPolicies.length !== 4) throw new Error('Photo migration retry must retain exactly four photo policies');
  // Remove only this local fixture before running the access-control checks.
  await db.exec(`delete from storage.objects where bucket_id='profile-photos' and name='existing-owner/keep.png'`);
  console.log('PASS: photo migrations can be reapplied while preserving existing uploads and bucket protections.');
  const checks = await readFile(new URL('./access-control.sql', import.meta.url), 'utf8');
  await db.exec(checks);
  console.log(`PASS: ${checks.match(/select tidetrace_test\.(assert_ok|reject)\(/g).length} access-control and workflow assertions; fixtures rolled back.`);
  await db.exec(await readFile(new URL('./photo-management.sql', import.meta.url), 'utf8'));
  console.log('PASS: photo removal, cleanup eligibility, retirement protection and comment-avatar visibility.');
  await db.exec(await readFile(new URL('20261015000200_search_public_traces.sql', migrationDir), 'utf8'));
  await db.exec(await readFile(new URL('./trace-search.sql', import.meta.url), 'utf8'));
  console.log('PASS: archive search fields, literal punctuation, pagination and public visibility.');
  await db.exec(await readFile(new URL('20261015000300_notification_preferences.sql', migrationDir), 'utf8'));
  await db.exec(await readFile(new URL('./notification-preferences.sql', import.meta.url), 'utf8'));
  console.log('PASS: notification preference persistence, isolation and event delivery.');
  await db.exec(await readFile(new URL('20261015000400_data_saver.sql', migrationDir), 'utf8'));
  await db.exec(await readFile(new URL('./data-saver.sql', import.meta.url), 'utf8'));
  console.log('PASS: data saver defaults, persistence, ownership and active-account restrictions.');
  // Bootstrap remains SQL-editor-only and rejects a second bootstrap.
  await db.exec(`insert into auth.users(id,email,raw_user_meta_data) values('20000000-0000-0000-0000-000000000001','bootstrap@example.invalid','{}');`);
  const bootstrap = (await readFile(new URL('../bootstrap-first-admin.sql', import.meta.url), 'utf8')).replaceAll('REPLACE_WITH_YOUR_AUTH_USER_UUID','20000000-0000-0000-0000-000000000001');
  await db.exec(bootstrap);
  const { rows } = await db.query(`select role from public.profiles where id='20000000-0000-0000-0000-000000000001'`);
  if (rows[0]?.role !== 'admin') throw new Error('Bootstrap did not create admin');
  let rejected = false;
  try { await db.exec(bootstrap); } catch (error) {
    await db.exec('rollback');
    if (!error.message.includes('active admin already exists')) throw error;
    rejected = true;
  }
  if (!rejected) throw new Error('Second bootstrap unexpectedly succeeded');
  console.log('PASS: initial admin bootstrap succeeds once and refuses a repeat.');
} catch (error) {
  console.error(error.message);
  if (error.position) console.error('SQL error position:', error.position);
  if (error.where) console.error('SQL context:', error.where);
  process.exitCode = 1;
} finally {
  await db.close();
}
