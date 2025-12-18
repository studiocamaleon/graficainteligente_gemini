import { useState, useEffect } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Label } from '../../components/ui/Label';
import { Textarea } from '../../components/ui/Textarea';
import { Select } from '../../components/ui/Select';
import { supabase } from '../../lib/supabase';
import { Calendar } from 'lucide-react';

interface PresupuestoSaveDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (data: PresupuestoSaveData) => void;
    isLoading?: boolean;
    defaultValidez?: number; // Días por defecto
    clienteId: string;
}

export interface PresupuestoSaveData {
    fechaValidez: string;
    condicionesComerciales: string;
    notasInternas: string;
}

export function PresupuestoSaveDialog({
    isOpen,
    onClose,
    onConfirm,
    isLoading = false,
    defaultValidez = 7,
    clienteId
}: PresupuestoSaveDialogProps) {
    const [fechaValidez, setFechaValidez] = useState('');
    const [condicionesComerciales, setCondicionesComerciales] = useState('');
    const [notasInternas, setNotasInternas] = useState('');

    // Estado para plantillas de condiciones
    const [plantillasCondiciones, setPlantillasCondiciones] = useState<{ id: string, nombre: string, contenido: string }[]>([]);
    const [selectedPlantilla, setSelectedPlantilla] = useState('');
    const [loadingPlantillas, setLoadingPlantillas] = useState(false);

    // Inicializar fecha
    useEffect(() => {
        if (isOpen) {
            const fecha = new Date();
            fecha.setDate(fecha.getDate() + defaultValidez);
            setFechaValidez(fecha.toISOString().split('T')[0]);

            // Cargar plantillas
            loadCondiciones();
        }
    }, [isOpen, defaultValidez, clienteId]);

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
            if (!condicionesComerciales) {
                const defaultCond = data?.find((c: any) => c.es_default);
                if (defaultCond) {
                    setSelectedPlantilla(defaultCond.id);
                    setCondicionesComerciales(defaultCond.contenido);
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
            setCondicionesComerciales(plantilla.contenido);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onConfirm({
            fechaValidez,
            condicionesComerciales,
            notasInternas
        });
    };

    const renderFooter = () => (
        <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={onClose} disabled={isLoading}>
                Cancelar
            </Button>
            <Button type="submit" isLoading={isLoading} onClick={handleSubmit}>
                Generar Presupuesto
            </Button>
        </div>
    );

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Guardar como Presupuesto"
            size="md"
            footer={renderFooter()}
        >
            <div className="space-y-6">
                <p className="text-sm text-gray-500">
                    Complete los datos para generar la cotización. Esta acción no afectará producción ni finanzas.
                </p>

                <div className="space-y-4">
                    {/* Fecha Validez */}
                    <div>
                        <Label htmlFor="fechaValidez">Válido hasta</Label>
                        <div className="relative mt-1">
                            <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
                            <Input
                                id="fechaValidez"
                                type="date"
                                required
                                className="pl-9"
                                value={fechaValidez}
                                onChange={(e) => setFechaValidez(e.target.value)}
                                min={new Date().toISOString().split('T')[0]}
                            />
                        </div>
                    </div>

                    {/* Condiciones Comerciales - Selector */}
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

                    {/* Condiciones Comerciales - Texto */}
                    <div>
                        <Label htmlFor="condiciones">Detalle de Condiciones</Label>
                        <Textarea
                            id="condiciones"
                            value={condicionesComerciales}
                            onChange={(e) => setCondicionesComerciales(e.target.value)}
                            rows={4}
                            placeholder="Escriba las condiciones comerciales..."
                            className="font-mono text-sm"
                        />
                    </div>

                    {/* Notas Internas Adicionales */}
                    <div>
                        <Label htmlFor="notas" className="flex items-center gap-2">
                            Notas Internas <span className="text-gray-400 font-normal">(Opcional)</span>
                        </Label>
                        <Textarea
                            id="notas"
                            value={notasInternas}
                            onChange={(e) => setNotasInternas(e.target.value)}
                            rows={2}
                            placeholder="Notas visibles solo para el equipo..."
                        />
                    </div>
                </div>
            </div>
        </Modal>
    );
}
