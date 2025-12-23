import { useState, useMemo } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Search, Loader, Check, Info, Ruler, Clock } from 'lucide-react';
import { useServicios } from '../../hooks/useServicios';
import { Badge } from '../ui/Badge';
import { CATEGORIAS_SISTEMA } from '../../constants/categorias';

interface AplicarServicioMasivoModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedCount: number;
    onAplicar: (data: ServicioSeleccionado) => void;
    selectedItems?: any[];
}

export interface ServicioSeleccionado {
    servicio: any;
    nivel: any | null;
    precioTotalCalculado: number;
}

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS',
    }).format(value);
};

export function AplicarServicioMasivoModal({
    isOpen,
    onClose,
    selectedCount,
    onAplicar,
    selectedItems = []
}: AplicarServicioMasivoModalProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedServicio, setSelectedServicio] = useState<any | null>(null);
    const [selectedNivel, setSelectedNivel] = useState<any | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [customInputValue, setCustomInputValue] = useState<number>(1); // Para minutos u otros inputs manuales

    // Helper para métricas de items
    const metrics = useMemo(() => {
        let totalItems = 0;
        let totalPrice = 0;
        let totalM2 = 0;
        let totalLinearMeters = 0;

        selectedItems.forEach(item => {
            const qty = item.cantidad || 0;
            const price = item.precio_total || 0;
            const width = item.configuracion?.medida_ancho || 0; // cm
            const height = item.configuracion?.medida_alto || 0; // cm

            totalItems += qty;
            totalPrice += price;
            totalM2 += ((width * height) / 10000) * qty;

            // Asumimos el lado más largo como metros lineales si no está explícito,
            // o usamos 'alto' por convención. Para seguridad usamos el mayor.
            // Si el producto es de 'plotter', suele ser por largo.
            totalLinearMeters += (Math.max(width, height) / 100) * qty;
        });

        return { totalItems, totalPrice, totalM2, totalLinearMeters };
    }, [selectedItems]);

    // 1. Extraer IDs de categorías únicos de los items seleccionados
    const categoriasContexto = useMemo(() => {
        if (!selectedItems || selectedItems.length === 0) return [];

        const ids = new Set<string>();

        selectedItems.forEach(item => {
            // Special handling for legacy/simple Copy Center items
            if (item.tipo_item === 'centro_copiado') {
                const copyCenterId = Object.values(CATEGORIAS_SISTEMA).find(c => c.nombre === 'Centro de Copiado')?.id;
                if (copyCenterId) {
                    ids.add(copyCenterId);
                    return;
                }
            }

            if (item.categoria_id) {
                ids.add(item.categoria_id);
                return;
            }

            if (item.configuracion?.categoria_id) {
                ids.add(item.configuracion.categoria_id);
                return;
            }

            const catName = item.producto_categoria || item.configuracion?.categoria || item.configuracion?.categoria_nombre;
            if (catName) {
                const catEntry = Object.values(CATEGORIAS_SISTEMA).find(
                    c => c.nombre === catName || c.nombre.toLowerCase() === catName.toLowerCase()
                );
                if (catEntry) ids.add(catEntry.id);
            }
        });

        return Array.from(ids);
    }, [selectedItems]);

    const { servicios, loading } = useServicios({
        searchTerm,
        itemsPerPage: 50,
        isActive: true,
        categoriasIds: categoriasContexto.length > 0 ? categoriasContexto : undefined
    });

    const handleSelectServicio = (servicio: any) => {
        if (selectedServicio?.id === servicio.id) {
            setSelectedServicio(null);
            setSelectedNivel(null);
        } else {
            setSelectedServicio(servicio);
            setSelectedNivel(null);
        }
    };

    const precioInfo = useMemo(() => {
        // 1. Obtener datos base
        const base = selectedNivel || selectedServicio;
        if (!base) return { total: 0, tipo: 'sin_configuracion', label: 'Seleccionar servicio' };

        const tipo = base.tipo_impacto || 'sin_impacto';
        const val1 = base.valor_impacto || 0;
        const val2 = base.valor_impacto_secundario || 0;

        let total = 0;
        let label = '';

        switch (tipo) {
            case 'sin_impacto':
                total = 0;
                label = 'Sin cargo correpondiente';
                break;

            case 'precio_fijo':
                total = val1;
                label = `Precio fijo global: ${formatCurrency(val1)}`;
                break;

            case 'por_unidad':
                total = val1 * metrics.totalItems;
                label = `${formatCurrency(val1)} x ${metrics.totalItems} unidades`;
                break;

            case 'por_minuto':
                total = val1 * customInputValue;
                label = `${formatCurrency(val1)} x ${customInputValue} min`;
                break;

            case 'porcentual':
                total = metrics.totalPrice * (val1 / 100);
                label = `${val1}% de ${formatCurrency(metrics.totalPrice)}`;
                break;

            case 'por_mt2':
                total = val1 * metrics.totalM2;
                label = `${formatCurrency(val1)} x ${metrics.totalM2.toFixed(2)} m²`;
                break;

            case 'por_mt_lineal':
                total = val1 * metrics.totalLinearMeters;
                label = `${formatCurrency(val1)} x ${metrics.totalLinearMeters.toFixed(2)} ml`;
                break;

            // Mixtos
            case 'fijo_porcentual':
                total = val1 + (metrics.totalPrice * (val2 / 100));
                label = `Fijo ${formatCurrency(val1)} + ${val2}% de orden`;
                break;

            case 'fijo_mt2':
                total = val1 + (val2 * metrics.totalM2);
                label = `Fijo ${formatCurrency(val1)} + (${formatCurrency(val2)} x m²)`;
                break;

            case 'fijo_mt_lineal':
                total = val1 + (val2 * metrics.totalLinearMeters);
                label = `Fijo ${formatCurrency(val1)} + (${formatCurrency(val2)} x ml)`;
                break;

            case 'fijo_minuto':
                total = val1 + (val2 * customInputValue);
                label = `Fijo ${formatCurrency(val1)} + (${formatCurrency(val2)} x min)`;
                break;

            case 'por_mt2_manual':
                total = val1 * customInputValue;
                label = `${formatCurrency(val1)} x ${customInputValue} m² (manual)`;
                break;

            case 'fijo_mt2_manual':
                total = val1 + (val2 * customInputValue);
                label = `Fijo ${formatCurrency(val1)} + (${formatCurrency(val2)} x m² manual)`;
                break;

            default:
                total = 0;
                label = 'Tipo de impacto desconocido';
        }

        return { total, tipo, label };

    }, [selectedServicio, selectedNivel, metrics, customInputValue]);

    const handleSubmit = async () => {
        if (!selectedServicio) return;
        if (selectedServicio.tiene_niveles_precio && !selectedNivel) return;

        setIsSubmitting(true);
        try {
            await onAplicar({
                servicio: selectedServicio,
                nivel: selectedNivel,
                precioTotalCalculado: precioInfo.total
            });
            onClose();
        } catch (error) {
            console.error('Error aplicando servicio:', error);
        } finally {
            setIsSubmitting(false);
            setSelectedServicio(null);
            setSelectedNivel(null);
        }
    };

    const isTimeInput = ['por_minuto', 'fijo_minuto'].includes(precioInfo.tipo);
    const isManualMt2Input = ['por_mt2_manual', 'fijo_mt2_manual'].includes(precioInfo.tipo);
    const showCustomInput = isTimeInput || isManualMt2Input;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`Aplicar Servicio a ${selectedCount} items`}
            size="xl"
        >
            <div className="flex flex-col h-[70vh]">
                {/* Header con Info de Contexto */}
                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Info className="w-4 h-4 text-blue-500" />
                        <span>
                            {categoriasContexto.length > 0
                                ? "Mostrando servicios compatibles con los items seleccionados."
                                : "Mostrando todos los servicios disponibles globalmente."}
                        </span>
                    </div>
                    {categoriasContexto.length > 0 && (
                        <Badge variant="default" className="text-xs">
                            Fitrado por contexto
                        </Badge>
                    )}
                </div>

                {/* Buscador */}
                <div className="p-4 border-b border-gray-100">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <Input
                            placeholder="Buscar servicio..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9"
                            autoFocus
                        />
                    </div>
                </div>

                {/* Contenido Principal - Dos Columnas */}
                <div className="flex-1 overflow-hidden flex">
                    {/* Columna Izquierda: Lista de Servicios */}
                    <div className="w-1/2 overflow-y-auto border-r border-gray-100 p-4">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center h-40">
                                <Loader className="w-8 h-8 text-blue-600 animate-spin mb-2" />
                                <p className="text-sm text-gray-500">Cargando servicios...</p>
                            </div>
                        ) : servicios.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-40 text-center p-4">
                                <Search className="w-8 h-8 text-gray-300 mb-2" />
                                <p className="text-gray-500 font-medium">No se encontraron servicios</p>
                                <p className="text-sm text-gray-400">Intenta con otros términos de búsqueda</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {servicios.map((servicio) => (
                                    <button
                                        key={servicio.id}
                                        onClick={() => handleSelectServicio(servicio)}
                                        className={`w-full text-left p-3 rounded-lg border transition-all ${selectedServicio?.id === servicio.id
                                            ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500'
                                            : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                                            }`}
                                    >
                                        <div className="flex justify-between items-start mb-1">
                                            <span className={`font-medium ${selectedServicio?.id === servicio.id ? 'text-blue-700' : 'text-gray-900'
                                                }`}>
                                                {servicio.nombre}
                                            </span>
                                            {servicio.tiene_niveles_precio && (
                                                <Badge variant="primary" className="text-xs">
                                                    Opciones
                                                </Badge>
                                            )}
                                        </div>
                                        {servicio.estacion && (
                                            <span className="text-xs text-gray-500 flex items-center gap-1">
                                                {servicio.estacion.nombre}
                                            </span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Columna Derecha: Configuración */}
                    <div className="w-1/2 overflow-y-auto p-4 bg-gray-50/50">
                        {!selectedServicio ? (
                            <div className="h-full flex flex-col items-center justify-center text-gray-400 text-center p-8">
                                <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                                    <Check className="w-6 h-6 text-gray-300" />
                                </div>
                                <p>Selecciona un servicio de la lista para continuar</p>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900 mb-1">{selectedServicio.nombre}</h3>
                                    <div className="flex gap-2">
                                        {selectedServicio.estacion && (
                                            <Badge variant="default">{selectedServicio.estacion.nombre}</Badge>
                                        )}
                                        {precioInfo.tipo === 'precio_fijo' && (
                                            <Badge variant="purple" className="bg-purple-100 text-purple-800 border-purple-200">
                                                Precio Fijo Global
                                            </Badge>
                                        )}
                                    </div>
                                </div>

                                {/* Niveles de Precio (Si aplica) */}
                                {selectedServicio.tiene_niveles_precio ? (
                                    <div className="space-y-3">
                                        <label className="text-sm font-medium text-gray-700 block">
                                            Selecciona una opción:
                                        </label>
                                        <div className="grid gap-2">
                                            {selectedServicio.niveles_precio?.map((nivel: any) => (
                                                <button
                                                    key={nivel.id}
                                                    onClick={() => setSelectedNivel(nivel)}
                                                    className={`flex items-center justify-between p-3 rounded-md border text-sm transition-colors ${selectedNivel?.id === nivel.id
                                                        ? 'border-blue-500 bg-white ring-1 ring-blue-500'
                                                        : 'border-gray-200 bg-white hover:border-blue-300'
                                                        }`}
                                                >
                                                    <span className="font-medium text-gray-700">{nivel.nombre}</span>
                                                    <span className="font-semibold text-green-600">
                                                        {formatCurrency(nivel.valor_impacto)}
                                                        {['fijo_mt2', 'fijo_mt_lineal', 'fijo_porcentual', 'fijo_minuto'].includes(nivel.tipo_impacto) && ' + var'}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-white p-4 rounded-lg border border-gray-200">
                                        <div className="flex justify-between items-center">
                                            <span className="text-gray-600">Costo Base</span>
                                            <span className="text-xl font-bold text-green-600">
                                                {formatCurrency(selectedServicio.valor_impacto || 0)}
                                            </span>
                                        </div>
                                    </div>
                                )}

                                {/* Input para Minutos o Manual MT2 */}
                                {showCustomInput && (
                                    <div className="bg-white p-4 rounded-lg border border-blue-200 shadow-sm">
                                        <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                                            {isTimeInput ? <Clock className="w-4 h-4" /> : <Ruler className="w-4 h-4" />}
                                            {isTimeInput ? 'Cantidad de Minutos' : 'Metros Cuadrados (Manual)'}
                                        </label>
                                        <div className="flex items-center gap-2">
                                            <Input
                                                type="number"
                                                min={isTimeInput ? "1" : "0.01"}
                                                step={isTimeInput ? "1" : "0.01"}
                                                value={customInputValue}
                                                onChange={(e) => setCustomInputValue(Number(e.target.value) || 0)}
                                                className="w-full text-lg"
                                            />
                                            <span className="text-gray-500 font-medium">
                                                {isTimeInput ? 'min' : 'm²'}
                                            </span>
                                        </div>
                                        <p className="text-xs text-gray-500 mt-1">
                                            {isTimeInput
                                                ? 'Se utilizará para calcular el costo total del tiempo.'
                                                : 'Ingrese la cantidad de metros cuadrados a cobrar.'}
                                        </p>
                                    </div>
                                )}

                                {/* Resumen de Aplicación */}
                                {(!selectedServicio.tiene_niveles_precio || selectedNivel) && (
                                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                                        <h4 className="font-medium text-blue-900 mb-2 flex items-center gap-2">
                                            <Info className="w-4 h-4" />
                                            Cálculo:
                                        </h4>
                                        <ul className="space-y-1 text-sm text-blue-800">
                                            <li>• Se aplicará a <strong>{selectedCount} item(s)</strong>.</li>
                                            <li>• Método: <strong>{precioInfo.label}</strong></li>

                                            <li className="pt-2 border-t border-blue-200 mt-2 font-semibold flex justify-between items-center">
                                                <span>Total a sumar a la orden:</span>
                                                <span className="text-lg">{formatCurrency(precioInfo.total)}</span>
                                            </li>
                                        </ul>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-100 bg-white flex justify-end gap-2">
                    <Button variant="outline" onClick={onClose}>
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={!selectedServicio || (selectedServicio.tiene_niveles_precio && !selectedNivel) || isSubmitting}
                        isLoading={isSubmitting}
                    >
                        Aplicar Servicio
                    </Button>
                </div>
            </div>
        </Modal>
    );
}
