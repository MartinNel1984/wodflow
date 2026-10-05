// One-off: bulk-upload Rumble in Randburg "The Big One" photos
// to the hub-photos storage bucket + hub_photos table, tagged to
// the event. Expects an already-unzipped folder of .jpg files.
//
//   node scripts/upload-rumble-photos.mjs --dir=/path/to/unzipped --concurrency=5
//
// Dedup strategy:
//   - Preflight downloads + sha256s every existing event photo whose
//     hub_photos.content_hash is NULL, writes the hash back to the row.
//     Rows already carrying a hash are read from the table and reused.
//   - On insert we set content_hash too, so the partial unique index
//     from migration-087 (organization_id, content_hash) rejects any
//     byte-identical photo already present for this org.
//   - A local JSON hash cache in .tmp/ makes reruns instant.

import { readFileSync, readdirSync, statSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { basename, extname, join, dirname } from "node:path";
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const EVENT_ID = "79a44b2c-8ad7-474a-aad7-bd7c0835372a";
const ORG_ID = "fce9ade2-942f-40b9-ac55-cd72df9ce0fe";
const BUCKET = "hub-photos";

function loadEnv(path) {
  let text = "";
  try { text = readFileSync(path, "utf8"); } catch { return; }
  for (const line of text.split("\n")) {
    const m = line.match(/^\s*([\w.]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!(m[1] in process.env)) process.env[m[1]] = v;
  }
}
loadEnv(new URL("../.env.local", import.meta.url).pathname);

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const m = a.match(/^--([\w-]+)=(.*)$/);
  return m ? [m[1], m[2]] : [a.replace(/^--/, ""), true];
}));
const DIR = args.dir;
const CONCURRENCY = Number(args.concurrency || 5);
if (!DIR) { console.error("missing --dir"); process.exit(1); }

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const files = readdirSync(DIR)
  .filter((f) => /\.(jpe?g|png)$/i.test(f))
  .filter((f) => statSync(join(DIR, f)).isFile())
  .sort();

console.log(`Found ${files.length} images in ${DIR}`);

// Pull every hub_photos row for this org (not just this event) so content_hash
// dedup catches re-uploads across other events too. The partial unique index
// is scoped to organization_id anyway.
const allOrgRows = [];
{
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("hub_photos")
      .select("id, image_url, content_hash, event_id, sort_order")
      .eq("organization_id", ORG_ID)
      .range(from, from + 999);
    if (error) throw error;
    if (!data?.length) break;
    allOrgRows.push(...data);
    if (data.length < 1000) break;
    from += 1000;
  }
}
const eventRows = allOrgRows.filter((r) => r.event_id === EVENT_ID);
const existingUrls = new Set(eventRows.map((r) => r.image_url));
let nextSortOrder = Math.max(0, ...eventRows.map((r) => r.sort_order ?? 0)) + 1;
console.log(`Org has ${allOrgRows.length} hub_photos rows; ${eventRows.length} already linked to this event. sort_order starts at ${nextSortOrder}.`);

// Hash cache keyed by storage path so reruns skip the download step.
const HASH_CACHE_PATH = new URL("../.tmp/rumble-photo-hashes.json", import.meta.url).pathname;
let hashCache = {};
if (existsSync(HASH_CACHE_PATH)) {
  try { hashCache = JSON.parse(readFileSync(HASH_CACHE_PATH, "utf8")); } catch {}
}
mkdirSync(dirname(HASH_CACHE_PATH), { recursive: true });

const PUBLIC_PREFIX = `/storage/v1/object/public/${BUCKET}/`;
function pathFromUrl(url) {
  const i = url.indexOf(PUBLIC_PREFIX);
  return i === -1 ? null : url.slice(i + PUBLIC_PREFIX.length);
}

// Build sha256 → row map, backfilling content_hash on rows that lack it.
const hashToRow = new Map();
let haveFromDb = 0, haveFromCache = 0, hashedNow = 0, backfilled = 0, hashFailed = 0;
const needHash = [];
for (const r of allOrgRows) {
  if (r.content_hash) {
    hashToRow.set(r.content_hash, r);
    haveFromDb++;
    continue;
  }
  const path = pathFromUrl(r.image_url);
  if (!path) continue;
  const cached = hashCache[`path:${path}`];
  if (cached) {
    hashToRow.set(cached, r);
    haveFromCache++;
    // Push hash back to the row so the DB enforces dedup next time.
    const { error } = await supabase.from("hub_photos").update({ content_hash: cached }).eq("id", r.id);
    if (!error) backfilled++;
    continue;
  }
  needHash.push({ row: r, path });
}
console.log(`content_hash coverage: ${haveFromDb} from DB, ${haveFromCache} from local cache; ${needHash.length} rows need hashing.`);

