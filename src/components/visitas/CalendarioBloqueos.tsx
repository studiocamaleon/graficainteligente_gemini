import { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Loader2, Ban } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/card';
import { VisitasConfig, Visita } from '../../types/database';
import { useVisitas } from '../../hooks/useVisitas';
import { parseISO, isSameDay, setHours, setMinutes, format } from 'date-fns';
import { es } from 'date-fns/locale';

export function CalendarioBloqueos() {
    const { loadVisitas, loadConfig, updateConfig, loading } = useVisitas();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [visitas, setVisitas] = useState<Visita[]>([]);
    const [config, setConfig] = useState<VisitasConfig | null>(null);
    const [saving, setSaving] = useState(false);

    // Calculate week start (Monday)
    const weekStart = useMemo(() => {
        const d = new Date(currentDate);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        return new Date(d.setDate(diff));
    }, [currentDate]);

    // Load data
    const fetchData = async () => {
        const start = new Date(weekStart);
        start.setHours(0, 0, 0, 0);
        const end = new Date(weekStart);
        end.setDate(end.getDate() + 6);
        end.setHours(23, 59, 59, 999);

        const [visitasData, configData] = await Promise.all([
            loadVisitas(start, end),
            loadConfig()
        ]);
        setVisitas(visitasData);
        setConfig(configData);
    };

    useEffect(() => {
        fetchData();
    }, [weekStart]);

    // Navigation
    const nextWeek = () => {
        const d = new Date(currentDate);
        d.setDate(d.getDate() + 7);
        setCurrentDate(d);
    };

    const prevWeek = () => {
        const d = new Date(currentDate);
        d.setDate(d.getDate() - 7);
        setCurrentDate(d);
    };

    const goToToday = () => setCurrentDate(new Date());

    // --- Blocking Logic ---

    const handleBlockSlot = async (date: Date, h: number, m: number) => {
        if (!config || saving) return;

        const dateStr = format(date, 'yyyy-MM-dd');
        const startTime = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

        // Calculate end time (duration)
        const d = new Date(date);
        d.setHours(h, m, 0, 0);
        d.setMinutes(d.getMinutes() + (config.duracion_slot || 60));
        const endTime = format(d, 'HH:mm');

        const newBlock = {
            id: crypto.randomUUID(),
            fecha: dateStr,
            todo_el_dia: false,
            hora_inicio: startTime,
            hora_fin: endTime,
            motivo: 'Bloqueo manual'
        };

        const currentBlocks = config.bloqueos || [];
        const updatedBlocks = [...currentBlocks, newBlock];

        setSaving(true);
        try {
            await updateConfig({ ...config, bloqueos: updatedBlocks });
            setConfig(prev => prev ? ({ ...prev, bloqueos: updatedBlocks }) : null);
        } catch (err) {
            console.error(err);
            alert("Error al guardar bloqueo");
        } finally {
            setSaving(false);
        }
    };

    const handleBlockDay = async (date: Date) => {
        if (!config || saving) return;

        const dateStr = format(date, 'yyyy-MM-dd');
        const newBlock = {
            id: crypto.randomUUID(),
            fecha: dateStr,
            todo_el_dia: true,
            motivo: 'Día completo bloqueado'
        };

        const currentBlocks = config.bloqueos || [];
        const updatedBlocks = [...currentBlocks, newBlock];

        setSaving(true);
        try {
            await updateConfig({ ...config, bloqueos: updatedBlocks });
            setConfig(prev => prev ? ({ ...prev, bloqueos: updatedBlocks }) : null);
        } catch (err) {
            alert("Error al bloquear día");
        } finally {
            setSaving(false);
        }
    };

    const handleUnblock = async (blockId: string) => {
        if (!config || saving) return;

        const currentBlocks = config.bloqueos || [];
        const updatedBlocks = currentBlocks.filter(b => b.id !== blockId);

        setSaving(true);
        try {
            await updateConfig({ ...config, bloqueos: updatedBlocks });
            setConfig(prev => prev ? ({ ...prev, bloqueos: updatedBlocks }) : null);
        } catch (err) {
            alert("Error al eliminar bloqueo");
        } finally {
            setSaving(false);
        }
    };

    // Generate Days/Slots (Same logic as Calendar)
    const weekDays = useMemo(() => {
        const days = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(weekStart);
            d.setDate(d.getDate() + i);
            days.push(d);
        }
        return days;
    }, [weekStart]);

    const timeSlots = useMemo(() => {
        if (!config) return [];
        const slots: { h: number, m: number }[] = [];
        const duration = config.duracion_slot || 60;

        let spans = config.horarios_disponibles || [{ inicio: '08:00', fin: '18:00' }];
        // Simplify: just show 8 to 20 for blocking purposes if simpler, OR follow config ranges
        // Let's follow config ranges to be consistent

        let min = 24 * 60;
        let max = 0;
        spans.forEach((r: any) => {
            const [h1, m1] = r.inicio.split(':').map(Number);
            const [h2, m2] = r.fin.split(':').map(Number);
            min = Math.min(min, h1 * 60 + m1);
            max = Math.max(max, h2 * 60 + m2);
        });

        // Align
        const rem = min % duration;
        if (rem !== 0) min -= rem;

        let curr = min;
        while (curr < max) {
            slots.push({ h: Math.floor(curr / 60), m: curr % 60 });
            curr += duration;
        }
        return slots;
    }, [config]);

    if (loading && !config) {
        return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;
    }

    return (
        <div className="h-full flex flex-col gap-4">
            <div className="flex items-center justify-between p-4 bg-red-50 border border-red-100 rounded-lg">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-red-100 rounded-full">
                        <Ban className="w-5 h-5 text-red-600" />
                    </div>
                    <div>
                        <h3 className="font-bold text-red-900">Modo Bloqueo de Agenda</h3>
                        <p className="text-sm text-red-700">
                            Haz click en un casillero vacío para bloquearlo. Haz click en el nombre del día para bloquear todo el día.
                        </p>
                    </div>
                </div>
            </div>

            {/* Header Controls */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={prevWeek}><ChevronLeft className="w-4 h-4" /></Button>
                    <Button variant="outline" size="sm" onClick={goToToday}>Hoy</Button>
                    <Button variant="outline" size="sm" onClick={nextWeek}><ChevronRight className="w-4 h-4" /></Button>
                    <span className="font-semibold text-lg ml-2 capitalize">
                        {weekStart.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
                    </span>
                </div>
            </div>

            <Card className="flex-1 overflow-hidden flex flex-col shadow-sm border-slate-200">
                <div className="overflow-auto flex-1">
                    <div className="grid grid-cols-[60px_repeat(7,1fr)] min-w-[800px] border-b">
                        <div className="p-2 border-r bg-slate-50 border-b"></div>
                        {weekDays.map(day => {
                            const dateStr = format(day, 'yyyy-MM-dd');
                            const dayBlock = config?.bloqueos?.find(b => b.fecha === dateStr && b.todo_el_dia);
                            const isDayBlocked = !!dayBlock;

                            return (
                                <div key={day.toISOString()} className={`p-2 border-r text-center border-b transition-colors ${isDayBlocked ? 'bg-red-100' : 'hover:bg-slate-50'}`}>
                                    <div className="font-medium text-sm capitalize">{day.toLocaleDateString('es-ES', { weekday: 'short' })}</div>
                                    <div className="text-2xl font-bold">{day.getDate()}</div>

                                    <Button
                                        variant={isDayBlocked ? "danger" : "ghost"}
                                        size="sm"
                                        className="mt-1 h-6 text-[10px] w-full"
                                        onClick={() => isDayBlocked ? handleUnblock(dayBlock!.id) : handleBlockDay(day)}
                                    >
                                        {isDayBlocked ? 'Desbloquear' : 'Bloquear Día'}
                                    </Button>
                                </div>
                            );
                        })}

                        {timeSlots.map(({ h, m }, index) => {
                            const timeLabel = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

                            // Check if this slot corresponds to a valid config range
                            const slotInConfig = config?.horarios_disponibles ? (config.horarios_disponibles as any[]).some(r => {
                                const [h1, m1] = r.inicio.split(':').map(Number);
                                const [h2, m2] = r.fin.split(':').map(Number);
                                const startRange = h1 * 60 + m1;
                                const endRange = h2 * 60 + m2;
                                const current = h * 60 + m;
                                return current >= startRange && current < endRange;
                            }) : true;

                            return (
                                <div key={index} className="contents group">
                                    <div className="p-2 border-r border-b text-xs text-gray-500 text-right sticky left-0 bg-white">
                                        {timeLabel}
                                    </div>

                                    {weekDays.map(day => {
                                        const dateStr = format(day, 'yyyy-MM-dd');
                                        const slotTime = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

                                        // Availability Checks
                                        const isDayEnabled = config?.dias_habilitados?.includes(day.getDay());
                                        const isSlotEnabled = isDayEnabled && slotInConfig;

                                        // Find Block
                                        const block = config?.bloqueos?.find(b =>
                                            b.fecha === dateStr &&
                                            !b.todo_el_dia &&
                                            b.hora_inicio === slotTime
                                        );
                                        const isBlock = !!block;
                                        const dayBlock = config?.bloqueos?.some(b => b.fecha === dateStr && b.todo_el_dia);

                                        // Check existing visits (just for context)
                                        const visit = visitas.find(v => {
                                            const vDate = parseISO(v.fecha_inicio);
                                            return isSameDay(vDate, day) && vDate.getHours() === h && vDate.getMinutes() === m;
                                        });

                                        // Define styles
                                        let bgClass = 'bg-white'; // Default unknown
                                        let cursorClass = 'cursor-pointer';

                                        if (dayBlock) {
                                            bgClass = 'bg-red-50 opacity-50';
                                            cursorClass = 'cursor-not-allowed';
                                        } else if (isBlock) {
                                            bgClass = 'bg-[url("/patterns/diagonal-stripes.png")] bg-red-100 hover:bg-red-200';
                                        } else if (visit) {
                                            bgClass = 'bg-blue-50'; // Has visit
                                        } else if (isSlotEnabled) {
                                            bgClass = 'bg-emerald-50 hover:bg-emerald-100'; // OPEN FOR BLOCKING
                                        } else {
                                            bgClass = 'bg-gray-100/50'; // Outside range
                                        }

                                        return (
                                            <div
                                                key={day.toISOString()}
                                                className={`
                                                    border-r border-b p-1 min-h-[50px] relative transition-all
                                                    ${bgClass} ${cursorClass}
                                                `}
                                                onClick={() => {
                                                    if (dayBlock) return;
                                                    if (isBlock) handleUnblock(block!.id);
                                                    else handleBlockSlot(day, h, m);
                                                }}
                                            >
                                                {isBlock && (
                                                    <div className="h-full w-full flex items-center justify-center text-red-500">
                                                        <Ban className="w-5 h-5" />
                                                    </div>
                                                )}

                                                {visit && !isBlock && !dayBlock && (
                                                    <div className="bg-blue-100 text-blue-700 text-[10px] p-1 rounded opacity-60 pointer-events-none">
                                                        {visit.cliente_nombre || 'Cliente'} (Ocupado)
                                                    </div>
                                                )}

                                                {/* Visual hint for open slots */}
                                                {isSlotEnabled && !isBlock && !dayBlock && !visit && (
                                                    <div className="hidden group-hover:flex items-center justify-center h-full w-full opacity-0 hover:opacity-100 transition-opacity">
                                                        <Ban className="w-4 h-4 text-emerald-600 opacity-50" />
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </Card>
        </div>
    );
}
