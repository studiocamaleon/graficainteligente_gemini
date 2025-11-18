import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { usePermissions } from '../../hooks/usePermissions';

interface ProtectedModuleRouteProps {
  children: ReactNode;
  moduleId: string;
}

export function ProtectedModuleRoute({ children, moduleId }: ProtectedModuleRouteProps) {
  const { canAccessModule, loading } = usePermissions();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600">Verificando permisos...</p>
        </div>
      </div>
    );
  }

  if (!canAccessModule(moduleId)) {
    return <Navigate to="/app/dashboard" replace />;
  }

  return <>{children}</>;
}
