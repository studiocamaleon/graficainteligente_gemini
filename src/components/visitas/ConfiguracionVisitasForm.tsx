import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import { Switch } from '../ui/Switch';
import { Modal } from '../ui/Modal';
import { Plus, Trash2, CheckCircle, Settings, CalendarDays } from 'lucide-react';
import { useVisitas } from '../../hooks/useVisitas';
import { VisitasConfig } from '../../types/database';
import { Tabs } from '../ui/Tabs';
import { CalendarioBloqueos } from './CalendarioBloqueos';

export function ConfiguracionVisitasForm() {
    const { loadConfig, updateConfig, loading } = useVisitas();
    const [activeTab, setActiveTab] = useState('general');

    // Config State
    const [config, setConfig] = useState<Partial<VisitasConfig>>({
        dias_habilitados: [1, 2, 3, 4, 5],
        horarios_disponibles: [{ inicio: '09:00', fin: '18:00' }],
        duracion_slot: 30
    });
    const [isSaving, setIsSaving] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);

    useEffect(() => {
        loadConfig().then(data => {
            if (data) {
                setConfig({
                    dias_habilitados: data.dias_habilitados,
                    horarios_disponibles: data.horarios_disponibles ||
                        (data.hora_inicio && data.hora_fin
                            ? [{ inicio: data.hora_inicio.slice(0, 5), fin: data.hora_fin.slice(0, 5) }]
                            : [{ inicio: '09:00', fin: '18:00' }]),
                    duracion_slot: data.duracion_slot,
                    deshabilitar_visitas_hoy: data.deshabilitar_visitas_hoy || false
                });
            }
        });
    }, [loadConfig]);

    const handleDayToggle = (dayIndex: number) => {
        const currentDays = config.dias_habilitados || [];
        const newDays = currentDays.includes(dayIndex)
            ? currentDays.filter(d => d !== dayIndex)
            : [...currentDays, dayIndex].sort();

        setConfig(prev => ({ ...prev, dias_habilitados: newDays }));
    };

    const handleAddRange = () => {
        setConfig(prev => ({
            ...prev,
            horarios_disponibles: [...(prev.horarios_disponibles || []), { inicio: '09:00', fin: '18:00' }]
        }));
    };

    const handleRemoveRange = (index: number) => {
        const currentRanges = config.horarios_disponibles || [];
        if (currentRanges.length <= 1) return;

        setConfig(prev => ({
            ...prev,
            horarios_disponibles: currentRanges.filter((_, i) => i !== index)
        }));
    };

    const handleRangeChange = (index: number, field: 'inicio' | 'fin', value: string) => {
        const currentRanges = [...(config.horarios_disponibles || [])];
        currentRanges[index] = { ...currentRanges[index], [field]: value };
        setConfig(prev => ({ ...prev, horarios_disponibles: currentRanges }));
    };

    const handleSave = async () => {
        try {
            setIsSaving(true);
            await updateConfig(config);
            setShowSuccessModal(true);
        } catch (err) {
            alert('Error al guardar configuración');
        } finally {
            setIsSaving(false);
        }
    };

    const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

    const tabs = [
        { id: 'general', label: 'General', icon: Settings },
        { id: 'bloqueos', label: 'Bloqueos de Agenda', icon: CalendarDays },
    ];

    return (
        <div className="space-y-6">
            <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

            {activeTab === 'general' ? (
                <Card>
                    <CardHeader>
                        <CardTitle>Configuración de Disponibilidad</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div>
                            <Label className="mb-2 block">Días Habilitados</Label>
                            <div className="flex flex-wrap gap-4">
                                {days.map((day, index) => (
                                    <div key={day} className="flex items-center gap-2">
                                        <Switch
                                            checked={Boolean(config.dias_habilitados?.includes(index))}
                                            onChange={() => handleDayToggle(index)}
                                        />
                                        <span className="text-sm">{day}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <Label>Rangos Horarios de Disponibilidad</Label>
                                <Button size="sm" variant="outline" onClick={handleAddRange}>
                                    <Plus className="w-4 h-4 mr-1" /> Agregar Rango
                                </Button>
                            </div>

                            <div className="space-y-3">
                                {config.horarios_disponibles?.map((range, index) => (
                                    <div key={index} className="flex items-end gap-3 p-3 bg-gray-50 rounded-md border">
                                        <div className="flex-1">
                                            <Label className="text-xs text-gray-500 mb-1 block">Inicio</Label>
                                            <Input
                                                type="time"
                                                value={range.inicio}
                                                onChange={(e) => handleRangeChange(index, 'inicio', e.target.value)}
                                            />
                                        </div>
                                        <div className="flex-1">
                                            <Label className="text-xs text-gray-500 mb-1 block">Fin</Label>
                                            <Input
                                                type="time"
                                                value={range.fin}
                                                onChange={(e) => handleRangeChange(index, 'fin', e.target.value)}
                                            />
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-red-500 hover:text-red-700 hover:bg-red-50 mb-[2px] h-8 w-8 p-0 flex items-center justify-center"
                                            onClick={() => handleRemoveRange(index)}
                                            disabled={(config.horarios_disponibles?.length || 0) <= 1}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div>
                            <Label>Duración de Turno (min)</Label>
                            <Input
                                type="number"
                                step="15"
                                min="15"
                                value={config.duracion_slot}
                                onChange={(e) => setConfig(prev => ({ ...prev, duracion_slot: Number(e.target.value) }))}
                                className="max-w-[150px]"
                            />
                        </div>

                        <div className="flex items-center justify-between p-4 border rounded-lg bg-slate-50">
                            <div className="space-y-0.5">
                                <Label className="text-base">Deshabilitar reservas para el día en curso</Label>
                                <p className="text-sm text-slate-500">
                                    Si se activa, los clientes (y el sistema) no podrán agendar visitas para "Hoy", aunque queden horarios disponibles.
                                </p>
                            </div>
                            <Switch
                                checked={config.deshabilitar_visitas_hoy || false}
                                onChange={(checked) => setConfig(prev => ({ ...prev, deshabilitar_visitas_hoy: checked }))}
                            />
                        </div>

                        <div className="flex justify-end">
                            <Button onClick={handleSave} isLoading={isSaving || loading}>
                                Guardar Cambios
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <div className="h-[600px]">
                    <CalendarioBloqueos />
                </div>
            )}

            {/* Success Modal */}
            <Modal
                isOpen={showSuccessModal}
                onClose={() => setShowSuccessModal(false)}
                title=""
            >
                <div className="flex flex-col items-center justify-center p-6 text-center">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                        <CheckCircle className="w-10 h-10 text-green-600" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">¡Configuración Guardada!</h3>
                    <p className="text-gray-500 mb-6">Los cambios en tu disponibilidad se han aplicado correctamente.</p>
                    <Button className="w-full" onClick={() => setShowSuccessModal(false)}>
                        Entendido
                    </Button>
                </div>
            </Modal>
        </div>
    );
}
