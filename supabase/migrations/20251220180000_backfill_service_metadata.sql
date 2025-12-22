-- Migration: Backfill Service Metadata
-- Description: Automatically links services to items for existing orders where the relationship is unambiguous (1 item per order).

DO $$
DECLARE
    updated_count INTEGER;
BEGIN
    -- Update services for orders that have exactly ONE item
    -- Logic: If an order has only 1 item, all its services 'must' belong to that item (safest heuristic).
    
    WITH residential_orders AS (
        -- Find orders with exactly one item
        SELECT orden_id 
        FROM ordenes_trabajo_items 
        GROUP BY orden_id 
        HAVING COUNT(*) = 1
    ),
    target_items AS (
        -- Get the single item ID for those orders
        SELECT i.id AS item_id, i.orden_id
        FROM ordenes_trabajo_items i
        JOIN residential_orders ro ON i.orden_id = ro.orden_id
    )
    UPDATE ordenes_trabajo_servicios s
    SET metadata = jsonb_build_object('linked_item_ids', jsonb_build_array(ti.item_id))
    FROM target_items ti
    WHERE s.orden_id = ti.orden_id
    AND (s.metadata IS NULL OR s.metadata = '{}'::jsonb); -- Only update if metadata is empty to avoid overwriting manual fixes

    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE 'Updated % services with inferred item links.', updated_count;

END $$;
