import { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Search, Loader, AlertTriangle, Info } from 'lucide-react';
import { useServicios } from '../../hooks/useServicios';
import { Badge } from '../ui/Badge';
// import type { Servicio, ServicioNivelPrecio } from '../../types/database'; // Se infieren del hook

interface AplicarServicioMasivoModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedItemsCount: number;
    onConfirm: (servicioSeleccionado: ServicioSeleccionado) => Promise<void>;
}

export interface ServicioSeleccionado {
    servicio: any;
    nivel?: any;
    precioTotalCalculado: number;
    precioPorItem: number;
    esPrecioFijoGlobal: boolean;
}

export function AplicarServicioMasivoModal({
    isOpen,
    onClose,
    selectedItemsCount,
    onConfirm
}: AplicarServicioMasivoModalProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedServicio, setSelectedServicio] = useState<any | null>(null);
    const [selectedNivel, setSelectedNivel] = useState<any | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const { servicios, loading, refetch } = useServicios({
        searchTerm,
        itemsPerPage: 50,
        isActive: true
    });

    // Debounce para búsqueda
    useEffect(() => {
        const timer = setTimeout(() => {
            if (isOpen) refetch();
        }, 300);
        return () => clearTimeout(timer);
    }, [searchTerm, isOpen]);

    const handleSelectServicio = (servicio: any) => {
        setSelectedServicio(servicio);
        setSelectedNivel(null);

        // Si tiene un solo nivel o no tiene niveles pero configuración directa
        if (servicio.tiene_niveles_precio) {
            // Esperar selección de nivel
        }
    };

    const getPrecioInfo = () => {
        if (!selectedServicio) return null;

        let tipoImpacto = selectedServicio.tipo_impacto;
        let valorImpacto = selectedServicio.valor_impacto;

        if (selectedNivel) {
            tipoImpacto = selectedNivel.tipo_impacto;
            valorImpacto = selectedNivel.valor_impacto;
        }

        if (!tipoImpacto || valorImpacto === undefined || valorImpacto === null) return null;

        const esGlobal = tipoImpacto === 'precio_fijo';
        let precioTotal = 0;
        let precioPorItem = 0;

        if (esGlobal) {
            precioTotal = valorImpacto;
            precioPorItem = valorImpacto / selectedItemsCount;
        } else { // precio_unitario o porcentaje_base (simplificado a unitario por ahora si no hay base clara)
            // Nota: para porcentaje_base necesitaríamos el precio base de cada item, lo cual es complejo aquí.
            // Asumiremos que en este contexto masivo se aplica como valor unitario directo o sobre un base promedio si fuera necesario.
            // Por simplicidad, trataremos 'porcentaje' como un caso especial o alertaremos.
            if (tipoImpacto === 'porcentaje_base') {
                return { error: 'Los servicios basados en porcentaje no se pueden aplicar masivamente de forma simple aún.' };
            }
            precioPorItem = valorImpacto;
            precioTotal = valorImpacto * selectedItemsCount;
        }

        return {
            esGlobal,
            precioTotal,
            precioPorItem,
            tipoImpacto
        };
    };

    const precioInfo = getPrecioInfo();

    const handleConfirmClick = async () => {
        if (!precioInfo || precioInfo.error) return;

        setIsSubmitting(true);
        try {
            await onConfirm({
                servicio: selectedServicio,
                nivel: selectedNivel,
                precioTotalCalculado: precioInfo.precioTotal!,
                precioPorItem: precioInfo.precioPorItem!,
                esPrecioFijoGlobal: precioInfo.esGlobal ?? false
            });
            onClose();
        } catch (error) {
            console.error('Error al aplicar servicio:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Aplicar Servicio a Múltiples Items"
            size="lg"
        >
            <div className="flex flex-col h-[600px]">
                {/* Header con resumen de selección */}
                <div className="mb-4 p-3 bg-blue-50 border border-blue-100 rounded-lg flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Info className="w-5 h-5 text-blue-600" />
                        <span className="text-sm text-blue-800">
                            Aplicando a <strong>{selectedItemsCount}</strong> items seleccionados.
                        </span>
                    </div>
                    {precioInfo && !precioInfo.error && (
                        <Badge variant={precioInfo.esGlobal ? "purple" : "blue"}>
                            {precioInfo.esGlobal ? "Servicio Global (Precio Fijo)" : "Servicio por Unidad"}
                        </Badge>
                    )}
                </div>

                {/* Buscador */}
                <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input
                        placeholder="Buscar servicio (ej: Diseño, Laminado...)"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9"
                    />
                </div>

                {/* Contenido Principal: Lista o Detalle */}
                <div className="flex-1 overflow-hidden flex gap-4">

                    {/* Lista de Servicios */}
                    <div className={`flex-1 overflow-y-auto border rounded-lg ${selectedServicio ? 'hidden md:block md:w-1/2' : 'w-full'}`}>
                        {loading ? (
                            <div className="flex justify-center p-8"><Loader className="animate-spin text-gray-400" /></div>
                        ) : servicios.length === 0 ? (
                            <div className="p-8 text-center text-gray-500">No se encontraron servicios</div>
                        ) : (
                            <div className="divide-y">
                                {servicios.map((servicio) => (
                                    <div
                                        key={servicio.id}
                                        onClick={() => handleSelectServicio(servicio)}
                                        className={`p-3 cursor-pointer hover:bg-gray-50 transition-colors ${selectedServicio?.id === servicio.id ? 'bg-blue-50 border-l-4 border-blue-500' : ''}`}
                                    >
                                        <div className="font-medium text-gray-900">{servicio.nombre}</div>
                                        <div className="text-xs text-gray-500 mt-1">
                                            {servicio.estacion?.nombre || 'Sin estación'} •
                                            {servicio.tiene_niveles_precio ? ' Niveles disponibles' : ' Precio directo'}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Panel de Configuración del Servicio Seleccionado */}
                    {selectedServicio && (
                        <div className="flex-1 border rounded-lg p-4 bg-gray-50 flex flex-col md:w-1/2">
                            <h3 className="font-semibold text-lg mb-2">{selectedServicio.nombre}</h3>

                            {/* Validación de Estación (Inconsistencia Servicio vs Paso) */}
                            {(() => {
                                const pasoVinculado = selectedServicio.tiene_niveles_precio
                                    ? selectedNivel?.paso
                                    : selectedServicio.pasos?.[0]?.paso;

                                if (pasoVinculado?.estacion?.id && selectedServicio.estacion?.id && pasoVinculado.estacion.id !== selectedServicio.estacion.id) {
                                    return (
                                        <div className="mb-4 bg-red-50 border border-red-200 rounded p-3 text-sm text-red-800 animate-in fade-in slide-in-from-top-2">
                                            <div className="flex items-start gap-2">
                                                <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
                                                <div>
                                                    <p className="font-bold text-red-700">¡Alerta de Configuración!</p>
                                                    <p>
                                                        Servicio declarado en: <strong className="text-gray-800">{selectedServicio.estacion?.nombre}</strong>
                                                    </p>
                                                    <p>
                                                        Pero ejecuta paso en: <strong className="text-red-700">{pasoVinculado.estacion?.nombre}</strong>
                                                    </p>
                                                    <p className="mt-1 text-xs text-red-600 opacity-90">
                                                        Esto causará que la tarea aparezca en la estación incorrecta. Edita el servicio/paso en ABM Core.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                }
                                return null;
                            })()}

                            {selectedServicio.tiene_niveles_precio ? (
                                <div className="mb-4">
                                    <label className="text-sm font-medium text-gray-700 mb-2 block">Selecciona un Nivel:</label>
                                    <div className="space-y-2">
                                        {selectedServicio.niveles_precio?.map((nivel: any) => (
                                            <div
                                                key={nivel.id}
                                                onClick={() => setSelectedNivel(nivel)}
                                                className={`p-2 border rounded cursor-pointer transition-all ${selectedNivel?.id === nivel.id ? 'bg-white border-blue-500 ring-1 ring-blue-500 shadow-sm' : 'bg-white border-gray-200 hover:border-blue-300'}`}
                                            >
                                                <div className="flex justify-between items-center">
                                                    <span className="font-medium text-sm">{nivel.nombre}</span>
                                                    <span className="text-sm text-gray-600">${nivel.valor_impacto}</span>
                                                </div>
                                                <div className="text-xs text-gray-500 mt-1">
                                                    {nivel.tipo_impacto === 'precio_fijo' ? 'Precio Fijo Global' : 'Precio por Unidad'}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="p-3 bg-white border rounded mb-4">
                                    <div className="text-sm text-gray-500">Configuración Base</div>
                                    <div className="flex justify-between items-center mt-1">
                                        <span className="font-medium text-gray-900">
                                            {selectedServicio.tipo_impacto === 'precio_fijo' ? 'Precio Fijo' : 'Precio Unitario'}
                                        </span>
                                        <span className="font-bold text-lg text-green-600">
                                            ${selectedServicio.valor_impacto}
                                        </span>
                                    </div>
                                </div>
                            )}

                            {/* Resumen de Impacto */}
                            <div className="mt-auto pt-4 border-t border-gray-200">
                                {precioInfo && !precioInfo.error ? (
                                    <div className="space-y-3">
                                        {precioInfo.esGlobal && (
                                            <div className="bg-purple-50 text-purple-800 p-2 rounded text-xs flex items-start gap-2">
                                                <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                                <span>
                                                    Al ser un servicio de <strong>cobro fijo global</strong>, el costo total de ${precioInfo.precioTotal} se dividirá equitativamente entre los {selectedItemsCount} items.
                                                </span>
                                            </div>
                                        )}

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="text-center p-2 bg-white rounded border">
                                                <div className="text-xs text-gray-500">Costo por Item</div>
                                                <div className="font-semibold text-gray-900">
                                                    +${precioInfo.precioPorItem!.toFixed(2)}
                                                </div>
                                            </div>
                                            <div className="text-center p-2 bg-blue-50 rounded border border-blue-100">
                                                <div className="text-xs text-blue-600 font-medium">Incremento Total</div>
                                                <div className="font-bold text-blue-700 text-lg">
                                                    +${precioInfo.precioTotal!.toFixed(2)}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ) : precioInfo?.error ? (
                                    <div className="text-red-500 text-sm">{precioInfo.error}</div>
                                ) : (
                                    <div className="text-gray-400 text-sm italic text-center">
                                        Selecciona un nivel o servicio válido para ver el cálculo.
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="mt-4 pt-4 border-t flex justify-end gap-3">
                    <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleConfirmClick}
                        disabled={!selectedServicio || (selectedServicio.tiene_niveles_precio && !selectedNivel) || isSubmitting || !!precioInfo?.error}
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                        {isSubmitting ? (
                            <>
                                <Loader className="w-4 h-4 mr-2 animate-spin" />
                                Aplicando...
                            </>
                        ) : (
                            'Aplicar Servicio'
                        )}
                    </Button>
                </div>
            </div>
        </Modal>
    );
}
