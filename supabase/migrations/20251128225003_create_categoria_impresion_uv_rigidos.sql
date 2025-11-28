/*
  # Crear Categoría del Sistema: Impresión UV sobre Rígidos

  ## Descripción
  Esta migración crea la categoría del sistema para productos de Impresión UV sobre materiales rígidos.
  Esta categoría permite vender productos de impresión UV calculando el precio como la suma del
  material rígido + costo de impresión UV por m².

  ## Nueva Categoría

  ### Impresión UV sobre Rígidos (ID: 00000000-0000-0000-0000-000000000008)
  - Categoría del sistema para productos de impresión UV sobre materiales rígidos
  - Permite dos flujos: materiales del catálogo o materiales provistos por el cliente
  - Calcula precio como: costo material + costo impresión UV por m²
  - Soporta múltiples líneas de medidas/cantidades en el wizard

  ## Seguridad
  - Categoría del sistema (is_system_category = true)
  - company_id = NULL (global para todas las empresas)
  - Solo lectura desde el frontend (protegida por RLS)

  ## Notas Importantes
  - Esta categoría es inmutable y solo puede modificarse mediante migraciones SQL
  - Los usuarios pueden filtrar servicios y acabados específicos para esta categoría
  - Las rutas de producción se asignan igual que en otras categorías
*/

-- =====================================================
-- 1. INSERTAR CATEGORÍA DEL SISTEMA
-- =====================================================

INSERT INTO categorias (id, nombre, descripcion, color, is_system_category, is_active, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000008',
  'Impresión UV sobre Rígidos',
  'Impresión UV sobre materiales rígidos con cálculo de precio material + impresión',
  '#EC4899',
  true,
  true,
  now(),
  now()
)
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- 2. COMENTARIO DESCRIPTIVO
-- =====================================================

COMMENT ON TABLE categorias IS
  'Categorías del sistema - Incluye Impresión UV sobre Rígidos para productos que combinan material + impresión UV';
