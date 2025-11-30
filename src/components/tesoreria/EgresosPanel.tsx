import { useState } from 'react';
import { Plus, Filter, Trash2, Calendar, DollarSign, User, FileText, Eye, X } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Table } from '../ui/Table';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { RegistrarEgresoModal } from './RegistrarEgresoModal';
import { useEgresos } from '../../hooks/useEgresos';
import { useCajas } from '../../hooks/useCajas';
import { useTiposEgreso } from '../../hooks/useTiposEgreso';
import { useToast } from '../../contexts/ToastContext';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export function EgresosPanel() {
  const { showSuccess, showError } = useToast();
  const { confirm } = useConfirmDialog();
  const { cajas } = useCajas();
  const { tipos } = useTiposEgreso();

  const [showModal, setShowModal] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    fecha_desde: '',
    fecha_hasta: '',
    caja_id: '',
    tipo_egreso_id: '',
  });

  const { egresos, loading, total, createEgreso, deleteEgreso, refetch } = useEgresos(filters);

  const handleDelete = async (id: string) => {
    const confirmed = await confirm({
      title: 'Eliminar egreso',
      message: '¿Estás seguro de eliminar este egreso? Esta acción no se puede deshacer y el movimiento de caja será eliminado.',
      confirmText: 'Eliminar',
      type: 'danger',
    });

    if (confirmed) {
      try {
        await deleteEgreso(id);
        showSuccess('Egreso eliminado correctamente');
      } catch (error: any) {
        showError(error.message || 'Error al eliminar el egreso');
      }
    }
  };

  const clearFilters = () => {
    setFilters({
      fecha_desde: '',
      fecha_hasta: '',
      caja_id: '',
      tipo_egreso_id: '',
    });
  };

  const [detalleEgreso, setDetalleEgreso] = useState<any>(null);

  const columns = [
    {
      key: 'fecha',
      header: 'Fecha',
      render: (egreso: any) => (
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gray-400" />
          <span className="font-medium">
            {format(new Date(egreso.fecha), 'dd MMM yyyy', { locale: es })}
          </span>
        </div>
      ),
    },
    {
      key: 'concepto',
      header: 'Concepto',
      render: (egreso: any) => (
        <Badge
          variant="outline"
          style={{
            borderColor: egreso.tipo_egreso?.color || '#64748b',
            color: egreso.tipo_egreso?.color || '#64748b',
          }}
        >
          {egreso.tipo_egreso?.nombre}
        </Badge>
      ),
    },
    {
      key: 'proveedor',
      header: 'Proveedor',
      render: (egreso: any) => (
        egreso.proveedor?.nombre_fantasia || egreso.proveedor_nombre ? (
          <div className="text-sm text-gray-700 flex items-center gap-1">
            <User className="w-4 h-4 text-gray-400" />
            {egreso.proveedor?.nombre_fantasia || egreso.proveedor_nombre}
          </div>
        ) : (
          <span className="text-gray-400 text-sm">-</span>
        )
      ),
    },
    {
      key: 'caja',
      header: 'Caja',
      render: (egreso: any) => (
        <div className="text-sm">
          <div className="font-medium">{egreso.caja?.nombre}</div>
          <div className="text-gray-500">{egreso.caja?.tipo}</div>
        </div>
      ),
    },
    {
      key: 'monto',
      header: 'Monto',
      render: (egreso: any) => (
        <div className="flex items-center gap-2 text-red-600 font-semibold">
          <DollarSign className="w-4 h-4" />
          <span>
            -${Number(egreso.monto).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
          </span>
        </div>
      ),
    },
    {
      key: 'comprobante',
      header: 'Comprobante',
      render: (egreso: any) => (
        egreso.numero_comprobante ? (
          <div className="flex items-center gap-1 text-sm text-gray-600">
            <FileText className="w-4 h-4" />
            {egreso.numero_comprobante}
          </div>
        ) : (
          <span className="text-gray-400 text-sm">-</span>
        )
      ),
    },
    {
      key: 'detalle',
      header: 'Detalle',
      render: (egreso: any) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setDetalleEgreso(egreso)}
          className="text-blue-600 hover:bg-blue-50"
        >
          <Eye className="w-4 h-4" />
        </Button>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (egreso: any) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleDelete(egreso.id)}
          className="text-red-600 hover:bg-red-50"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Egresos</h2>
          <p className="text-sm text-gray-600 mt-1">
            Total del período: ${total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2"
          >
            <Filter className="w-4 h-4" />
            {showFilters ? 'Ocultar' : 'Filtros'}
          </Button>
          <Button onClick={() => setShowModal(true)} className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Registrar Egreso
          </Button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <Card className="p-4">
          <div className="grid grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Desde
              </label>
              <Input
                type="date"
                value={filters.fecha_desde}
                onChange={(e) => setFilters({ ...filters, fecha_desde: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Hasta
              </label>
              <Input
                type="date"
                value={filters.fecha_hasta}
                onChange={(e) => setFilters({ ...filters, fecha_hasta: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Caja
              </label>
              <Select
                value={filters.caja_id}
                onChange={(value) => setFilters({ ...filters, caja_id: value })}
              >
                <option value="">Todas</option>
                {cajas.map((caja) => (
                  <option key={caja.id} value={caja.id}>
                    {caja.nombre}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Concepto
              </label>
              <Select
                value={filters.tipo_egreso_id}
                onChange={(value) => setFilters({ ...filters, tipo_egreso_id: value })}
              >
                <option value="">Todos</option>
                {tipos.map((tipo) => (
                  <option key={tipo.id} value={tipo.id}>
                    {tipo.nombre}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div className="flex justify-end mt-4">
            <Button variant="ghost" onClick={clearFilters}>
              Limpiar filtros
            </Button>
          </div>
        </Card>
      )}

      {/* Table */}
      <Card>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : egresos.length === 0 ? (
          <div className="text-center py-12">
            <DollarSign className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No hay egresos registrados
            </h3>
            <p className="text-gray-600 mb-4">
              Comienza registrando tu primer egreso
            </p>
            <Button onClick={() => setShowModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Registrar Egreso
            </Button>
          </div>
        ) : (
          <Table columns={columns} data={egresos} keyExtractor={(egreso) => egreso.id} />
        )}
      </Card>

      {/* Modal Registro */}
      <RegistrarEgresoModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={refetch}
        onSubmit={createEgreso}
      />

      {/* Modal Detalle */}
      {detalleEgreso && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full">
            <div className="flex items-center justify-between p-6 border-b">
              <h3 className="text-lg font-semibold text-gray-900">Detalle del Egreso</h3>
              <button
                onClick={() => setDetalleEgreso(null)}
                className="text-gray-400 hover:text-gray-600 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Concepto</label>
                <p className="mt-1 text-gray-900 font-medium">{detalleEgreso.tipo_egreso?.nombre}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Detalle</label>
                <p className="mt-1 text-gray-900">{detalleEgreso.concepto}</p>
              </div>
              {(detalleEgreso.proveedor?.nombre_fantasia || detalleEgreso.proveedor_nombre) && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Proveedor</label>
                  <p className="mt-1 text-gray-900">
                    {detalleEgreso.proveedor?.nombre_fantasia || detalleEgreso.proveedor_nombre}
                  </p>
                  {detalleEgreso.proveedor?.razon_social && (
                    <p className="text-sm text-gray-500">{detalleEgreso.proveedor.razon_social}</p>
                  )}
                </div>
              )}
              {detalleEgreso.numero_comprobante && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Comprobante</label>
                  <p className="mt-1 text-gray-900">{detalleEgreso.numero_comprobante}</p>
                </div>
              )}
              {detalleEgreso.medio_pago && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Medio de Pago</label>
                  <p className="mt-1 text-gray-900 capitalize">{detalleEgreso.medio_pago}</p>
                </div>
              )}
              {detalleEgreso.notas && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Notas</label>
                  <p className="mt-1 text-gray-900">{detalleEgreso.notas}</p>
                </div>
              )}
              <div className="pt-4 border-t">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-500">Monto</span>
                  <span className="text-2xl font-bold text-red-600">
                    -${Number(detalleEgreso.monto).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex justify-end p-6 border-t">
              <Button variant="secondary" onClick={() => setDetalleEgreso(null)}>
                Cerrar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
