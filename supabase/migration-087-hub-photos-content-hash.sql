-- Wodflow — migration 087: dedupe hub photos by content hash
--
-- Tjokkie is uploading a 1.2 GB batch from the event photographer
-- and wants duplicates skipped. The upload form hashes each file
-- (SHA-256 of the bytes) in the browser before uploading; this
-- column stores that hash so a second upload of the same byte-
-- identical file is rejected by the unique index below instead of
-- piling another row onto the carousel. Existing rows (uploaded
-- one-at-a-time before this migration) have no hash and are
-- excluded from the uniqueness check via the partial index.

alter table public.hub_photos
  add column if not exists content_hash text;

create unique index if not exists hub_photos_org_content_hash_key
  on public.hub_photos (organization_id, content_hash)
  where content_hash is not null;
