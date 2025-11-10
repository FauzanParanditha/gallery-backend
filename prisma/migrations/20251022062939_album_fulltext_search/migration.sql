-- 1) Kolom tsvector (jika belum ada)
ALTER TABLE "Album" ADD COLUMN IF NOT EXISTS "searchDoc" tsvector;

-- 2) Function untuk update tsvector (pakai 'simple' agar netral untuk bahasa Indonesia)
CREATE OR REPLACE FUNCTION album_tsv_update() RETURNS trigger AS $$
BEGIN
  NEW."searchDoc" :=
    setweight(to_tsvector('simple', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(NEW.description, '')), 'B');
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

-- 3) Trigger sebelum INSERT/UPDATE
DROP TRIGGER IF EXISTS album_tsv_update ON "Album";
CREATE TRIGGER album_tsv_update BEFORE INSERT OR UPDATE
ON "Album" FOR EACH ROW EXECUTE PROCEDURE album_tsv_update();

-- 4) Backfill nilai awal (untuk data yang sudah ada)
UPDATE "Album" SET title = title;

-- 5) Index GIN untuk performa pencarian
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'album_search_gin'
  ) THEN
    CREATE INDEX album_search_gin ON "Album" USING GIN ("searchDoc");
  END IF;
END$$;
