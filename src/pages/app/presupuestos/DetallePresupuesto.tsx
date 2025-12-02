import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle, AlertCircle } from 'lucide-react';
import { usePresupuesto } from '../../../hooks/usePresupuesto';
import { usePresupuestos } from '../../../hooks/usePresupuestos';
import { useConfirmDialog } from '../../../hooks/useConfirmDialog';
import { useCompany } from '../../../hooks/useCompany';
import { descargarPresupuestoPDF } from '../../../utils/pdfGenerators/presupuestoPDF';
import { Button } from '../../../components/ui/Button';
import { Tabs } from '../../../components/ui/Tabs';
import { Card } from '../../../components/ui/Card';
import { PresupuestoHeader } from '../../../components/presupuestos/PresupuestoHeader';
import { PresupuestoItemsTab } from '../../../components/presupuestos/PresupuestoItemsTab';
import { PresupuestoArchivosTab } from '../../../components/presupuestos/PresupuestoArchivosTab';
import { PresupuestoHistorialTab } from '../../../components/presupuestos/PresupuestoHistorialTab';
import { ConvertirPresupuestoModal } from '../../../components/presupuestos/ConvertirPresupuestoModal';

type TabId = 'items' | 'archivos' | 'historial';

export default function DetallePresupuesto() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showConfirm } = useConfirmDialog();

  const { presupuesto, loading, error } = usePresupuesto(id || '');
  const { deletePresupuesto, duplicarPresupuesto, enviarPresupuesto, enviarNotificacionPresupuesto, convertirAOrden } = usePresupuestos();
  const { company } = useCompany();

  const [activeTab, setActiveTab] = useState<TabId>('items');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showConvertirModal, setShowConvertirModal] = useState(false);

  const tabs = [
    { id: 'items' as TabId, label: 'Items', icon: null },
    { id: 'archivos' as TabId, label: 'Archivos', icon: null },
    { id: 'historial' as TabId, label: 'Historial', icon: null },
  ];

  const showSuccess = (message: string) => {
    setSuccessMessage(message);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const showError = (message: string) => {
    setErrorMessage(message);
    setTimeout(() => setErrorMessage(null), 5000);
  };

  const handleDelete = async () => {
    if (!presupuesto) return;

    const confirmed = await showConfirm({
      title: 'Eliminar presupuesto',
      message: `¿Estás seguro de eliminar "${presupuesto.numero_presupuesto}"? Esta acción no se puede deshacer.`,
      confirmText: 'Eliminar',
      cancelText: 'Cancelar',
      variant: 'danger',
    });

    if (confirmed) {
      const success = await deletePresupuesto(presupuesto.id);
      if (success) {
        showSuccess('Presupuesto eliminado correctamente');
        setTimeout(() => navigate('/app/presupuestos/lista'), 1500);
      } else {
        showError('Error al eliminar presupuesto');
      }
    }
  };

  const handleDuplicate = async () => {
    if (!presupuesto) return;

    const confirmed = await showConfirm({
      title: 'Duplicar presupuesto',
      message: `¿Deseas crear una copia de "${presupuesto.numero_presupuesto}"?`,
      confirmText: 'Duplicar',
      cancelText: 'Cancelar',
    });

    if (confirmed) {
      const result = await duplicarPresupuesto(presupuesto.id);
      if (result) {
        showSuccess('Presupuesto duplicado correctamente');
        setTimeout(() => navigate(`/app/presupuestos/${result.id}`), 1500);
      } else {
        showError('Error al duplicar presupuesto');
      }
    }
  };

  const handleEnviar = async () => {
    if (!presupuesto) return;

    const confirmed = await showConfirm({
      title: 'Enviar presupuesto',
      message: `¿Deseas marcar "${presupuesto.numero_presupuesto}" como enviado? Esto generará el tracking público y enviará una notificación por WhatsApp al cliente.`,
      confirmText: 'Enviar',
      cancelText: 'Cancelar',
    });

    if (confirmed) {
      const success = await enviarPresupuesto(presupuesto.id);
      if (success) {
        showSuccess('Presupuesto enviado. Notificación WhatsApp programada.');
      } else {
        showError('Error al enviar presupuesto');
      }
    }
  };

  const handleGenerarPDF = async () => {
    if (!presupuesto) return;

    try {
      await descargarPresupuestoPDF(presupuesto, company);
      showSuccess('PDF descargado correctamente');
    } catch (error) {
      showError('Error al generar PDF');
      console.error('Error generando PDF:', error);
    }
  };

  const handleConvertir = async (params: {
    fechaEntrega?: string;
    notasAdicionales?: string;
    copiarArchivos: boolean;
    montoPago?: number;
    medioCobroId?: string;
    referenciaPago?: string;
    rutasPersonalizadas?: Record<string, any[]>;
  }) => {
    if (!presupuesto) return;

    const ordenId = await convertirAOrden(presupuesto.id, params);
    if (ordenId) {
      showSuccess(`Orden creada desde presupuesto ${presupuesto.numero_presupuesto}`);
      navigate(`/app/orders/${ordenId}`);
    } else {
      showError('Error al convertir presupuesto');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !presupuesto) {
    return (
      <div className="space-y-6">
        <Button
          variant="ghost"
          onClick={() => navigate('/app/presupuestos/lista')}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver
        </Button>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <p className="text-sm text-red-800">
            {error || 'Presupuesto no encontrado'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Button
        variant="ghost"
        onClick={() => navigate('/app/presupuestos/lista')}
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Volver al listado
      </Button>

      {/* Success Message */}
      {successMessage && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-green-600" />
          <p className="text-sm text-green-800">{successMessage}</p>
        </div>
      )}

      {/* Error Message */}
      {errorMessage && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <p className="text-sm text-red-800">{errorMessage}</p>
        </div>
      )}

      {/* Header */}
      <PresupuestoHeader
        presupuesto={presupuesto}
        onDelete={handleDelete}
        onDuplicate={handleDuplicate}
        onEnviar={handleEnviar}
        onGenerarPDF={handleGenerarPDF}
        onConvertir={() => setShowConvertirModal(true)}
      />

      {/* Tabs */}
      <Card padding="none">
        <Tabs
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={(id) => setActiveTab(id as TabId)}
        />

        <div className="p-6">
          {activeTab === 'items' && (
            <PresupuestoItemsTab items={presupuesto.items || []} />
          )}

          {activeTab === 'archivos' && (
            <PresupuestoArchivosTab presupuestoId={presupuesto.id} />
          )}

          {activeTab === 'historial' && (
            <PresupuestoHistorialTab presupuestoId={presupuesto.id} />
          )}
        </div>
      </Card>

      {/* Modal Convertir */}
      <ConvertirPresupuestoModal
        isOpen={showConvertirModal}
        onClose={() => setShowConvertirModal(false)}
        presupuesto={presupuesto}
        onConvertir={handleConvertir}
      />
    </div>
  );
}
