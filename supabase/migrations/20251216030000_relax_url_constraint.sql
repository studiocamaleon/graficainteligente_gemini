-- Drop the restrictive check constraint that forces https://
ALTER TABLE ordenes_trabajo_links DROP CONSTRAINT IF EXISTS check_url_valida;

-- Optionally add a new looser constraint that just ensures it's not empty
ALTER TABLE ordenes_trabajo_links ADD CONSTRAINT check_url_not_empty CHECK (length(trim(url)) > 0);
