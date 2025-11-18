import { Check } from 'lucide-react';
import { AVAILABLE_PERMISSIONS, type ModulePermissions, type PermissionAction } from '../../constants/permissions';

interface PermissionsMatrixProps {
  permissions: ModulePermissions;
  onChange: (permissions: ModulePermissions) => void;
}

export function PermissionsMatrix({ permissions, onChange }: PermissionsMatrixProps) {
  const handlePermissionChange = (moduleId: string, action: PermissionAction, value: boolean) => {
    onChange({
      ...permissions,
      [moduleId]: {
        ...permissions[moduleId],
        [action]: value,
      },
    });
  };

  const handleSelectAll = (moduleId: string) => {
    onChange({
      ...permissions,
      [moduleId]: {
        view: true,
        create: true,
        edit: true,
        delete: true,
      },
    });
  };

  const handleDeselectAll = (moduleId: string) => {
    onChange({
      ...permissions,
      [moduleId]: {
        view: false,
        create: false,
        edit: false,
        delete: false,
      },
    });
  };

  const isAllSelected = (moduleId: string) => {
    const modulePerms = permissions[moduleId];
    return modulePerms?.view && modulePerms?.create && modulePerms?.edit && modulePerms?.delete;
  };

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Módulo
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Ver
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Crear
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Editar
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Eliminar
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {AVAILABLE_PERMISSIONS.map((permission) => {
              const modulePerms = permissions[permission.moduleId] || {
                view: false,
                create: false,
                edit: false,
                delete: false,
              };

              return (
                <tr key={permission.moduleId} className="hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                    {permission.moduleName}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <input
                      type="checkbox"
                      checked={modulePerms.view}
                      onChange={(e) =>
                        handlePermissionChange(permission.moduleId, 'view', e.target.checked)
                      }
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <input
                      type="checkbox"
                      checked={modulePerms.create}
                      onChange={(e) =>
                        handlePermissionChange(permission.moduleId, 'create', e.target.checked)
                      }
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <input
                      type="checkbox"
                      checked={modulePerms.edit}
                      onChange={(e) =>
                        handlePermissionChange(permission.moduleId, 'edit', e.target.checked)
                      }
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <input
                      type="checkbox"
                      checked={modulePerms.delete}
                      onChange={(e) =>
                        handlePermissionChange(permission.moduleId, 'delete', e.target.checked)
                      }
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-4 py-3 text-center">
                    {isAllSelected(permission.moduleId) ? (
                      <button
                        type="button"
                        onClick={() => handleDeselectAll(permission.moduleId)}
                        className="text-xs text-red-600 hover:text-red-700 font-medium"
                      >
                        Ninguno
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleSelectAll(permission.moduleId)}
                        className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                      >
                        Todos
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
