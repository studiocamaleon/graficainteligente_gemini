import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Route, Info, Loader2 } from 'lucide-react';
import { EmptyState } from '../ui/EmptyState';
import { ItemRoutePreview } from '../orders/ItemRoutePreview';
import type { PresupuestoItem } from '../../types/presupuestos';

interface PresupuestoRutasTabProps {
    presupuestoId: string;
    items: PresupuestoItem[];
    companyId: string;
    esEditable?: boolean;
    onRoutesChange?: () => void;
}

export function PresupuestoRutasTab({ presupuestoId, items, companyId, esEditable = false, onRoutesChange }: PresupuestoRutasTabProps) {
    const [loading, setLoading] = useState(true);
    const [itemsWithRoutes, setItemsWithRoutes] = useState<any[]>([]);

    // Filtrar items de producción (no servicios de cobro)
    const productionItems = items.filter(i => {
        // Detectar si es servicio de cobro
        if (i.producto_categoria === 'Servicio Adicional') return false;
        if ((i as any).es_servicio_cobro) return false;
        // Excluir Items Personalizados que son Servicios mapeados
        if (i.tipo_item === 'item_personalizado' && i.producto_nombre?.toLowerCase()?.includes('servicio')) return false; // Heuristic fallback if category is missing

        return true;
    });


    useEffect(() => {
        fetchRoutes();
    }, [presupuestoId, companyId]);

    const fetchRoutes = async () => {
        try {
            setLoading(true);

            // Only fetch if we have items and companyId
            if (!companyId || items.length === 0) {
                setItemsWithRoutes(items.length > 0 ? items.map(i => ({ ...i, rutas_generadas: [] })) : []);
                if (!companyId) console.warn('No company ID provided to PresupuestoRutasTab');
                setLoading(false);
                return;
            }

            const { data: rutas, error } = await supabase
                .from('presupuestos_items_rutas')
                .select('*')
                .eq('company_id', companyId)
                .in('presupuesto_item_id', items.map(i => i.id))
                .order('orden', { ascending: true });

            if (error) throw error;

            // Mapear rutas a items
            const mappedItems = items.map(item => {
                const itemRutas = rutas?.filter((r: any) => r.presupuesto_item_id === item.id) || [];

                // Transformar rutas al formato que espera ItemRoutePreview
                const formattedRutas = itemRutas.map((r: any) => ({
                    id: r.id,
                    etapa: r.tipo_etapa,
                    paso_id: r.paso_id,
                    paso_nombre: r.paso_nombre,
                    orden: r.orden,
                    es_obligatorio: true,
                    comentario_vendedor: r.comentario_vendedor,
                    // Mantener IDs originales para updates
                    _db_id: r.id
                }));

                return {
                    ...item,
                    rutas_generadas: formattedRutas
                };
            });

            setItemsWithRoutes(mappedItems);
        } catch (err) {
            console.error('Error fetching routes:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateStepComment = async (itemIndex: number, stepId: string, comment: string | null) => {
        try {
            const { error } = await (supabase as any)
                .from('presupuestos_items_rutas')
                .update({ comentario_vendedor: comment } as any)
                .eq('id', stepId);

            if (error) throw error;

            // Actualizar estado local
            const newItems = [...itemsWithRoutes];
            const item = newItems[itemIndex];
            const stepIndex = item.rutas_generadas.findIndex((s: any) => s.id === stepId);
            if (stepIndex !== -1) {
                item.rutas_generadas[stepIndex].comentario_vendedor = comment;
                setItemsWithRoutes(newItems);
                if (onRoutesChange) onRoutesChange();
            }
        } catch (err) {
            console.error('Error updating comment:', err);
            alert('Error al guardar comentario');
        }
    };

    // Adapter para ItemRoutePreview que espera setItems
    // Esta función intercepta los cambios de ItemRoutePreview (add/remove) y actualiza la DB
    const handleSetItemsAdapter = async (newItems: any[]) => {
        // Detectar qué item cambió comparando con itemsWithRoutes
        // ItemRoutePreview pasa todo el array nuevo

        // Encontrar el item modificado (asumimos solo uno cambia a la vez por interacción de UI)
        // Pero ItemRoutePreview nos da el array completo.
        // Iteramos para encontrar diferencias

        for (let i = 0; i < newItems.length; i++) {
            const oldItem = itemsWithRoutes[i];
            const newItem = newItems[i];
            const oldRutas = oldItem.rutas_generadas || [];
            const newRutas = newItem.rutas_generadas || [];

            if (oldRutas.length !== newRutas.length) {
                // Hubo cambio en cantidad de pasos (add/remove)
                if (newRutas.length > oldRutas.length) {
                    // ADD
                    const addedStep = newRutas.find((nr: any) => !oldRutas.some((or: any) => or.id === nr.id));
                    if (addedStep) {
                        await handleAddStepToDb(newItem, addedStep, newRutas.length - 1);
                    }
                } else {
                    // REMOVE
                    const removedStep = oldRutas.find((or: any) => !newRutas.some((nr: any) => nr.id === or.id));
                    if (removedStep) {
                        await handleRemoveStepFromDb(removedStep.id);
                    }
                }
                // Refrescar todo por seguridad
                await fetchRoutes();
                if (onRoutesChange) onRoutesChange();
                return;
            }
        }
    };

    const handleAddStepToDb = async (item: any, step: any, orderIndex: number) => {
        if (!companyId) return;

        const { error } = await (supabase as any).from('presupuestos_items_rutas').insert({
            company_id: companyId,
            presupuesto_item_id: item.id,
            tipo_etapa: step.etapa,
            paso_id: step.paso_id, // Puede ser null si es manual puro
            paso_nombre: step.paso_nombre,
            orden: orderIndex,
            es_modificado: true,
            comentario_vendedor: step.comentario_vendedor,
            // source_service_id etc se omiten si es manual
        } as any);

        if (error) {
            console.error('Error adding step:', error);
            alert('Error al agregar paso');
        }
    };

    const handleRemoveStepFromDb = async (stepId: string) => {
        // Verificar si es un ID temporal de memoria o un ID real de DB
        // ItemRoutePreview genera IDs temporales para los manuales agregados en memoria: `temp-manual-...`
        // Pero si ya recargamos `itemsWithRoutes` desde DB, deberían tener UUIDs.
        // Si acabamos de agregar uno y la UI no refrescó, podría ser `temp`.
        // Pero en mi lógica llamo a fetchRoutes() después de cada cambio, así que deberíamos tener IDs reales.
        // Solo cuidado con la latencia.

        if (stepId.startsWith('temp-manual')) {
            console.warn('Intentando borrar paso temporal no persistido??');
            return;
        }

        const { error } = await (supabase as any).from('presupuestos_items_rutas').delete().eq('id', stepId);
        if (error) {
            console.error('Error deleting step:', error);
            alert('Error al eliminar paso');
        }
    };


    if (loading) {
        return (
            <div className="flex justify-center p-8">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
        );
    }

    if (productionItems.length === 0) {
        return (
            <EmptyState
                icon={Route}
                title="No hay items configurables"
                description="Este presupuesto no tiene items que requieran rutas de producción."
            />
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center space-x-2 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <Info className="w-5 h-5 text-blue-600 flex-shrink-0" />
                <div className="text-sm text-blue-800">
                    <p className="font-medium mb-1">Rutas de Producción del Presupuesto</p>
                    <p className="text-blue-700">
                        Estas rutas definen el flujo de trabajo si el presupuesto es aprobado.
                        {esEditable && ' Puedes personalizar los pasos para ajustar tiempos y procesos.'}
                    </p>
                </div>
            </div>

            <div className="space-y-4">
                {itemsWithRoutes.map((item, index) => {
                    // Skip non-production things if any
                    if (!productionItems.find(pi => pi.id === item.id)) return null;

                    return (
                        <ItemRoutePreview
                            key={item.id}
                            item={item}
                            index={index}
                            items={itemsWithRoutes}
                            setItems={handleSetItemsAdapter} // Pasamos nuestro adapter
                            onUpdateStepComment={handleUpdateStepComment}
                            readOnly={!esEditable}
                            allowManualSteps={true}
                        />
                    );
                })}
            </div>
        </div>
    );
}
