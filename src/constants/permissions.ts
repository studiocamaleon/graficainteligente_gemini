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
  operator: {
    name: 'Operador',
    description: 'Acceso de solo lectura y creación en módulos operativos',
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

  if (permission.moduleId === 'team') {
    PREDEFINED_ROLES.admin.permissions[permission.moduleId] = {
      view: true,
      create: true,
      edit: true,
      delete: true,
    };
  } else {
    PREDEFINED_ROLES.admin.permissions[permission.moduleId] = {
      view: true,
      create: true,
      edit: true,
      delete: true,
    };
  }

  if (['clients', 'providers', 'orders', 'production', 'catalog', 'pricing'].includes(permission.moduleId)) {
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

  if (['clients', 'providers', 'orders', 'production', 'catalog'].includes(permission.moduleId)) {
    PREDEFINED_ROLES.operator.permissions[permission.moduleId] = {
      view: true,
      create: true,
      edit: false,
      delete: false,
    };
  } else {
    PREDEFINED_ROLES.operator.permissions[permission.moduleId] = {
      view: permission.moduleId === 'dashboard',
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
