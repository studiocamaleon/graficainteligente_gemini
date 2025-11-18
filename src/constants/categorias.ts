/**
 * Categorías del Sistema
 *
 * Las categorías son entidades inmutables que forman parte del core de la aplicación.
 * Solo pueden ser modificadas mediante migraciones SQL en desarrollo.
 *
 * IMPORTANTE: No agregar ni modificar categorías sin una migración correspondiente.
 */
export const CATEGORIAS_SISTEMA = {
  IMPRESION_LASER: {
    id: '00000000-0000-0000-0000-000000000001',
    nombre: 'Impresion Laser',
    descripcion: 'Productos de impresión digital laser',
    color: '#3B82F6',
  },
  IMPRESION_GRAN_FORMATO: {
    id: '00000000-0000-0000-0000-000000000002',
    nombre: 'Impresion Gran Formato',
    descripcion: 'Productos de impresión en gran formato',
    color: '#10B981',
  },
  MATERIALES_RIGIDOS: {
    id: '00000000-0000-0000-0000-000000000003',
    nombre: 'Materiales Rigidos',
    descripcion: 'Productos con materiales rígidos',
    color: '#F59E0B',
  },
  PLOTTER_CORTE: {
    id: '00000000-0000-0000-0000-000000000004',
    nombre: 'Plotter de Corte',
    descripcion: 'Productos para plotter de corte',
    color: '#EC4899',
  },
} as const;

// Exportaciones de compatibilidad
export const CATEGORIA_IMPRESION_LASER_ID = CATEGORIAS_SISTEMA.IMPRESION_LASER.id;
export const CATEGORIA_GRAN_FORMATO_ID = CATEGORIAS_SISTEMA.IMPRESION_GRAN_FORMATO.id;
export const CATEGORIA_MATERIALES_RIGIDOS_ID = CATEGORIAS_SISTEMA.MATERIALES_RIGIDOS.id;
export const CATEGORIA_PLOTTER_CORTE_ID = CATEGORIAS_SISTEMA.PLOTTER_CORTE.id;

// Lista de IDs de todas las categorías (útil para validaciones)
export const CATEGORIA_IDS = Object.values(CATEGORIAS_SISTEMA).map(cat => cat.id);
