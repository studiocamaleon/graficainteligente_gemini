-- Enable Realtime for Ordenes de Trabajo Tables
-- Author: Antigravity
-- Date: 2025-12-23

BEGIN;

-- Check if tables are already in publication, if not add them.
-- Since "ADD TABLE" throws error if already present in simple syntax, we use "ALTER PUBLICATION ... SET TABLE" or try/catch logic?
-- Safest way in raw SQL without procedural logic is usually just trying, but Supabase might error.
-- Better approach: ALTER PUBLICATION supabase_realtime ADD TABLE table_name; usually is idempotent-ish or we can ignore error?
-- No, postgres throws error "relation ... is already member of publication".

-- So we will use a DO block.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'ordenes_trabajo'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE ordenes_trabajo;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'ordenes_trabajo_items'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE ordenes_trabajo_items;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'ordenes_trabajo_items_rutas'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE ordenes_trabajo_items_rutas;
    END IF;
END $$;

COMMIT;
