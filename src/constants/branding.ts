export const BRAND = {
  name: 'Grafica Inteligente',
  tagline: 'Software de Gestión para Imprentas y Cartelería',
  description: 'Automatiza tu producción gráfica, genera cotizaciones en segundos y controla cada etapa del proceso.',
} as const;

export const COLORS = {
  primary: {
    50: '#faf5ff',
    100: '#f3e8ff',
    200: '#e9d5ff',
    300: '#d8b4fe',
    400: '#c084fc',
    500: '#a855f7',
    600: '#9333ea',
    700: '#7e22ce',
    800: '#6b21a8',
    900: '#581c87',
  },
  secondary: {
    50: '#eff6ff',
    100: '#dbeafe',
    200: '#bfdbfe',
    300: '#93c5fd',
    400: '#60a5fa',
    500: '#3b82f6',
    600: '#2563eb',
    700: '#1d4ed8',
    800: '#1e40af',
    900: '#1e3a8a',
  },
  accent: {
    50: '#f7fee7',
    100: '#ecfccb',
    200: '#d9f99d',
    300: '#bef264',
    400: '#a3e635',
    500: '#84cc16',
    600: '#65a30d',
    700: '#4d7c0f',
    800: '#3f6212',
    900: '#365314',
  },
} as const;

export const GRADIENTS = {
  primary: 'bg-gradient-to-r from-blue-600 to-cyan-600',
  primaryHover: 'hover:from-blue-700 hover:to-cyan-700',
  secondary: 'bg-gradient-to-r from-cyan-600 to-blue-600',
  accent: 'bg-gradient-to-r from-blue-500 to-cyan-500',
  hero: 'bg-gradient-to-br from-blue-50 via-white to-cyan-50',
  card: 'bg-gradient-to-br from-white to-blue-50/30',
  chameleon: 'bg-gradient-to-r from-blue-600 to-cyan-600',
} as const;

export const FEATURES = [
  {
    title: 'Cotizaciones Instantáneas',
    description: 'Genera presupuestos precisos en segundos con cálculos automáticos de materiales, tintas y tiempos de producción.',
    icon: 'Calculator',
  },
  {
    title: 'Gestión de Producción',
    description: 'Controla cada etapa del flujo de trabajo desde pre-prensa hasta post-prensa con rutas personalizadas.',
    icon: 'Workflow',
  },
  {
    title: 'Catálogo Inteligente',
    description: 'Organiza tus productos por categorías con configuraciones de materiales, acabados y tecnologías.',
    icon: 'Layers',
  },
  {
    title: 'Control de Inventario',
    description: 'Gestiona stock de materiales, tintas y consumibles con alertas automáticas de reposición.',
    icon: 'Package',
  },
  {
    title: 'Gestión de Clientes',
    description: 'Centraliza la información de tus clientes con historial completo de pedidos y comunicaciones.',
    icon: 'Users',
  },
  {
    title: 'Reportes y Análisis',
    description: 'Visualiza métricas clave de tu negocio con dashboards en tiempo real y reportes detallados.',
    icon: 'BarChart3',
  },
] as const;

export const MODULES = [
  {
    title: 'Catálogo de Productos',
    description: 'Crea y gestiona tu catálogo completo con configuraciones personalizadas por tipo de producto: impresión láser, gran formato, materiales rígidos y más.',
    image: '/images/catalog-module.png',
    features: ['Categorías ilimitadas', 'Variantes de producto', 'Precios por rango', 'Rutas de producción'],
  },
  {
    title: 'Cotizaciones Automáticas',
    description: 'Sistema inteligente que calcula automáticamente costos de materiales, mano de obra, tintas y acabados según las especificaciones del cliente.',
    image: '/images/quotes-module.png',
    features: ['Cálculo instantáneo', 'Múltiples versiones', 'Exportación PDF', 'Seguimiento de aprobación'],
  },
  {
    title: 'Producción y Workflow',
    description: 'Define y gestiona cada paso del proceso productivo con asignación de estaciones de trabajo y control de tiempos.',
    image: '/images/production-module.png',
    features: ['Rutas personalizables', 'Gestión de estaciones', 'Control de tiempos', 'Estados de orden'],
  },
  {
    title: 'Gestión Financiera',
    description: 'Controla cuentas por cobrar y pagar, gestiona proveedores y mantén tu flujo de caja siempre visible.',
    image: '/images/finance-module.png',
    features: ['Cuentas corrientes', 'Gestión de pagos', 'Reportes financieros', 'Integración bancaria'],
  },
] as const;

export const USE_CASES = [
  {
    title: 'Imprentas Offset',
    description: 'Gestiona trabajos offset con control de placas, tintas y acabados especiales.',
    icon: 'Printer',
    benefits: ['Control de tiradas', 'Gestión de color', 'Acabados múltiples'],
  },
  {
    title: 'Gran Formato',
    description: 'Optimiza la producción de ploteos, lonas, vinilos y señalética de gran tamaño.',
    icon: 'Maximize2',
    benefits: ['Cálculo por m²', 'Gestión de anchos', 'Terminaciones'],
  },
  {
    title: 'Cartelería y Señalética',
    description: 'Administra proyectos de cartelería con múltiples materiales y estructuras.',
    icon: 'Box',
    benefits: ['Materiales rígidos', 'Instalación', 'Proyectos complejos'],
  },
  {
    title: 'Sublimación y Textil',
    description: 'Gestiona producción textil con control de tamaños, colores y diseños.',
    icon: 'Shirt',
    benefits: ['Gestión de tallas', 'Colores ilimitados', 'Tiempos de producción'],
  },
] as const;

export const SOCIAL_LINKS = {
  facebook: '#',
  instagram: '#',
  linkedin: '#',
  twitter: '#',
} as const;

export const CONTACT = {
  email: 'contacto@graficainteligente.com',
  phone: '+54 11 1234-5678',
  address: 'Buenos Aires, Argentina',
} as const;
