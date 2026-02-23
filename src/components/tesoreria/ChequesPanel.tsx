import { useMemo, useState } from 'react';
import { AlertTriangle, ArrowRightLeft, Edit2, Plus, Trash2, Wallet } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/card';
import { Table } from '../ui/Table';
import { Badge } from '../ui/Badge';
import { useCheques } from '../../hooks/useCheques';
import { CreateChequeModal, type ChequeFormSubmitData } from './CreateChequeModal';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import { useToast } from '../../contexts/ToastContext';
import type { Cheque, ChequeDirection } from '../../types/database';
import { formatDateDisplay, getArgentinaDate, parseArgentinaDate } from '../../utils/dates';

type AgingBucket = 'vencido' | 'hoy' | 'proximos_7' | 'dias_8_15' | 'dias_16_30' | 'mas_30';

interface AgingBreakdownItem {
  key: AgingBucket;
  label: string;
  amount: number;
  colorClass: string;
}

export function ChequesPanel() {
  const { cheques, loading, error, createCheque, updateCheque, deleteCheque, refetch } = useCheques();
  const { confirm } = useConfirmDialog();
  const { showSuccess, showError } = useToast();

  const [activeTab, setActiveTab] = useState<ChequeDirection>('emitido');
  const [showModal, setShowModal] = useState(false);
  const [chequeToEdit, setChequeToEdit] = useState<Cheque | null>(null);

  const filteredCheques = useMemo(() => {
    return cheques.filter((c) => (c.direction || 'emitido') === activeTab);
  }, [cheques, activeTab]);

  const pendingEmitidos = useMemo(
    () => cheques.filter((c) => (c.direction || 'emitido') === 'emitido' && c.estado === 'pendiente'),
    [cheques]
  );

  const totalPendiente = useMemo(
    () => filteredCheques.filter((c) => c.estado === 'pendiente').reduce((acc, curr) => acc + curr.monto, 0),
    [filteredCheques]
  );

  const totalPendienteEmitidos = useMemo(
    () => pendingEmitidos.reduce((acc, curr) => acc + curr.monto, 0),
    [pendingEmitidos]
  );

  const agingBreakdown = useMemo<AgingBreakdownItem[]>(() => {
    const today = getArgentinaDate().startOf('day');
    const buckets: Record<AgingBucket, number> = {
      vencido: 0,
      hoy: 0,
      proximos_7: 0,
      dias_8_15: 0,
      dias_16_30: 0,
      mas_30: 0,
    };

    for (const cheque of pendingEmitidos) {
      const dueDate = parseArgentinaDate(cheque.fecha_pago).startOf('day');
      const diffDays = dueDate.diff(today, 'day');

      if (diffDays < 0) buckets.vencido += cheque.monto;
      else if (diffDays === 0) buckets.hoy += cheque.monto;
      else if (diffDays <= 7) buckets.proximos_7 += cheque.monto;
      else if (diffDays <= 15) buckets.dias_8_15 += cheque.monto;
      else if (diffDays <= 30) buckets.dias_16_30 += cheque.monto;
      else buckets.mas_30 += cheque.monto;
    }

    return [
      { key: 'vencido', label: 'Vencido', amount: buckets.vencido, colorClass: 'bg-red-50 border-red-200 text-red-700' },
      { key: 'hoy', label: 'Hoy', amount: buckets.hoy, colorClass: 'bg-amber-50 border-amber-200 text-amber-700' },
      { key: 'proximos_7', label: 'Próx. 7 días', amount: buckets.proximos_7, colorClass: 'bg-orange-50 border-orange-200 text-orange-700' },
      { key: 'dias_8_15', label: '8-15 días', amount: buckets.dias_8_15, colorClass: 'bg-slate-50 border-slate-200 text-slate-700' },
      { key: 'dias_16_30', label: '16-30 días', amount: buckets.dias_16_30, colorClass: 'bg-slate-50 border-slate-200 text-slate-700' },
      { key: 'mas_30', label: '+30 días', amount: buckets.mas_30, colorClass: 'bg-slate-50 border-slate-200 text-slate-700' },
    ];
  }, [pendingEmitidos]);

  const handleEdit = (cheque: Cheque) => {
    setChequeToEdit(cheque);
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (
      await confirm({
        title: 'Eliminar Cheque',
        message: '¿Estás seguro? Se eliminará de la proyección financiera.',
        confirmText: 'Eliminar',
        type: 'danger',
      })
    ) {
      try {
        await deleteCheque(id);
        showSuccess('Cheque eliminado');
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'No se pudo eliminar el cheque.';
        showError(msg);
      }
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setChequeToEdit(null);
  };

  const handleFormSubmit = async (data: ChequeFormSubmitData) => {
    if (chequeToEdit) {
      await updateCheque(chequeToEdit.id, data);
      showSuccess('Cheque actualizado');
    } else {
      await createCheque(data);
      showSuccess('Cheque creado');
    }
    handleCloseModal();
  };

  const getStatusColor = (status: string, fechaPago: string) => {
    if (status === 'pagado') return 'success';
    if (status === 'anulado') return 'default';
    if (status === 'vencido') return 'danger';

    const today = getArgentinaDate().startOf('day');
    const dueDate = parseArgentinaDate(fechaPago).startOf('day');
    const diffDays = dueDate.diff(today, 'day');

    if (diffDays < 0) return 'danger';
    if (diffDays <= 3) return 'warning';
    return 'primary';
  };

  const columns = [
    {
      key: 'fecha_pago',
      header: 'Fecha Pago',
      render: (item: Cheque) => (
        <div className="flex flex-col">
          <span className="font-medium text-gray-900">{formatDateDisplay(item.fecha_pago)}</span>
          <span className="text-xs text-gray-500">Emisión: {formatDateDisplay(item.fecha_emision)}</span>
        </div>
      ),
    },
    {
      key: 'numero',
      header: 'Número / Banco',
      render: (item: Cheque) => (
        <div>
          <div className="flex items-center gap-1 font-medium text-gray-900">
            {item.tipo === 'echeq' ? (
              <span className="rounded border border-purple-200 px-1 text-xs text-purple-600">E-CHEQ</span>
            ) : null}
            {item.numero_cheque}
          </div>
          <div className="text-xs uppercase text-gray-500">{item.banco}</div>
        </div>
      ),
    },
    {
      key: 'beneficiario',
      header: activeTab === 'emitido' ? 'Beneficiario' : 'Recibido De',
      render: (item: Cheque) => (
        <div>
          <div className="text-sm text-gray-900">
            {activeTab === 'emitido'
              ? item.destinatario || item.provider?.nombre_fantasia
              : item.client?.nombre_fantasia || item.client?.razon_social || item.destinatario}
          </div>
          {item.descripcion && <div className="text-xs italic text-gray-500">{item.descripcion}</div>}
        </div>
      ),
    },
    {
      key: 'monto',
      header: 'Monto',
      render: (item: Cheque) => (
        <div className={`font-bold ${activeTab === 'recibido' ? 'text-green-600' : 'text-gray-900'}`}>
          ${item.monto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
        </div>
      ),
    },
    {
      key: 'estado',
      header: 'Estado',
      render: (item: Cheque) => {
        const variant = getStatusColor(item.estado, item.fecha_pago);
        return (
          <Badge variant={variant === 'default' ? undefined : (variant as any)}>
            {item.estado.toUpperCase()}
          </Badge>
        );
      },
    },
    {
      key: 'actions',
      header: '',
      render: (item: Cheque) => (
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => handleEdit(item)}>
            <Edit2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="text-red-500" onClick={() => handleDelete(item.id)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Cartera de Cheques</h2>
          <p className="text-gray-500">Gestión de valores {activeTab === 'emitido' ? 'a pagar' : 'a cobrar'}</p>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 rounded-lg border border-orange-100 bg-orange-50 px-4 py-2">
            <AlertTriangle className="h-4 w-4 text-orange-600" />
            <div>
              <span className="block text-xs font-bold uppercase text-orange-600">
                {activeTab === 'emitido' ? 'Total pendiente a pagar' : 'Total pendiente acreditación'}
              </span>
              <span className="text-lg font-bold text-orange-700">
                ${totalPendiente.toLocaleString('es-AR', { maximumFractionDigits: 0 })}
              </span>
            </div>
          </div>
          <Button onClick={() => setShowModal(true)}>
            <Plus className="mr-2 h-4 w-4" />
            {activeTab === 'emitido' ? 'Nuevo Pago' : 'Nuevo Cobro'}
          </Button>
        </div>
      </div>

      {activeTab === 'emitido' && (
        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-700">
              Pendiente a pagar por tramos
            </h3>
            <span className="text-xs text-gray-500">
              Total pendiente: ${totalPendienteEmitidos.toLocaleString('es-AR', { maximumFractionDigits: 0 })}
            </span>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-6">
            {agingBreakdown.map((bucket) => {
              const pct = totalPendienteEmitidos > 0 ? (bucket.amount / totalPendienteEmitidos) * 100 : 0;
              return (
                <div key={bucket.key} className={`rounded-lg border p-3 ${bucket.colorClass}`}>
                  <div className="text-xs font-semibold uppercase">{bucket.label}</div>
                  <div className="mt-1 text-base font-bold">
                    ${bucket.amount.toLocaleString('es-AR', { maximumFractionDigits: 0 })}
                  </div>
                  <div className="mt-0.5 text-xs opacity-80">{pct.toFixed(1)}%</div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <div className="mb-4 flex border-b border-gray-200">
        <button
          className={`flex items-center gap-2 border-b-2 px-4 pb-3 text-sm font-medium transition-colors ${
            activeTab === 'emitido'
              ? 'border-gray-900 text-gray-900'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('emitido')}
        >
          <ArrowRightLeft className="h-4 w-4" />
          Cheques Emitidos (Pagos)
        </button>
        <button
          className={`flex items-center gap-2 border-b-2 px-4 pb-3 text-sm font-medium transition-colors ${
            activeTab === 'recibido'
              ? 'border-green-600 text-green-700'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('recibido')}
        >
          <Wallet className="h-4 w-4" />
          Cheques Recibidos (Cobros)
        </button>
      </div>

      <Card>
        {loading ? (
          <div className="p-8 text-center text-gray-500">Cargando...</div>
        ) : error ? (
          <div className="space-y-3 p-6 text-center">
            <p className="text-sm text-red-600">No se pudo cargar la cartera de cheques.</p>
            <p className="text-xs text-gray-500">{error}</p>
            <Button variant="secondary" onClick={refetch}>
              Reintentar
            </Button>
          </div>
        ) : filteredCheques.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <Wallet className="mx-auto mb-3 h-12 w-12 opacity-20" />
            <p>No hay cheques {activeTab === 'emitido' ? 'emitidos' : 'recibidos'} registrados.</p>
            <Button variant="ghost" onClick={() => setShowModal(true)}>
              Registrar el primero
            </Button>
          </div>
        ) : (
          <Table columns={columns} data={filteredCheques} keyExtractor={(i) => i.id} />
        )}
      </Card>

      <CreateChequeModal
        isOpen={showModal}
        onClose={handleCloseModal}
        onSubmit={handleFormSubmit}
        chequeToEdit={chequeToEdit}
      />
    </div>
  );
}
