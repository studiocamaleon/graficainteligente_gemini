import {
  LayoutDashboard,
  Users,
  Truck,
  Package,
  DollarSign,
  ClipboardList,
  Factory,
  Settings,
  Shield,
  Puzzle,
  Wrench,
  MapPin,
  TrendingUp,
  Database,
  Cpu,
  Box,
  GitBranch,
  Layers,
  Zap,
  Sparkles,
  Tag,
  Printer,
  Maximize2,
  Percent,
  FilePlus,
  List,
  Blocks,
  Scissors,
} from 'lucide-react';

export interface SubModule {
  id: string;
  name: string;
  description: string;
  path: string;
  icon?: typeof LayoutDashboard;
}

export interface Module {
  id: string;
  name: string;
  description: string;
  icon: typeof LayoutDashboard;
  path: string;
  color: string;
  children?: SubModule[];
}

export const MODULES: Module[] = [
  {
    id: 'dashboard',
    name: 'Dashboard',
    description: 'Visión general de tu negocio',
    icon: LayoutDashboard,
    path: '/app/dashboard',
    color: 'text-blue-600',
  },
  {
    id: 'clients',
    name: 'Clientes',
    description: 'Gestión de clientes y contactos',
    icon: Users,
    path: '/app/clients',
    color: 'text-green-600',
  },
  {
    id: 'providers',
    name: 'Proveedores',
    description: 'Administra tus proveedores',
    icon: Truck,
    path: '/app/providers',
    color: 'text-orange-600',
  },
  {
    id: 'abm-core',
    name: 'ABM Core',
    description: 'Gestión de datos maestros',
    icon: Database,
    path: '/app/abm-core',
    color: 'text-violet-600',
    children: [
      {
        id: 'abm-core-estaciones',
        name: 'Estaciones de Trabajo',
        description: 'Gestión de estaciones de trabajo',
        path: '/app/abm-core/estaciones',
        icon: Factory,
      },
      {
        id: 'abm-core-tecnologias',
        name: 'Tecnologías',
        description: 'Gestión de tecnologías de impresión',
        path: '/app/abm-core/tecnologias',
        icon: Cpu,
      },
      {
        id: 'abm-core-materiales',
        name: 'Materiales',
        description: 'Gestión de materiales y sustratos',
        path: '/app/abm-core/materiales',
        icon: Box,
      },
      {
        id: 'abm-core-pasos',
        name: 'Pasos',
        description: 'Gestión de pasos de producción',
        path: '/app/abm-core/pasos',
        icon: GitBranch,
      },
      {
        id: 'abm-core-rutas-produccion',
        name: 'Rutas de Producción',
        description: 'Gestión de rutas de producción',
        path: '/app/abm-core/rutas-produccion',
        icon: Layers,
      },
      {
        id: 'abm-core-servicios',
        name: 'Servicios',
        description: 'Gestión de servicios adicionales',
        path: '/app/abm-core/servicios',
        icon: Zap,
      },
      {
        id: 'abm-core-acabados',
        name: 'Acabados',
        description: 'Gestión de acabados y terminaciones',
        path: '/app/abm-core/acabados',
        icon: Sparkles,
      },
      {
        id: 'abm-core-rangos-precio',
        name: 'Rangos de Precio',
        description: 'Gestión de rangos de precio y descuentos',
        path: '/app/abm-core/rangos-precio',
        icon: Percent,
      },
    ],
  },
  {
    id: 'productos',
    name: 'Productos',
    description: 'Catálogo de productos',
    icon: Package,
    path: '/app/productos',
    color: 'text-purple-600',
    children: [
      {
        id: 'productos-impresion-laser',
        name: 'Impresión Laser',
        description: 'Productos de impresión digital laser',
        path: '/app/productos/impresion-laser',
        icon: Printer,
      },
      {
        id: 'productos-gran-formato',
        name: 'Gran Formato',
        description: 'Productos de impresión gran formato',
        path: '/app/productos/gran-formato',
        icon: Maximize2,
      },
      {
        id: 'productos-materiales-rigidos',
        name: 'Materiales Rígidos',
        description: 'Productos de materiales rígidos',
        path: '/app/productos/materiales-rigidos',
        icon: Blocks,
      },
      {
        id: 'productos-plotter-corte',
        name: 'Plotter de Corte',
        description: 'Productos para plotter de corte',
        path: '/app/productos/plotter-corte',
        icon: Scissors,
      },
    ],
  },
  {
    id: 'orders',
    name: 'Órdenes de Trabajo',
    description: 'Gestión de órdenes y proyectos',
    icon: ClipboardList,
    path: '/app/orders',
    color: 'text-cyan-600',
    children: [
      {
        id: 'orders-crear',
        name: 'Crear OT',
        description: 'Crear nueva orden de trabajo',
        path: '/app/orders/crear-ot',
        icon: FilePlus,
      },
      {
        id: 'orders-lista',
        name: 'Ver Órdenes',
        description: 'Listado de órdenes de trabajo',
        path: '/app/orders/ordenes',
        icon: List,
      },
    ],
  },
  {
    id: 'production',
    name: 'Producción',
    description: 'Control de producción',
    icon: Factory,
    path: '/app/production',
    color: 'text-red-600',
  },
  {
    id: 'finance',
    name: 'Finanzas',
    description: 'Finanzas y contabilidad',
    icon: TrendingUp,
    path: '/app/finanzas',
    color: 'text-yellow-600',
  },
  {
    id: 'team',
    name: 'Equipo y Seguridad',
    description: 'Usuarios, roles y permisos',
    icon: Shield,
    path: '/app/team',
    color: 'text-pink-600',
  },
  {
    id: 'integrations',
    name: 'Integraciones',
    description: 'Conecta con otras plataformas',
    icon: Puzzle,
    path: '/app/integrations',
    color: 'text-indigo-600',
  },
  {
    id: 'settings',
    name: 'Configuración del Sistema',
    description: 'Ajustes generales',
    icon: Wrench,
    path: '/app/settings',
    color: 'text-gray-600',
    children: [
      {
        id: 'settings-locations',
        name: 'Ubicaciones',
        description: 'Gestión de países, provincias y ciudades',
        path: '/app/settings/locations',
        icon: MapPin,
      },
    ],
  },
];
