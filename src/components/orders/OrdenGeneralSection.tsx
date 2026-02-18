import { useState, useEffect } from 'react';
import { MessageSquare, Globe, Store, User, Smartphone, Truck, Plus, Calendar, FileText } from 'lucide-react';
import { SearchableSelect } from '../ui/SearchableSelect';
import { DatePicker } from '../ui/DatePicker';
import { Tooltip } from '../ui/Tooltip';
import { Button } from '../ui/Button';
import { Label } from '../ui/Label';
import { Textarea } from '../ui/Textarea';
import { Select } from '../ui/Select';
import { Input } from '../ui/Input';
import { supabase } from '../../lib/supabase';

import { useClients } from '../../hooks/useClients';
import { useWorkload } from '../../hooks/useWorkload';
import type { CanalVenta, Client } from '../../types/database';
import { QuickClientModal } from '../clients/QuickClientModal';

interface OrdenGeneralSectionProps {
  clienteId: string;
  setClienteId: (id: string) => void;
  selectedClient?: Client;
  canalVenta: CanalVenta | '';
  setCanalVenta: (canal: CanalVenta | '') => void;
  fechaEntrega: string;
  setFechaEntrega: (fecha: string) => void;
  requiereDespacho?: boolean;
  setRequiereDespacho?: (requiere: boolean) => void;
  notasInternas: string;
  setNotasInternas: (notas: string) => void;
  requiereFactura: boolean;
  setRequiereFactura: (requiere: boolean) => void;
  usuarioLogueado: string;
  errors?: Record<string, string>;

  // New props for Budget Mode
  mode: 'orden' | 'presupuesto'; // "orden" | "presupuesto"
  onModeChange: (mode: 'orden' | 'presupuesto') => void;
  presupuestoValidez: string;
  setPresupuestoValidez: (date: string) => void;
  presupuestoCondiciones: string;
  setPresupuestoCondiciones: (text: string) => void;
  isEditing?: boolean;
}

