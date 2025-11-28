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
  SELLOS: {
    id: '00000000-0000-0000-0000-000000000005',
    nombre: 'Sellos',
    descripcion: 'Productos de sellos y accesorios',
    color: '#8B5CF6',
  },
  PORTABANNERS: {
    id: '00000000-0000-0000-0000-000000000006',
    nombre: 'Portabanners',
    descripcion: 'Productos de portabanners y expositores',
    color: '#06B6D4',
  },
  TALONARIOS: {
    id: '00000000-0000-0000-0000-000000000007',
    nombre: 'Talonarios',
    descripcion: 'Productos de talonarios y formularios',
    color: '#14B8A6',
  },
  IMPRESION_UV_RIGIDOS: {
    id: '00000000-0000-0000-0000-000000000008',
    nombre: 'Impresión UV sobre Rígidos',
    descripcion: 'Impresión UV sobre materiales rígidos con cálculo de precio material + impresión',
    color: '#EC4899',
  },
} as const;

// Exportaciones de compatibilidad
export const CATEGORIA_IMPRESION_LASER_ID = CATEGORIAS_SISTEMA.IMPRESION_LASER.id;
export const CATEGORIA_GRAN_FORMATO_ID = CATEGORIAS_SISTEMA.IMPRESION_GRAN_FORMATO.id;
export const CATEGORIA_MATERIALES_RIGIDOS_ID = CATEGORIAS_SISTEMA.MATERIALES_RIGIDOS.id;
export const CATEGORIA_PLOTTER_CORTE_ID = CATEGORIAS_SISTEMA.PLOTTER_CORTE.id;
export const CATEGORIA_SELLOS_ID = CATEGORIAS_SISTEMA.SELLOS.id;
export const CATEGORIA_PORTABANNERS_ID = CATEGORIAS_SISTEMA.PORTABANNERS.id;
export const CATEGORIA_TALONARIOS_ID = CATEGORIAS_SISTEMA.TALONARIOS.id;
export const CATEGORIA_IMPRESION_UV_RIGIDOS_ID = CATEGORIAS_SISTEMA.IMPRESION_UV_RIGIDOS.id;

// Lista de IDs de todas las categorías (útil para validaciones)
export const CATEGORIA_IDS = Object.values(CATEGORIAS_SISTEMA).map(cat => cat.id);
