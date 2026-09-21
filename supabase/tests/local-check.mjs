// Isolated SQL validation with PostgreSQL/PGlite; no Supabase credentials needed.
// Pass an absolute path to an installed @electric-sql/pglite dist/index.js.
import { readFile } from 'node:fs/promises';
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
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text,owner_id text,metadata jsonb,unique(bucket_id,name));
    alter table storage.objects enable row level security;
    grant all on storage.objects to anon,authenticated;
    create function storage.foldername(name text) returns text[] language sql immutable as
      $$ select (string_to_array(name,'/'))[1:array_length(string_to_array(name,'/'),1)-1] $$;
    alter default privileges in schema public grant all on tables to anon,authenticated,service_role;
    alter default privileges in schema public grant execute on functions to anon,authenticated,service_role;
  `);
  const migration = await readFile(new URL('../migrations/20260921000100_initial_schema.sql', import.meta.url), 'utf8');
  await db.exec(migration);
  console.log('PASS: migration executed on PostgreSQL (PGlite with Auth/Storage stubs).');
  const checks = await readFile(new URL('./access-control.sql', import.meta.url), 'utf8');
  await db.exec(checks);
  console.log(`PASS: ${checks.match(/select tidetrace_test\.(assert_ok|reject)\(/g).length} access-control and workflow assertions; fixtures rolled back.`);
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
