import { useState, useEffect } from 'react';
import { MessageCircle, Globe2, Store, User, Smartphone, Truck, Plus, FileText, MessageSquarePlus, Home } from 'lucide-react';
import { SearchableSelect } from '../ui/SearchableSelect';
import { DatePicker } from '../ui/DatePicker';
import { Tooltip } from '../ui/Tooltip';
import { Button } from '../ui/Button';
import { Label } from '../ui/Label';
import { Textarea } from '../ui/Textarea';
import { Select } from '../ui/Select';
import { supabase } from '../../lib/supabase';
import { formatDateTimeDisplay } from '../../utils/dates';

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
  notas?: Array<{
    id: string;
    nota: string;
    created_at: string;
    author_name?: string | null;
    author_email?: string | null;
  }>;
  onAddNota?: (nota: string) => Promise<boolean>;
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
  isEditing = false,
  notas = [],
  onAddNota
}: OrdenGeneralSectionProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const { clients, loading } = useClients({ searchTerm, itemsPerPage: 50 });

  const [showQuickClientModal, setShowQuickClientModal] = useState(false);
  const [newlyCreatedClients, setNewlyCreatedClients] = useState<Client[]>([]);

  // Estado para plantillas de condiciones
  const [plantillasCondiciones, setPlantillasCondiciones] = useState<{ id: string, nombre: string, contenido: string }[]>([]);
  const [selectedPlantilla, setSelectedPlantilla] = useState('');
  const [loadingPlantillas, setLoadingPlantillas] = useState(false);
  const [newNoteText, setNewNoteText] = useState('');
  const [isAddingNote, setIsAddingNote] = useState(false);

  const canalesVenta: { value: CanalVenta; label: string; icon: any }[] = [
    { value: 'WhatsApp', label: 'WhatsApp', icon: MessageCircle },
    { value: 'Web', label: 'Web', icon: Globe2 },
    { value: 'Mostrador', label: 'Mostrador', icon: Store },
    { value: 'App Mobile', label: 'App', icon: Smartphone },
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

  const handleAddNote = async () => {
    if (!onAddNota || !newNoteText.trim()) return;
    setIsAddingNote(true);
    const ok = await onAddNota(newNoteText);
    if (ok) {
      setNewNoteText('');
    }
    setIsAddingNote(false);
  };

  return (
    <div className="p-4 md:p-5 space-y-4">

      {/* Mode Switcher */}
      {!isEditing && (
        <div className="flex justify-center">
          <div className="inline-flex rounded-xl border border-gray-200 bg-gray-50 p-1 shadow-sm">
            <button
              type="button"
              onClick={() => onModeChange('orden')}
              className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-all duration-200 ${mode === 'orden'
                ? 'bg-blue-500 text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
                }`}
            >
              Orden de Trabajo
            </button>
            <button
              type="button"
              onClick={() => onModeChange('presupuesto')}
              className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-all duration-200 ${mode === 'presupuesto'
                ? 'bg-green-600 text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
                }`}
            >
              Presupuesto
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2 border-b border-gray-200 pb-3">
        <div className="inline-flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 shadow-sm">
          <User className="h-4 w-4 text-blue-600" />
          <span className="text-xs font-medium text-blue-700">{usuarioLogueado}</span>
        </div>
      </div>

      {mode === 'orden' ? (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-12">
          <section className="rounded-xl border border-gray-200 bg-gray-50/80 p-3 xl:col-span-5">
            <h4 className="mb-2 text-sm font-semibold text-gray-900">Cliente</h4>
            <div className="flex gap-2">
              <div className="flex-1">
                <SearchableSelect
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
                <Plus className="h-5 w-5 text-blue-600" />
              </Button>
            </div>

            {selectedClient && (
              <div className="mt-3 space-y-1.5 rounded-lg border border-slate-200/80 bg-slate-100/60 p-2.5">
                <div className="grid grid-cols-3 items-center gap-2 rounded-md px-2 py-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Nombre Fantasía</span>
                  <span className="col-span-2 text-sm font-medium text-slate-800">{selectedClient.nombre_fantasia || '-'}</span>
                </div>
                <div className="grid grid-cols-3 items-center gap-2 rounded-md border-y border-slate-200/70 px-2 py-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Razón Social</span>
                  <span className="col-span-2 text-sm font-medium text-slate-800">{selectedClient.razon_social || '-'}</span>
                </div>
                <div className="grid grid-cols-3 items-center gap-2 rounded-md px-2 py-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">CUIT</span>
                  <span className="col-span-2 text-sm font-medium text-slate-800">{selectedClient.numero_documento || '-'}</span>
                </div>
              </div>
            )}
          </section>

          <section className="rounded-xl border border-gray-200 bg-gray-50/80 p-3 xl:col-span-4">
            <h4 className="mb-3 text-sm font-semibold text-gray-900">Entrega</h4>
            <DatePicker
              label="Fecha Estimada"
              value={fechaEntrega}
              onChange={(date) => setFechaEntrega(date || '')}
              minDate={new Date()}
              error={errors.fechaEntrega}
              placeholder="Seleccionar fecha de entrega"
              required
              workloadData={workloadData}
              workloadThresholds={{ low: 3, medium: 7 }}
            />

            <div className="mt-3">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-600">
                Tipo de Entrega
              </label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setRequiereDespacho && setRequiereDespacho(false)}
                  className={`
                    flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-all
                    ${!requiereDespacho
                      ? 'border-blue-500 bg-blue-500 text-white shadow-sm'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                    }
                  `}
                >
                  <Home className="h-4 w-4" />
                  <span className="font-medium">Retiro en Local</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRequiereDespacho && setRequiereDespacho(true)}
                  className={`
                    flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-all
                    ${requiereDespacho
                      ? 'border-blue-500 bg-blue-500 text-white shadow-sm'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                    }
                  `}
                >
                  <Truck className="h-4 w-4" />
                  <span className="font-medium">Envío a Domicilio</span>
                </button>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-gray-200 bg-gray-50/80 p-3 xl:col-span-3">
            <h4 className="mb-2 text-sm font-semibold text-gray-900">Canal de Venta</h4>
            <div className="grid grid-cols-1 gap-2">
              {canalesVenta.map(canal => {
                const Icon = canal.icon;
                const isSelected = canalVenta === canal.value;

                return (
                  <Tooltip key={canal.value} content={canal.label} position="top">
                    <button
                      type="button"
                      onClick={() => setCanalVenta(canal.value)}
                      className={`
                        relative flex w-full items-center justify-center rounded-lg border px-3 py-2.5 text-sm transition-all
                        ${isSelected
                          ? 'border-blue-500 bg-blue-500 text-white shadow-sm'
                          : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                        }
                      `}
                    >
                      <Icon className="absolute left-3 h-4 w-4 shrink-0" />
                      <span className="font-medium leading-none">{canal.label}</span>
                    </button>
                  </Tooltip>
                );
              })}
            </div>
            {errors.canalVenta && (
              <p className="mt-2 text-sm text-red-600">{errors.canalVenta}</p>
            )}
          </section>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-12">
          <section className="rounded-xl border border-gray-200 bg-gray-50/80 p-3 xl:col-span-5">
            <h4 className="mb-2 text-sm font-semibold text-gray-900">Cliente</h4>
            <div className="flex gap-2">
              <div className="flex-1">
                <SearchableSelect
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
                <Plus className="h-5 w-5 text-blue-600" />
              </Button>
            </div>

            {selectedClient && (
              <div className="mt-3 space-y-1.5 rounded-lg border border-slate-200/80 bg-slate-100/60 p-2.5">
                <div className="grid grid-cols-3 items-center gap-2 rounded-md px-2 py-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Nombre Fantasía</span>
                  <span className="col-span-2 text-sm font-medium text-slate-800">{selectedClient.nombre_fantasia || '-'}</span>
                </div>
                <div className="grid grid-cols-3 items-center gap-2 rounded-md border-y border-slate-200/70 px-2 py-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Razón Social</span>
                  <span className="col-span-2 text-sm font-medium text-slate-800">{selectedClient.razon_social || '-'}</span>
                </div>
                <div className="grid grid-cols-3 items-center gap-2 rounded-md px-2 py-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">CUIT</span>
                  <span className="col-span-2 text-sm font-medium text-slate-800">{selectedClient.numero_documento || '-'}</span>
                </div>
              </div>
            )}
          </section>

          <section className="rounded-xl border border-gray-200 bg-gray-50/80 p-3 xl:col-span-4">
            <h4 className="mb-3 text-sm font-semibold text-gray-900">Presupuesto</h4>
            <DatePicker
              label="Válido hasta"
              value={presupuestoValidez}
              onChange={(date) => setPresupuestoValidez(date || '')}
              minDate={new Date()}
              required
              placeholder="Seleccionar fecha de validez"
            />

            <div className="mt-3">
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
          </section>

          <section className="rounded-xl border border-gray-200 bg-gray-50/80 p-3 xl:col-span-3">
            <h4 className="mb-2 text-sm font-semibold text-gray-900">Canal de Venta</h4>
            <div className="grid grid-cols-1 gap-2">
              {canalesVenta.map(canal => {
                const Icon = canal.icon;
                const isSelected = canalVenta === canal.value;
                return (
                  <Tooltip key={canal.value} content={canal.label} position="top">
                    <button
                      type="button"
                      onClick={() => setCanalVenta(canal.value)}
                      className={`
                        relative flex w-full items-center justify-center rounded-lg border px-3 py-2.5 text-sm transition-all
                        ${isSelected
                          ? 'border-blue-500 bg-blue-500 text-white shadow-sm'
                          : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                        }
                      `}
                    >
                      <Icon className="absolute left-3 h-4 w-4 shrink-0" />
                      <span className="font-medium leading-none">{canal.label}</span>
                    </button>
                  </Tooltip>
                );
              })}
            </div>
            {errors.canalVenta && (
              <p className="mt-2 text-sm text-red-600">{errors.canalVenta}</p>
            )}
          </section>
        </div>
      )}

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

      {isEditing ? (
        <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-amber-700" />
            <h4 className="text-sm font-semibold text-amber-900">Notas internas</h4>
          </div>

          <div className="space-y-2">
            {notas.length > 0 ? (
              notas.map((note) => (
                <div key={note.id} className="rounded-lg border border-amber-200 bg-white p-3">
                  <p className="whitespace-pre-wrap text-sm text-gray-800">{note.nota}</p>
                  <p className="mt-2 text-xs text-gray-500">
                    {note.author_name || note.author_email || 'Usuario'} · {formatDateTimeDisplay(note.created_at)}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-amber-900">Sin notas cargadas.</p>
            )}
          </div>

          <div className="rounded-lg border border-amber-200 bg-white p-3">
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-amber-900">Agregar nota</label>
            <textarea
              value={newNoteText}
              onChange={(e) => setNewNoteText(e.target.value)}
              rows={3}
              className="w-full resize-none rounded-lg border border-amber-200 px-3 py-2 text-sm focus:border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-400"
              placeholder="Escribí una nota interna..."
            />
            <div className="mt-2 flex justify-end">
              <Button
                type="button"
                size="sm"
                onClick={handleAddNote}
                disabled={isAddingNote || !newNoteText.trim() || !onAddNota}
              >
                <MessageSquarePlus className="mr-2 h-4 w-4" />
                {isAddingNote ? 'Guardando...' : 'Agregar nota'}
              </Button>
            </div>
          </div>
        </div>
      ) : (
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
      )}

      <QuickClientModal
        isOpen={showQuickClientModal}
        onClose={() => setShowQuickClientModal(false)}
        onClientCreated={handleClientCreated}
        initialName={searchTerm}
      />
    </div>
  );
}
