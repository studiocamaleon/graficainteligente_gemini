import { useState, useEffect } from 'react';
import { Plus, Trash2, ArrowUp, ArrowDown, AlertCircle } from 'lucide-react';
import { Button } from '../ui/Button';
import { SearchableSelect } from '../ui/SearchableSelect';
import { StepCommentEditor } from './StepCommentEditor';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { useOrdenItemRutas } from '../../hooks/useOrdenItemRutas';
import { usePasos } from '../../hooks/usePasos';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import type { TipoEtapaRuta, OrdenItemRuta } from '../../types/database';

interface ItemRouteEditorProps {
  ordenItemId: string;
  productoId: string;
  productoNombre: string;
  readonly?: boolean;
  hideHeader?: boolean;
}

export function ItemRouteEditor({
  ordenItemId,
  productoId,
  productoNombre,
  readonly = false,
  hideHeader = false,
}: ItemRouteEditorProps) {
  const {
    rutas,
    loading,
    createRuta,
    deleteRuta,
    reordenarRutas,
    updateComentario,
    getRutasPorEtapa,
  } = useOrdenItemRutas({ ordenItemId });

  const { pasos, loading: loadingPasos } = usePasos({ isActive: true, itemsPerPage: 10000 });
  const {
    dialogState,
    isLoading: isConfirmLoading,
    closeDialog,
    handleConfirm,
    confirmAction,
  } = useConfirmDialog();

  const [addingToEtapa, setAddingToEtapa] = useState<TipoEtapaRuta | null>(null);

  const rutasPorEtapa = getRutasPorEtapa();

  // Debug logging
  useEffect(() => {
    console.log('📍 ItemRouteEditor montado/actualizado:', {
      ordenItemId,
      productoId,
      productoNombre,
      totalRutas: rutas.length,
      loading
    });
    console.log('📊 Rutas por etapa:', {
      pre_prensa: rutasPorEtapa.pre_prensa.length,
      principal: rutasPorEtapa.principal.length,
      post_prensa: rutasPorEtapa.post_prensa.length,
      instalacion: rutasPorEtapa.instalacion.length
    });
  }, [ordenItemId, productoId, productoNombre, rutas.length, loading, rutasPorEtapa]);

  const handleAgregarPaso = async (etapa: TipoEtapaRuta, pasoId: string) => {
    if (!pasoId) return;

    const paso = pasos?.find(p => p.id === pasoId);
    if (!paso) return;

    const rutasEtapa = rutasPorEtapa[etapa];
    const maxOrden = rutasEtapa.length > 0 ? Math.max(...rutasEtapa.map(r => r.orden)) : -1;

    try {
      await createRuta({
        orden_item_id: ordenItemId,
        tipo_etapa: etapa,
        paso_id: pasoId,
        paso_nombre: paso.nombre,
        orden: maxOrden + 1,
        es_modificado: true,
      });
      setAddingToEtapa(null);
    } catch (error) {
      console.error('Error agregando paso:', error);
    }
  };

  const handleEliminarPaso = async (ruta: OrdenItemRuta) => {
    confirmAction({
      title: '¿Eliminar paso?',
      message: `¿Estás seguro de eliminar "${ruta.paso_nombre}" de la ruta?`,
      confirmText: 'Eliminar',
      cancelText: 'Cancelar',
      variant: 'danger',
      onConfirm: async () => {
        try {
          await deleteRuta(ruta.id);
        } catch (error) {
          console.error('Error eliminando paso:', error);
        }
      },
    });
  };

  const handleMoverPaso = async (ruta: OrdenItemRuta, direccion: 'up' | 'down') => {
    const rutasEtapa = rutasPorEtapa[ruta.tipo_etapa];
    const index = rutasEtapa.findIndex(r => r.id === ruta.id);

    if (
      (direccion === 'up' && index === 0) ||
      (direccion === 'down' && index === rutasEtapa.length - 1)
    ) {
      return;
    }

    const newIndex = direccion === 'up' ? index - 1 : index + 1;
    const newRutas = [...rutasEtapa];
    [newRutas[index], newRutas[newIndex]] = [newRutas[newIndex], newRutas[index]];

    const reordenadas = newRutas.map((r, i) => ({ id: r.id, orden: i }));

    try {
      await reordenarRutas(reordenadas);
    } catch (error) {
      console.error('Error reordenando pasos:', error);
    }
  };

  const renderEtapa = (etapa: TipoEtapaRuta, titulo: string, color: string) => {
    const rutasEtapa = rutasPorEtapa[etapa];
    const isAdding = addingToEtapa === etapa;
    const headerThemeByEtapa: Record<TipoEtapaRuta, string> = {
      pre_prensa: 'bg-violet-50 border-violet-200',
      principal: 'bg-blue-50 border-blue-200',
      post_prensa: 'bg-emerald-50 border-emerald-200',
      instalacion: 'bg-amber-50 border-amber-200',
    };

    return (
      <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className={`px-4 py-3 border-b ${headerThemeByEtapa[etapa]}`}>
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold text-slate-900">{titulo}</h4>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
              {rutasEtapa.length} {rutasEtapa.length === 1 ? 'paso' : 'pasos'}
            </span>
          </div>
        </div>

        <div className="p-4 space-y-3">
          {isAdding && (
            <div className="flex gap-2">
              <div className="flex-1">
                <SearchableSelect
                  options={(pasos || [])
                    .filter(p => {
                      const etapaMap: Record<string, string> = {
                        'pre_prensa': 'Pre-prensa',
                        'principal': 'Produccion',
                        'post_prensa': 'Terminacion',
                        'instalacion': 'Instalacion'
                      };
                      const dbEtapa = etapaMap[etapa] || etapa;
                      return p.etapa === dbEtapa;
                    })
                    .map(p => ({ value: p.id, label: p.nombre }))
                  }
                  value=""
                  onChange={(value) => handleAgregarPaso(etapa, value)}
                  placeholder="Selecciona paso..."
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAddingToEtapa(null)}
              >
                Cancelar
              </Button>
            </div>
          )}

          {rutasEtapa.length === 0 ? (
            <div className="flex items-center justify-between py-4 px-3 bg-slate-50 rounded-lg border border-dashed border-slate-300">
              <p className="text-sm text-slate-500">No hay pasos en esta etapa</p>
              {!readonly && !isAdding && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setAddingToEtapa(etapa)}
                >
                  <Plus className="w-4 h-4" />
                  Pasos
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {!readonly && !isAdding && (
                <div className="flex justify-end">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setAddingToEtapa(etapa)}
                  >
                    <Plus className="w-4 h-4" />
                    Pasos
                  </Button>
                </div>
              )}

              {rutasEtapa.map((ruta, index) => (
                <div
                  key={ruta.id}
                  className={`p-3 rounded-lg border ${ruta.es_modificado
                    ? 'bg-amber-50 border-amber-200'
                    : 'bg-white border-slate-200'
                    }`}
                >
                  <div className="flex items-start gap-2 mb-2">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 text-gray-700 text-xs font-medium flex-shrink-0">
                      {index + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">
                        {ruta.paso_nombre}
                      </p>
                      {ruta.es_modificado && (
                        <p className="text-xs text-amber-600 mt-0.5">
                          Modificado manualmente
                        </p>
                      )}
                    </div>
                    {!readonly && (
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleMoverPaso(ruta, 'up')}
                          disabled={index === 0}
                          title="Mover arriba"
                        >
                          <ArrowUp className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleMoverPaso(ruta, 'down')}
                          disabled={index === rutasEtapa.length - 1}
                          title="Mover abajo"
                        >
                          <ArrowDown className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEliminarPaso(ruta)}
                          title="Eliminar paso"
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </Button>
                      </div>
                    )}
                  </div>

                  <StepCommentEditor
                    comentario={ruta.comentario_vendedor}
                    onSave={async (comentario) => {
                      await updateComentario(ruta.id, comentario);
                    }}
                    disabled={readonly}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    );
  };

  if (loading || loadingPasos) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Cargando ruta...</span>
      </div>
    );
  }

  const tienePasoPrincipal = rutasPorEtapa.principal.length > 0;

  return (
    <div className="space-y-6">
      {!hideHeader && (
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{productoNombre}</h3>
            <p className="text-sm text-gray-500">
              {rutas.length} {rutas.length === 1 ? 'paso' : 'pasos'} en total
            </p>
          </div>
        </div>
      )}

      {!tienePasoPrincipal && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-900">Ruta incompleta</p>
            <p className="text-sm text-red-700 mt-1">
              Debe agregar al menos un paso en la etapa principal
            </p>
          </div>
        </div>
      )}

      {renderEtapa('pre_prensa', 'Pre-Prensa', 'bg-purple-100 text-purple-800')}
      {renderEtapa('principal', 'Etapa Principal', 'bg-blue-100 text-blue-800')}
      {renderEtapa('post_prensa', 'Post-Prensa', 'bg-green-100 text-green-800')}
      {renderEtapa('instalacion', 'Instalación', 'bg-orange-100 text-orange-800')}

      <ConfirmDialog
        isOpen={dialogState.isOpen}
        onClose={closeDialog}
        onConfirm={handleConfirm}
        title={dialogState.title}
        message={dialogState.message}
        confirmText={dialogState.confirmText}
        cancelText={dialogState.cancelText}
        variant={dialogState.variant}
        isLoading={isConfirmLoading}
      />
    </div>
  );
}
