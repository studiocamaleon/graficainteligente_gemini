import { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import {
    Package,
    Trash2,
    Settings2,
    PlusCircle,
    Layers,
    ChevronRight,
    Info,
    Edit2
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../contexts/ToastContext';
import { UniversalAddItemWizard } from '../wizard/UniversalAddItemWizard';
import { ConfigDetailRenderer } from '../shared/ConfigDetailRenderer';

interface ConstructorConfiguratorProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (productData: any) => void;
    initialData?: any;
}

interface Componente {
    id: string;
    tipo_componente: string;
    referencia_id: string | null;
    categoria: string | null;
    categoria_id: string | null;
    nombre_personalizado: string;
    cantidad_por_unidad: number;
    configuracion: any;
    precio_unitario: number;
    precio_total: number;
}

export function ConstructorConfigurator({
    isOpen,
    onClose,
    onSave,
    initialData
}: ConstructorConfiguratorProps) {
    const { profile } = useAuth();
    const { showSuccess, showError } = useToast();

    const [nombre, setNombre] = useState(initialData?.producto_nombre || '');
    const [categoriaId, setCategoriaId] = useState(
        initialData?.categoria_id ||
        initialData?.categoriaId ||
        initialData?.configuracion?.categoria_id ||
        ''
    );
    const [rutaProduccionId, setRutaProduccionId] = useState(initialData?.ruta_produccion_id || '');
    const [medidaAncho, setMedidaAncho] = useState(initialData?.configuracion?.medida_ancho || 0);
    const [medidaAlto, setMedidaAlto] = useState(initialData?.configuracion?.medida_alto || 0);
    const [cantidad, setCantidad] = useState(initialData?.cantidad || 1);
    const [guardarComoPlantilla, setGuardarComoPlantilla] = useState(false);

    const [componentes, setComponentes] = useState<Componente[]>(initialData?.componentes || []);
    const [showWizard, setShowWizard] = useState(false);
    const [categorias, setCategorias] = useState<any[]>([]);
    const [rutas, setRutas] = useState<any[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [editingComponentId, setEditingComponentId] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            loadInitialData();
        }
    }, [isOpen]);

    const loadInitialData = async () => {
        try {
            const [catsRes, rutasRes] = await Promise.all([
                supabase.from('categorias').select('id, nombre').eq('is_active', true).order('nombre'),
                supabase.from('rutas_produccion').select('id, nombre').eq('is_active', true).order('nombre')
            ]);

            if (catsRes.data) setCategorias(catsRes.data);
            if (rutasRes.data) setRutas(rutasRes.data);
        } catch (err) {
            // console.error('Error loading initial data:', err);
        }
    };

    const handleAddComponent = async (itemData: any) => {
        if (editingComponentId) {
            // EDIT MODE
            setComponentes(prev => prev.map(c => c.id === editingComponentId ? {
                ...c,
                tipo_componente: itemData.tipo_item || c.tipo_componente,
                referencia_id: itemData.producto_id,
                categoria: itemData.categoria || c.categoria,
                categoria_id: itemData.categoria_id || c.categoria_id,
                // nombre_personalizado: c.nombre_personalizado, // Mantenemos el nombre personalizado que ya tenía
                cantidad_por_unidad: itemData.cantidad,
                configuracion: itemData.configuracion,
                precio_unitario: itemData.precio_unitario_final || 0,
                precio_total: itemData.precio_total || 0
            } : c));
            setEditingComponentId(null);
        } else {
            // ADD MODE
            const newComponent: Componente = {
                id: `comp-${Date.now()}`,
                tipo_componente: itemData.tipo_item || 'catálogo',
                referencia_id: itemData.producto_id,
                categoria: itemData.categoria || null,
                categoria_id: itemData.categoria_id || null,
                nombre_personalizado: itemData.producto_nombre,
                cantidad_por_unidad: itemData.cantidad,
                configuracion: itemData.configuracion,
                precio_unitario: itemData.precio_unitario_final || 0,
                precio_total: itemData.precio_total || 0
            };
            setComponentes([...componentes, newComponent]);
        }
        setShowWizard(false);
    };

    useEffect(() => {
        if (isOpen) {
            if (initialData?.configuracion?.es_compuesto) {
                setNombre(initialData.producto_nombre);
                // Intento robusto de obtener el ID de categoría
                const catId = initialData.categoria_id ||
                    initialData.categoriaId ||
                    initialData.configuracion.categoria_id ||
                    '';
                setCategoriaId(catId);
                setCantidad(initialData.cantidad || 1);
                setRutaProduccionId(initialData.configuracion.ruta_produccion_id || '');
                setMedidaAncho(initialData.configuracion.medida_ancho || 0);
                setMedidaAlto(initialData.configuracion.medida_alto || 0);

                if (initialData.configuracion.componentes) {
                    setComponentes(initialData.configuracion.componentes.map((c: any) => ({
                        id: `comp-${Math.random()}`,
                        tipo_componente: c.tipo || (c.config?.cantidad_copias ? 'centro_copiado' : 'catalogo'),
                        referencia_id: c.referencia_id,
                        categoria: c.categoria || null,
                        categoria_id: c.categoria_id || (c.config?.cantidad_copias ? 'centro_copiado' : null),
                        nombre_personalizado: c.nombre,
                        cantidad_por_unidad: c.cantidad,
                        configuracion: c.config,
                        precio_unitario: c.precio || 0,
                        precio_total: (c.precio || 0) * (c.cantidad || 1)
                    })));
                }
            } else if (!initialData) {
                // Reset states for NEW product
                setNombre('');
                setCategoriaId('');
                setCantidad(1);
                setRutaProduccionId('');
                setMedidaAncho(0);
                setMedidaAlto(0);
                setComponentes([]);
            }
        }
    }, [isOpen, initialData]);

    const removeComponent = (id: string) => {
        setComponentes(prev => prev.filter(c => c.id !== id));
    };

    const updateComponent = (id: string, updates: Partial<Componente>) => {
        setComponentes(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
    };

    const totalCosto = componentes.reduce((sum, c) => sum + c.precio_total, 0);
    const precioSugerido = totalCosto; // Podríamos aplicar un margen aquí si fuera necesario

    const handleFinalSave = async () => {
        if (!nombre || !categoriaId || componentes.length === 0) {
            showError('Por favor completa el nombre, categoría y añade al menos un componente');
            return;
        }

        setIsSaving(true);
        try {
            const { data: categoria } = await (supabase as any)
                .from('categorias')
                .select('nombre')
                .eq('id', categoriaId)
                .single();

            const descripcionAutomatica = componentes.map(c =>
                `${c.nombre_personalizado} (${c.cantidad_por_unidad}u)`
            ).join(', ');


            // Agregar servicios y acabados de forma única para la ruta de producción global
            const allServicios: any[] = [];
            const allAcabados: any[] = [];
            componentes.forEach(c => {
                const s = c.configuracion?.servicios_seleccionados || c.configuracion?.servicios || [];
                const a = c.configuracion?.acabados_seleccionados || c.configuracion?.acabados || [];
                allServicios.push(...s);
                allAcabados.push(...a);
            });

            // Deduplicar (el primero que encuentre gana si hay niveles diferentes)
            const uniqueServiceIds = new Set();
            const finalServicios = allServicios.filter(s => {
                const id = s.servicio_id || s.id;
                if (!id || uniqueServiceIds.has(id)) return false;
                uniqueServiceIds.add(id);
                return true;
            });

            const uniqueAcabadoIds = new Set();
            const finalAcabados = allAcabados.filter(a => {
                const id = a.acabado_id || a.id;
                if (!id || uniqueAcabadoIds.has(id)) return false;
                uniqueAcabadoIds.add(id);
                return true;
            });

            const productPayload = {
                id: initialData?.id || `temp-${Date.now()}-${Math.random()}`,
                tipo_item: 'personalizado',
                producto_id: initialData?.producto_id || null,
                producto_nombre: nombre,
                producto_categoria: categoria?.nombre || 'General',
                categoria_id: categoriaId,
                descripcion: descripcionAutomatica || 'Producto construido personalizado',
                cantidad: cantidad,
                precio_base: precioSugerido,
                precio_servicios: 0,
                precio_acabados: 0,
                precio_unitario_final: precioSugerido,
                precio_total: precioSugerido * cantidad,
                configuracion: {
                    es_compuesto: true,
                    categoria_id: categoriaId,
                    medida_ancho: medidaAncho,
                    medida_alto: medidaAlto,
                    ruta_produccion_id: rutaProduccionId,
                    servicios_seleccionados: finalServicios,
                    acabados_seleccionados: finalAcabados,
                    componentes: componentes.map(c => ({
                        nombre: c.nombre_personalizado,
                        cantidad: c.cantidad_por_unidad,
                        tipo: c.tipo_componente,
                        referencia_id: c.referencia_id,
                        categoria: c.categoria,
                        categoria_id: c.categoria_id,
                        config: c.configuracion,
                        precio: c.precio_unitario
                    }))
                },
                rutas_generadas: [] // Se generarán basándose en la rutaProduccionId al procesar la orden
            };

            if (guardarComoPlantilla) {
                // Lógica para persistir en productos_personalizados
                const { data: savedProd, error: prodError } = await (supabase as any)
                    .from('productos_personalizados')
                    .insert({
                        company_id: profile?.company_id,
                        nombre,
                        categoria_id: categoriaId,
                        ruta_produccion_id: rutaProduccionId || null,
                        medidas_ancho: medidaAncho,
                        medidas_alto: medidaAlto,
                        es_plantilla: true,
                        created_by: profile?.id
                    })
                    .select()
                    .single();

                if (prodError) throw prodError;

                if (savedProd) {
                    const compsToInsert = componentes.map(c => ({
                        producto_personalizado_id: savedProd.id,
                        tipo_componente: mapToDbTipo(c.tipo_componente),
                        referencia_id: c.referencia_id,
                        nombre_personalizado: c.nombre_personalizado,
                        cantidad_por_unidad: c.cantidad_por_unidad,
                        configuracion: c.configuracion
                    }));

                    const { error: compsError } = await (supabase as any)
                        .from('producto_personalizado_componentes')
                        .insert(compsToInsert);

                    if (compsError) throw compsError;

                    productPayload.producto_id = savedProd.id;
                }
            }

            onSave(productPayload);
            showSuccess('Producto construido exitosamente');
            onClose();
        } catch (err: any) {
            // console.error('Error saving composite product:', err);
            showError('Error al guardar el producto: ' + err.message);
        } finally {
            setIsSaving(false);
        }
    };

    const mapToDbTipo = (tipo: string) => {
        // Mapper simple para el enum de la DB
        if (tipo === 'centro_copiado') return 'centro_copiado';
        if (tipo === 'catalogo') return 'laser'; // Asunción segura por ahora
        return 'servicio';
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} size="xl" title="Constructor de Productos">
            <div className="flex flex-col h-[80vh]">
                {/* Header Content */}
                <div className="p-6 border-b bg-gray-50/50">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del Producto</label>
                                <Input
                                    placeholder="Ej: Libro de Autor Premium"
                                    value={nombre}
                                    onChange={e => setNombre(e.target.value)}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Categoría (Reporte)</label>
                                    <Select
                                        value={categoriaId}
                                        onChange={(val) => setCategoriaId(val)}
                                        options={categorias.map(c => ({ value: c.id, label: c.nombre }))}
                                        placeholder="Elegir categoría..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Plantilla de Ruta</label>
                                    <Select
                                        value={rutaProduccionId}
                                        onChange={(val) => setRutaProduccionId(val)}
                                        options={rutas.map(r => ({ value: r.id, label: r.nombre }))}
                                        placeholder="Usar ruta maestra..."
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Ancho Final (cm)</label>
                                    <Input
                                        type="number"
                                        value={medidaAncho}
                                        onChange={e => setMedidaAncho(Number(e.target.value))}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Alto Final (cm)</label>
                                    <Input
                                        type="number"
                                        value={medidaAlto}
                                        onChange={e => setMedidaAlto(Number(e.target.value))}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Cantidad a Producir</label>
                                <Input
                                    type="number"
                                    value={cantidad}
                                    onChange={e => setCantidad(Number(e.target.value))}
                                    min={1}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Components List */}
                <div className="flex-1 overflow-y-auto p-6">
                    <div className="flex items-center justify-between mb-4">
                        <div className="space-y-1">
                            <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
                                <Layers className="w-5 h-5 text-blue-600" />
                                Componentes y Materiales
                            </h3>
                            <p className="text-xs text-blue-600 font-medium">
                                * Define los componentes necesarios para construir 1 unidad de este producto.
                            </p>
                        </div>
                        <Button onClick={() => setShowWizard(true)} size="sm" className="bg-blue-600">
                            <PlusCircle className="w-4 h-4 mr-2" />
                            Añadir Parte
                        </Button>
                    </div>

                    {componentes.length === 0 ? (
                        <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                            <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                            <p className="text-gray-500">No has añadido componentes aún</p>
                            <p className="text-sm text-gray-400">Combina papeles, impresiones y servicios</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {componentes.map((comp) => (
                                <div key={comp.id} className="flex flex-col p-4 bg-white border rounded-lg hover:shadow-sm transition-shadow gap-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="p-2 bg-blue-50 rounded-lg">
                                                <Settings2 className="w-5 h-5 text-blue-600" />
                                            </div>
                                            <div className="flex-1">
                                                <Input
                                                    value={comp.nombre_personalizado}
                                                    onChange={(e) => updateComponent(comp.id, { nombre_personalizado: e.target.value })}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            (e.target as HTMLInputElement).blur();
                                                        }
                                                    }}
                                                    className="h-8 py-0 px-2 font-medium text-gray-900 border-none hover:bg-gray-50 focus:bg-white focus:ring-1 focus:ring-blue-500 w-full"
                                                    placeholder="Nombre del componente..."
                                                />
                                                <div className="text-sm text-gray-500 px-2">
                                                    {comp.cantidad_por_unidad}u • {comp.tipo_componente}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-6">
                                            <div className="text-right">
                                                <div className="text-sm font-medium text-gray-900">${comp.precio_total.toFixed(2)}</div>
                                                <div className="text-xs text-gray-500">${comp.precio_unitario.toFixed(2)} c/u</div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => {
                                                        setEditingComponentId(comp.id);
                                                        setShowWizard(true);
                                                    }}
                                                    className="text-gray-400 hover:text-blue-600 transition-colors"
                                                    title="Editar configuración"
                                                >
                                                    <Edit2 className="w-5 h-5" />
                                                </button>
                                                <button
                                                    onClick={() => removeComponent(comp.id)}
                                                    className="text-gray-400 hover:text-red-600 transition-colors"
                                                    title="Eliminar"
                                                >
                                                    <Trash2 className="w-5 h-5" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Detalle del Componente */}
                                    <div className="pl-14 border-t pt-2">
                                        <ConfigDetailRenderer
                                            config={comp.configuracion}
                                            tipoItem={comp.tipo_componente}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer Summary */}
                <div className="p-6 border-t bg-gray-50">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-8">
                            <div>
                                <p className="text-sm text-gray-500">Costo Base Unitario</p>
                                <p className="text-2xl font-bold text-gray-900">${precioSugerido.toFixed(2)}</p>
                            </div>
                            <ChevronRight className="w-6 h-6 text-gray-300" />
                            <div>
                                <p className="text-sm text-gray-500">Subtotal p/ {cantidad} unidades</p>
                                <p className="text-2xl font-bold text-blue-600">${(precioSugerido * cantidad).toFixed(2)}</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2 mr-4 bg-white p-2 px-4 rounded-lg border shadow-sm">
                                <input
                                    type="checkbox"
                                    id="plantilla"
                                    checked={guardarComoPlantilla}
                                    onChange={e => setGuardarComoPlantilla(e.target.checked)}
                                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                />
                                <label htmlFor="plantilla" className="text-sm text-gray-700 cursor-pointer select-none">
                                    Guardar en catálogo
                                </label>
                            </div>
                            <Button variant="secondary" onClick={onClose}>Cancelar</Button>
                            <Button
                                onClick={handleFinalSave}
                                className="bg-blue-600 hover:bg-blue-700 px-8"
                                disabled={isSaving}
                            >
                                {isSaving ? 'Guardando...' : 'Confirmar Producto'}
                            </Button>
                        </div>
                    </div>

                    <div className="flex items-start gap-2 text-xs text-gray-500">
                        <Info className="w-4 h-4 mt-0.5 text-blue-500" />
                        <p>
                            Este producto se manejará como un único ítem en producción.
                            Si seleccionaste una plantilla de ruta, los pasos se generarán automáticamente.
                        </p>
                    </div>
                </div>
            </div>

            {showWizard && (
                <UniversalAddItemWizard
                    isOpen={showWizard}
                    onClose={() => {
                        setShowWizard(false);
                        setEditingComponentId(null);
                    }}
                    onAgregar={handleAddComponent}
                    initialData={editingComponentId ? (() => {
                        const comp = componentes.find(c => c.id === editingComponentId);
                        if (!comp) return null;
                        return {
                            id: comp.referencia_id,
                            producto_id: comp.referencia_id,
                            producto_nombre: comp.nombre_personalizado,
                            categoria: comp.categoria,
                            categoria_id: comp.categoria_id,
                            tipo_item: comp.tipo_componente,
                            cantidad: comp.cantidad_por_unidad,
                            configuracion: comp.configuracion
                        };
                    })() : null}
                    isEditing={!!editingComponentId}
                />
            )}
        </Modal>
    );
}