export function OrdenGeneralSection({
  clienteId,
  setClienteId,
  selectedClient,
  canalVenta,
  setCanalVenta,
  fechaEntrega,
  setFechaEntrega,
  requiereDespacho = false,
  setRequiereDespacho,
  notasInternas,
  setNotasInternas,
  requiereFactura,
  setRequiereFactura,
  usuarioLogueado,
  errors = {},
  mode,
  onModeChange,
  presupuestoValidez,
  setPresupuestoValidez,
  presupuestoCondiciones,
  setPresupuestoCondiciones,
  isEditing = false
}: OrdenGeneralSectionProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const { clients, loading, refetch } = useClients({ searchTerm, itemsPerPage: 50 });

  const [showQuickClientModal, setShowQuickClientModal] = useState(false);
  const [newlyCreatedClients, setNewlyCreatedClients] = useState<Client[]>([]);

  // Estado para plantillas de condiciones
  const [plantillasCondiciones, setPlantillasCondiciones] = useState<{ id: string, nombre: string, contenido: string }[]>([]);
  const [selectedPlantilla, setSelectedPlantilla] = useState('');
  const [loadingPlantillas, setLoadingPlantillas] = useState(false);

  const canalesVenta: { value: CanalVenta; label: string; icon: any }[] = [
    { value: 'WhatsApp', label: 'WhatsApp', icon: MessageSquare },
    { value: 'Web', label: 'Web', icon: Globe },
    { value: 'Mostrador', label: 'Mostrador', icon: Store },
    { value: 'App Mobile', label: 'App Mobile', icon: Smartphone },
  ];

  const { workloadData } = useWorkload({ type: 'orden_trabajo' });

  useEffect(() => {
    if (mode === 'presupuesto') {
      loadCondiciones();
    }
  }, [mode]);

  const loadCondiciones = async () => {
    try {
      setLoadingPlantillas(true);
      const { data, error } = await supabase
        .from('presupuestos_condiciones_comerciales')
        .select('*')
        .eq('is_active', true)
        .order('orden', { ascending: true });

      if (error) throw error;

      setPlantillasCondiciones(data || []);

      // Seleccionar default si existe y no hay texto seteado
      if (!presupuestoCondiciones) {
        const defaultCond = data?.find((c: any) => c.es_default);
        if (defaultCond) {
          setSelectedPlantilla(defaultCond.id);
          setPresupuestoCondiciones(defaultCond.contenido);
        }
      }
    } catch (err) {
      console.error('Error cargando condiciones:', err);
    } finally {
      setLoadingPlantillas(false);
    }
  };

  const handlePlantillaChange = (id: string) => {
    setSelectedPlantilla(id);
    const plantilla = plantillasCondiciones.find(p => p.id === id);
    if (plantilla) {
      setPresupuestoCondiciones(plantilla.contenido);
    }
  };

  // Merge backend clients with locally created ones to ensure they appear even before refetch finishes
  const allClients = [...newlyCreatedClients, ...clients];
  // Deduplicate by ID just in case
  const uniqueClients = Array.from(new Map(allClients.map(item => [item.id, item])).values());

  const clientesOptions = uniqueClients.map(c => ({
    value: c.id,
    label: c.nombre_fantasia || c.razon_social,
    subtitle: c.nombre_fantasia ? c.razon_social : undefined,
  }));

  // Ensure selected client is always in options (for display purposes)
  if (selectedClient && !clientesOptions.find(o => o.value === selectedClient.id)) {
    clientesOptions.unshift({
      value: selectedClient.id,
      label: selectedClient.nombre_fantasia || selectedClient.razon_social,
      subtitle: selectedClient.nombre_fantasia ? selectedClient.razon_social : undefined,
    });
  }

  const handleClientCreated = (newClient: Client) => {
    setNewlyCreatedClients(prev => [newClient, ...prev]);
    setClienteId(newClient.id);
    // Optional: trigger search refresh if needed, but local update is instant
    // refetch(); 
  };

  return (
    <div className="p-6 space-y-6">

      {/* Mode Switcher */}
      {!isEditing && (
        <div className="flex justify-center mb-6">
          <div className="bg-gray-100 p-1 rounded-lg inline-flex shadow-inner">
            <button
              type="button"
              onClick={() => onModeChange('orden')}
              className={`px-6 py-2 rounded-md font-medium text-sm transition-all duration-200 ${mode === 'orden'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
                }`}
            >
              Orden de Trabajo
            </button>
            <button
              type="button"
              onClick={() => onModeChange('presupuesto')}
              className={`px-6 py-2 rounded-md font-medium text-sm transition-all duration-200 ${mode === 'presupuesto'
                ? 'bg-green-600 text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
                }`}
            >
              Presupuesto
            </button>
          </div>
        </div>
      )}

      <div className="border-b border-gray-200 pb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          {mode === 'orden'
            ? (isEditing ? 'Editar Orden de Trabajo' : 'Orden de Trabajo')
            : (isEditing ? 'Editar Presupuesto' : 'Nuevo Presupuesto')}
        </h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Cliente</label>
          <div className="flex gap-2">
            <div className="flex-1">
              <SearchableSelect
                // label="Cliente" // Managed externally for layout
                value={clienteId}
                onChange={(value) => setClienteId(value)}
                options={clientesOptions}
                placeholder="Buscar cliente por nombre..."
                loading={loading}
                disabled={loading}
                required
                error={errors.cliente}
                emptyMessage="No se encontraron clientes"
                onSearch={setSearchTerm}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              className="px-3"
              onClick={() => setShowQuickClientModal(true)}
              title="Crear nuevo cliente rápido"
            >
              <Plus className="w-5 h-5 text-blue-600" />
            </Button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Canal de Venta <span className="text-red-500">*</span>
          </label>
          <div className="flex items-center gap-3">
            {canalesVenta.map(canal => {
              const Icon = canal.icon;
              const isSelected = canalVenta === canal.value;

              return (
                <Tooltip key={canal.value} content={canal.label} position="top">
                  <button
                    type="button"
                    onClick={() => setCanalVenta(canal.value)}
                    className={`
                      flex items-center justify-center p-4 rounded-lg border-2 transition-all
                      ${isSelected
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                      }
                    `}
                  >
                    <Icon className="w-6 h-6" />
                  </button>
                </Tooltip>
              );
            })}
          </div>
          {errors.canalVenta && (
            <p className="mt-1 text-sm text-red-600">{errors.canalVenta}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Creado por
          </label>
          <div className="flex items-center space-x-2 px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg">
            <User className="w-5 h-5 text-gray-400" />
            <span className="text-sm text-gray-700">{usuarioLogueado}</span>
          </div>
        </div>

        {/* Conditional Fields based on Mode */}
        {mode === 'orden' ? (
          <>
            <DatePicker
              label="Fecha Estimada de Entrega"
              value={fechaEntrega}
              onChange={(date) => setFechaEntrega(date || '')}
              minDate={new Date()}
              error={errors.fechaEntrega}
              placeholder="Seleccionar fecha de entrega"
              required
              workloadData={workloadData}
              workloadThresholds={{ low: 3, medium: 7 }}
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tipo de Entrega
              </label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setRequiereDespacho && setRequiereDespacho(false)}
                  className={`
                        flex-1 flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all gap-2
                        ${!requiereDespacho
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                    }
                      `}
                >
                  <Store className="w-5 h-5" />
                  <span className="text-sm font-medium">Retiro en Local</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRequiereDespacho && setRequiereDespacho(true)}
                  className={`
                        flex-1 flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all gap-2
                        ${requiereDespacho
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                    }
                      `}
                >
                  <Truck className="w-5 h-5" />
                  <span className="text-sm font-medium">Envío a Domicilio</span>
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
            <div>
              <Label htmlFor="fechaValidez">Válido hasta</Label>
              <div className="relative mt-1">
                <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
                <Input
                  id="fechaValidez"
                  type="date"
                  required
                  className="pl-9"
                  value={presupuestoValidez}
                  onChange={(e) => setPresupuestoValidez(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="plantilla">Plantilla de Condiciones</Label>
              <Select
                id="plantilla"
                value={selectedPlantilla}
                onChange={handlePlantillaChange}
                disabled={loadingPlantillas}
              >
                <option value="">Seleccionar plantilla...</option>
                {plantillasCondiciones.map(p => (
                  <option key={p.id} value={p.id}>{p.nombre}</option>
                ))}
              </Select>
            </div>
          </>
        )}
      </div>

      {mode === 'presupuesto' && (
        <div>
          <Label htmlFor="condiciones">Detalle de Condiciones</Label>
          <Textarea
            id="condiciones"
            value={presupuestoCondiciones}
            onChange={(e) => setPresupuestoCondiciones(e.target.value)}
            rows={4}
            placeholder="Escriba las condiciones comerciales..."
            className="font-mono text-sm"
          />
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Notas Internas
        </label>
        <textarea
          value={notasInternas}
          onChange={(e) => setNotasInternas(e.target.value)}
          rows={3}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          placeholder="Agrega notas internas sobre esta orden..."
        />
      </div>

      <QuickClientModal
        isOpen={showQuickClientModal}
        onClose={() => setShowQuickClientModal(false)}
        onClientCreated={handleClientCreated}
        initialName={searchTerm}
      />
    </div>
  );
}
