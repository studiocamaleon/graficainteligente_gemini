import { MODULES } from './modules';

export type PermissionAction = 'view' | 'create' | 'edit' | 'delete';

export interface Permission {
  moduleId: string;
  moduleName: string;
  actions: PermissionAction[];
}

export interface ModulePermissions {
  [moduleId: string]: {
    [action in PermissionAction]: boolean;
  };
}

export function generatePermissionsFromModules(): Permission[] {
  const permissions: Permission[] = [];

  const processModule = (module: typeof MODULES[0]) => {
    permissions.push({
      moduleId: module.id,
      moduleName: module.name,
      actions: ['view', 'create', 'edit', 'delete'],
    });

    if (module.children) {
      module.children.forEach((subModule) => {
        permissions.push({
          moduleId: subModule.id,
          moduleName: `${module.name} > ${subModule.name}`,
          actions: ['view', 'create', 'edit', 'delete'],
        });
      });
    }
  };

  MODULES.forEach(processModule);

  return permissions;
}

export const AVAILABLE_PERMISSIONS = generatePermissionsFromModules();

export const PREDEFINED_ROLES = {
  super_admin: {
    name: 'Super Administrador',
    description: 'Acceso completo a todas las funcionalidades del sistema',
    permissions: {} as ModulePermissions,
  },
  admin: {
    name: 'Administrador',
    description: 'Acceso completo excepto gestión de equipo y seguridad',
    permissions: {} as ModulePermissions,
  },
  manager: {
    name: 'Gerente',
    description: 'Puede gestionar clientes, proveedores, órdenes y producción',
    permissions: {} as ModulePermissions,
  },
  operador_diseno: {
    name: 'Operador de Diseño',
    description: 'Acceso a órdenes, clientes, centro de copiado y visualización de productos',
    permissions: {} as ModulePermissions,
  },
  operador_taller: {
    name: 'Operador de Taller',
    description: 'Acceso al módulo de producción para ejecutar pasos y visualización de órdenes',
    permissions: {} as ModulePermissions,
  },
  viewer: {
    name: 'Visualizador',
    description: 'Solo puede ver información, sin permisos de edición',
    permissions: {} as ModulePermissions,
  },
};

AVAILABLE_PERMISSIONS.forEach((permission) => {
  PREDEFINED_ROLES.super_admin.permissions[permission.moduleId] = {
    view: true,
    create: true,
    edit: true,
    delete: true,
  };

  // Admin NO tiene acceso a 'team' ni a ningún submódulo de 'settings'
  const adminRestrictedModules = [
    'team',
    'settings',
    'settings-locations',
    'settings-cajas',
    'settings-medios-cobro',
    'settings-pausas'
  ];

  if (!adminRestrictedModules.includes(permission.moduleId)) {
    PREDEFINED_ROLES.admin.permissions[permission.moduleId] = {
      view: true,
      create: true,
      edit: true,
      delete: true,
    };
  }

  const managerAllowedModules = [
    'clients',
    'providers',
    'orders',
    'orders-crear',
    'orders-lista',
    'production',
    'productos',
    'productos-impresion-laser',
    'productos-talonarios',
    'productos-gran-formato',
    'productos-materiales-rigidos',
    'productos-plotter-corte',
    'productos-sellos',
    'productos-portabanners',
    'centro-copiado',
    'centro-copiado-configuracion',
    'centro-copiado-terminaciones',
    'centro-copiado-rangos-precio',
    'centro-copiado-precios',
    'centro-copiado-ordenes',
    'centro-copiado-ordenes-crear',
    'finance',
    'finance-tesoreria',
    'finance-cuentas-corrientes',
    'finance-reportes',
    'integrations',
    'integrations-whatsapp'
  ];

  if (managerAllowedModules.includes(permission.moduleId)) {
    PREDEFINED_ROLES.manager.permissions[permission.moduleId] = {
      view: true,
      create: true,
      edit: true,
      delete: true,
    };
  } else {
    PREDEFINED_ROLES.manager.permissions[permission.moduleId] = {
      view: permission.moduleId === 'dashboard',
      create: false,
      edit: false,
      delete: false,
    };
  }

  // Operador de Diseño: Acceso a clientes, órdenes, centro copiado, y visualización de productos
  const operadorDisenoFullAccessModules = [
    'clients',
    'orders',
    'orders-crear',
    'orders-lista',
    'centro-copiado',
    'centro-copiado-configuracion',
    'centro-copiado-terminaciones',
    'centro-copiado-rangos-precio',
    'centro-copiado-precios',
    'centro-copiado-ordenes',
    'centro-copiado-ordenes-crear'
  ];

  const operadorDisenoViewOnlyModules = [
    'dashboard',
    'productos',
    'productos-impresion-laser',
    'productos-talonarios',
    'productos-gran-formato',
    'productos-materiales-rigidos',
    'productos-plotter-corte',
    'productos-sellos',
    'productos-portabanners',
    'production'
  ];

  const operadorDisenoIntegracionesModules = [
    'integrations',
    'integrations-whatsapp'
  ];

  if (operadorDisenoFullAccessModules.includes(permission.moduleId)) {
    PREDEFINED_ROLES.operador_diseno.permissions[permission.moduleId] = {
      view: true,
      create: true,
      edit: true,
      delete: true,
    };
  } else if (operadorDisenoViewOnlyModules.includes(permission.moduleId)) {
    PREDEFINED_ROLES.operador_diseno.permissions[permission.moduleId] = {
      view: true,
      create: false,
      edit: false,
      delete: false,
    };
  } else if (operadorDisenoIntegracionesModules.includes(permission.moduleId)) {
    PREDEFINED_ROLES.operador_diseno.permissions[permission.moduleId] = {
      view: true,
      create: true,
      edit: false,
      delete: false,
    };
  } else {
    PREDEFINED_ROLES.operador_diseno.permissions[permission.moduleId] = {
      view: false,
      create: false,
      edit: false,
      delete: false,
    };
  }

  // Operador de Taller: Acceso a producción (full) y órdenes (solo lectura)
  const operadorTallerFullAccessModules = ['production'];
  const operadorTallerViewOnlyModules = [
    'dashboard',
    'orders',
    'orders-lista'
  ];

  if (operadorTallerFullAccessModules.includes(permission.moduleId)) {
    PREDEFINED_ROLES.operador_taller.permissions[permission.moduleId] = {
      view: true,
      create: true,
      edit: true,
      delete: false,
    };
  } else if (operadorTallerViewOnlyModules.includes(permission.moduleId)) {
    PREDEFINED_ROLES.operador_taller.permissions[permission.moduleId] = {
      view: true,
      create: false,
      edit: false,
      delete: false,
    };
  } else {
    PREDEFINED_ROLES.operador_taller.permissions[permission.moduleId] = {
      view: false,
      create: false,
      edit: false,
      delete: false,
    };
  }

  PREDEFINED_ROLES.viewer.permissions[permission.moduleId] = {
    view: !['team', 'settings', 'finance'].includes(permission.moduleId),
    create: false,
    edit: false,
    delete: false,
  };
});

export function hasPermission(
  userPermissions: ModulePermissions | undefined,
  moduleId: string,
  action: PermissionAction
): boolean {
  if (!userPermissions) return false;
  return userPermissions[moduleId]?.[action] ?? false;
}

export function canAccessModule(
  userPermissions: ModulePermissions | undefined,
  moduleId: string
): boolean {
  return hasPermission(userPermissions, moduleId, 'view');
}