async function hashRow({ row, path }) {
  const { data: blob, error: dlErr } = await supabase.storage.from(BUCKET).download(path);
  if (dlErr) { hashFailed++; console.warn(`  skip hash for ${path}: ${dlErr.message}`); return; }
  const buf = Buffer.from(await blob.arrayBuffer());
  const sha = createHash("sha256").update(buf).digest("hex");
  hashCache[`path:${path}`] = sha;
  hashToRow.set(sha, row);
  const { error: upErr } = await supabase.from("hub_photos").update({ content_hash: sha }).eq("id", row.id);
  if (!upErr) backfilled++;
  hashedNow++;
  if (hashedNow % 50 === 0) {
    console.log(`  …hashed ${hashedNow}/${needHash.length} (failed ${hashFailed})`);
    writeFileSync(HASH_CACHE_PATH, JSON.stringify(hashCache));
  }
}
{
  const q = [...needHash];
  async function w() { while (q.length) { const it = q.shift(); if (it) await hashRow(it); } }
  await Promise.all(Array.from({ length: 8 }, w));
}
writeFileSync(HASH_CACHE_PATH, JSON.stringify(hashCache));
console.log(`Hash index: ${hashToRow.size} unique hashes (hashed ${hashedNow} new, backfilled ${backfilled} rows, failed ${hashFailed}).`);

const results = { uploaded: 0, skipped: 0, failed: [] };

async function processOne(file, index) {
  const ext = (extname(file) || ".jpg").toLowerCase().replace(".jpeg", ".jpg");
  const safeName = basename(file, extname(file)).replace(/[^\w-]/g, "_");
  const path = `${ORG_ID}/rumble-bigone-2026/${safeName}${ext}`;
  const { data: publicData } = supabase.storage.from(BUCKET).getPublicUrl(path);
  const publicUrl = publicData.publicUrl;

  if (existingUrls.has(publicUrl)) {
    results.skipped++;
    return;
  }

  try {
    const buf = await readFile(join(DIR, file));
    const sha = createHash("sha256").update(buf).digest("hex");
    const dupRow = hashToRow.get(sha);
    if (dupRow) {
      results.skipped++;
      results.dupContent = (results.dupContent ?? 0) + 1;
      // If the duplicate is already linked to another event, link a second row to this event too.
      if (dupRow.event_id !== EVENT_ID && !existingUrls.has(dupRow.image_url)) {
        const sortOrder = nextSortOrder + index;
        const { error: insErr } = await supabase.from("hub_photos").insert({
          image_url: dupRow.image_url,
          caption: null,
          event_id: EVENT_ID,
          historical_event_id: null,
          sort_order: sortOrder,
          organization_id: ORG_ID,
          content_hash: sha,
        });
        if (insErr) results.failed.push({ file, error: `link existing: ${insErr.message}` });
        else existingUrls.add(dupRow.image_url);
      }
      return;
    }
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, buf, {
      contentType: ext === ".png" ? "image/png" : "image/jpeg",
      upsert: true,
    });
    if (upErr) throw upErr;

    const sortOrder = nextSortOrder + index;
    const { error: insErr } = await supabase.from("hub_photos").insert({
      image_url: publicUrl,
      caption: null,
      event_id: EVENT_ID,
      historical_event_id: null,
      sort_order: sortOrder,
      organization_id: ORG_ID,
      content_hash: sha,
    });
    if (insErr) throw insErr;

    hashToRow.set(sha, { id: null, image_url: publicUrl, content_hash: sha, event_id: EVENT_ID });
    existingUrls.add(publicUrl);
    results.uploaded++;
    if (results.uploaded % 20 === 0) console.log(`  …${results.uploaded} uploaded`);
  } catch (e) {
    results.failed.push({ file, error: e.message || String(e) });
  }
}

const queue = files.map((f, i) => ({ f, i }));
async function worker() {
  while (queue.length) {
    const item = queue.shift();
    if (!item) break;
    await processOne(item.f, item.i);
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));

console.log(`\nDone. Uploaded: ${results.uploaded}, Skipped: ${results.skipped} (content-dup: ${results.dupContent ?? 0}), Failed: ${results.failed.length}`);
if (results.failed.length) {
  console.log("Failures:");
  for (const f of results.failed) console.log(`  ${f.file}: ${f.error}`);
}
