import { useState, useMemo } from 'react';
import { FileText, Download, Filter } from 'lucide-react';
import { Card } from '../../../components/ui/card';
import { Button } from '../../../components/ui/Button';
import { Table } from '../../../components/ui/Table';
import { Badge } from '../../../components/ui/Badge';
import { EmptyState } from '../../../components/ui/EmptyState';
import { useAuditLog } from '../../../hooks/useAuditLog';
import type { AuditLogWithUser } from '../../../hooks/useAuditLog';

export function AuditLogTab() {
  const { logs, loading } = useAuditLog();
  const [showFilters, setShowFilters] = useState(false);

  const getActionBadgeColor = (action: string) => {
    if (action.includes('create') || action.includes('add')) return 'green';
    if (action.includes('update') || action.includes('edit')) return 'blue';
    if (action.includes('delete') || action.includes('remove')) return 'red';
    if (action.includes('login')) return 'gray';
    return 'gray';
  };

  const formatAction = (action: string) => {
    const actions: Record<string, string> = {
      'user_created': 'Usuario creado',
      'user_updated': 'Usuario actualizado',
      'user_deleted': 'Usuario eliminado',
      'role_created': 'Rol creado',
      'role_updated': 'Rol actualizado',
      'role_deleted': 'Rol eliminado',
      'password_reset': 'Contraseña restablecida',
      'login': 'Inicio de sesión',
      'logout': 'Cierre de sesión',
    };

    return actions[action] || action;
  };

  const exportLogs = () => {
    const csv = [
      ['Fecha', 'Usuario', 'Acción', 'Módulo', 'IP'].join(','),
      ...logs.map((log) =>
        [
          new Date(log.created_at).toLocaleString('es-ES'),
          log.user?.full_name || 'Sistema',
          formatAction(log.action),
          log.module_id || '-',
          log.ip_address || '-',
        ].join(',')
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `auditoria-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const columns = useMemo(
    () => [
      {
        key: 'created_at',
        header: 'Fecha y Hora',
        render: (log: AuditLogWithUser) => (
          <div className="text-sm text-gray-900">
            {new Date(log.created_at).toLocaleDateString('es-ES', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
            })}
            <div className="text-xs text-gray-500">
              {new Date(log.created_at).toLocaleTimeString('es-ES', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </div>
          </div>
        ),
      },
      {
        key: 'user_id',
        header: 'Usuario',
        render: (log: AuditLogWithUser) => (
          <div>
            <div className="text-sm font-medium text-gray-900">
              {log.user?.full_name || 'Sistema'}
            </div>
            {log.user?.email && (
              <div className="text-xs text-gray-500">{log.user.email}</div>
            )}
          </div>
        ),
      },
      {
        key: 'action',
        header: 'Acción',
        render: (log: AuditLogWithUser) => (
          <Badge variant={getActionBadgeColor(log.action) as any}>
            {formatAction(log.action)}
          </Badge>
        ),
      },
      {
        key: 'module_id',
        header: 'Módulo',
        render: (log: AuditLogWithUser) => (
          <div className="text-sm text-gray-600">
            {log.module_id || '-'}
          </div>
        ),
      },
      {
        key: 'ip_address',
        header: 'Dirección IP',
        render: (log: AuditLogWithUser) => (
          <div className="text-sm text-gray-600 font-mono">
            {log.ip_address || '-'}
          </div>
        ),
      },
    ],
    []
  );

  if (loading) {
    return (
      <Card>
        <div className="text-center py-12 text-gray-500">Cargando registros...</div>
      </Card>
    );
  }

  if (logs.length === 0) {
    return (
      <Card padding="none">
        <EmptyState
          icon={FileText}
          title="No hay registros de auditoría"
          description="Los registros de actividad aparecerán aquí conforme se realicen acciones en el sistema"
        />
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Registro de Auditoría</h3>
          <p className="text-sm text-gray-500 mt-1">
            {logs.length} {logs.length === 1 ? 'registro' : 'registros'} en total
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            variant="secondary"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="w-4 h-4 mr-2" />
            Filtros
          </Button>
          <Button variant="secondary" onClick={exportLogs}>
            <Download className="w-4 h-4 mr-2" />
            Exportar CSV
          </Button>
        </div>
      </div>

      {showFilters && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-600">
            Los filtros avanzados estarán disponibles próximamente
          </p>
        </div>
      )}

      <Table
        columns={columns}
        data={logs}
        keyExtractor={(log) => log.id}
      />
    </Card>
  );
}
