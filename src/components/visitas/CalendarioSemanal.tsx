import { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Loader2, Ban, Link as LinkIcon, Copy } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/card';
import { Visita, VisitasConfig } from '../../types/database';
import { useVisitas } from '../../hooks/useVisitas';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../contexts/ToastContext';
import { VisitaCard } from './VisitaCard';
import { NuevaVisitaModal } from './NuevaVisitaModal';
import { DetalleVisitaModal } from './DetalleVisitaModal';
import { differenceInMinutes, parseISO, isSameDay, setHours, setMinutes, format } from 'date-fns';
import { es } from 'date-fns/locale';

export function CalendarioSemanal() {
    const { company } = useAuth();
    const { showSuccess, showError } = useToast();
    const { loadVisitas, loadConfig, loading } = useVisitas();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [visitas, setVisitas] = useState<Visita[]>([]);
    const [config, setConfig] = useState<VisitasConfig | null>(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedSlot, setSelectedSlot] = useState<{ date: Date, time: string } | null>(null);

    // Detail Modal State
    const [detailVisita, setDetailVisita] = useState<Visita | null>(null);
    const [detailOpen, setDetailOpen] = useState(false);

    // Calculate week start (Monday)
    const weekStart = useMemo(() => {
        const d = new Date(currentDate);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is sunday
        return new Date(d.setDate(diff));
    }, [currentDate]);

    // Load data
    const fetchData = async () => {
        const start = new Date(weekStart);
        start.setHours(0, 0, 0, 0);
        const end = new Date(weekStart);
        end.setDate(end.getDate() + 6);
        end.setHours(23, 59, 59, 999);

        // Fetch visitas using ISO string to ensure we get everything intersecting this range
        const [visitasData, configData] = await Promise.all([
            loadVisitas(start, end),
            loadConfig()
        ]);

        console.log('Calendario: Visitas cargadas:', visitasData);
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

    const handleCopyLink = async () => {
        if (!company?.id) {
            showError("No se pudo obtener el ID de la empresa");
            return;
        }
        const url = `${window.location.origin}/agenda/${company.id}`;
        try {
            await navigator.clipboard.writeText(url);
            showSuccess("Link de agenda copiado al portapapeles");
        } catch (err) {
            showError("Error al copiar link");
        }
    };

    // Helper to click on slot
    const handleSlotClick = (date: Date, hour: number, minute: number) => {
        const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
        setSelectedSlot({ date, time: timeStr });
        setModalOpen(true);
    };

    const handleVisitClick = (visita: Visita) => {
        setDetailVisita(visita);
        setDetailOpen(true);
    };

    // Generate Days Columns
    const weekDays = useMemo(() => {
        const days = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(weekStart);
            d.setDate(d.getDate() + i);
            days.push(d);
        }
        return days;
    }, [weekStart]);

    // Generate Time Slots Rows
    const timeSlots = useMemo(() => {
        const slots: { h: number, m: number }[] = [];
        const duration = config?.duracion_slot || 60;

        // Normalize ranges or use default 9-18
        const ranges = config?.horarios_disponibles ||
            (config?.hora_inicio && config?.hora_fin
                ? [{ inicio: config.hora_inicio.slice(0, 5), fin: config.hora_fin.slice(0, 5) }]
                : [{ inicio: '09:00', fin: '18:00' }]);

        // 1. Determine Base Range from Config
        let earliestMin = 24 * 60;
        let latestMax = 0;

        ranges.forEach((r: any) => {
            const [h1, m1] = r.inicio.split(':').map(Number);
            const [h2, m2] = r.fin.split(':').map(Number);
            earliestMin = Math.min(earliestMin, h1 * 60 + m1);
            latestMax = Math.max(latestMax, h2 * 60 + m2);
        });

        // 2. Expand Range to include ANY loaded visit (dynamic sizing)
        if (visitas.length > 0) {
            visitas.forEach(v => {
                const d = parseISO(v.fecha_inicio);
                const mins = d.getHours() * 60 + d.getMinutes();
                earliestMin = Math.min(earliestMin, mins);
                // For end time, we roughly want to show the slot where it starts, 
                // but maybe extend max if it's very late.
                latestMax = Math.max(latestMax, mins + duration);
            });
        }

        // Round down earliestMin to nearest hour/slot boundary if possible
        const remainder = earliestMin % duration;
        if (remainder !== 0) earliestMin -= remainder;

        let currentMinute = earliestMin;

        // Ensure we cover up to latestMax
        while (currentMinute < latestMax) {
            const h = Math.floor(currentMinute / 60);
            const m = currentMinute % 60;

            // Add slot
            slots.push({ h, m });
            currentMinute += duration;
        }
        return slots;
    }, [config, visitas]);

    if (loading && !config) {
        return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;
    }

    return (
        <div className="h-full flex flex-col gap-4">
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
                <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={handleCopyLink} title="Copiar link para cliente">
                        <LinkIcon className="w-4 h-4 mr-2" />
                        Copiar Link Publico
                    </Button>
                    <Button onClick={() => { setSelectedSlot(null); setModalOpen(true); }}>
                        + Nueva Visita
                    </Button>
                </div>
            </div>

            {/* Calendar Grid */}
            <Card className="flex-1 overflow-hidden flex flex-col">
                <div className="overflow-auto flex-1">
                    <div className="grid grid-cols-[60px_repeat(7,1fr)] min-w-[800px] border-b">
                        {/* Header Row */}
                        <div className="p-2 border-r bg-gray-50 border-b"></div>
                        {weekDays.map(day => (
                            <div key={day.toISOString()} className={`p-2 border-r text-center border-b ${day.toDateString() === new Date().toDateString() ? 'bg-blue-50' : ''}`}>
                                <div className="font-medium text-sm capitalize">{day.toLocaleDateString('es-ES', { weekday: 'short' })}</div>
                                <div className="text-2xl font-bold">{day.getDate()}</div>
                            </div>
                        ))}

                        {/* Body Rows */}
                        {timeSlots.map(({ h, m }, index) => {
                            const timeLabel = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

                            // Check if this slot corresponds to a valid config range (for styling background)
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
                                    {/* Time Label */}
                                    <div className="p-2 border-r border-b text-xs text-gray-500 text-right sticky left-0 bg-white group-hover:bg-gray-50">
                                        {timeLabel}
                                    </div>

                                    {/* Day Cells */}
                                    {weekDays.map(day => {
                                        // Specific day enabled check
                                        const isDayEnabled = config?.dias_habilitados?.includes(day.getDay());
                                        const isSlotEnabled = isDayEnabled && slotInConfig;

                                        // Construct the exact Date object for this slot
                                        const slotDate = setMinutes(setHours(new Date(day), h), m);
                                        const dateStr = format(day, 'yyyy-MM-dd');
                                        const slotTime = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

                                        // Blocking Check
                                        const block = config?.bloqueos?.find(b =>
                                            b.fecha === dateStr &&
                                            !b.todo_el_dia &&
                                            b.hora_inicio === slotTime
                                        );
                                        const isBlock = !!block;
                                        const dayBlock = config?.bloqueos?.some(b => b.fecha === dateStr && b.todo_el_dia);

                                        // Find visits in this slot
                                        const visitsInSlot = visitas.filter(v => {
                                            const vDate = parseISO(v.fecha_inicio);
                                            // 1. Check same day
                                            if (!isSameDay(vDate, day)) return false;
                                            // 2. Check time match (tolerance 15 mins)
                                            const diff = differenceInMinutes(vDate, slotDate);
                                            return Math.abs(diff) < 15;
                                        });

                                        // Styles
                                        let bgClass = 'bg-white';
                                        let cursorClass = 'cursor-pointer';

                                        if (dayBlock) {
                                            bgClass = 'bg-red-50 opacity-50';
                                            cursorClass = 'cursor-not-allowed';
                                        } else if (isBlock) {
                                            bgClass = 'bg-[url("/patterns/diagonal-stripes.png")] bg-red-100 opacity-80';
                                            cursorClass = 'cursor-not-allowed';
                                        } else if (visitsInSlot.length > 0) {
                                            bgClass = 'bg-blue-50'; // Has visit
                                        } else if (isSlotEnabled) {
                                            bgClass = 'bg-emerald-50 hover:bg-emerald-100'; // OPEN
                                        } else {
                                            bgClass = 'bg-gray-100/50'; // Outside range
                                            cursorClass = 'cursor-default';
                                        }

                                        const canInteract = !dayBlock && !isBlock && isSlotEnabled;

                                        return (
                                            <div
                                                key={day.toISOString()}
                                                className={`border-r border-b p-1 min-h-[60px] relative transition-colors ${bgClass} ${cursorClass}`}
                                                onClick={() => canInteract && handleSlotClick(day, h, m)}
                                            >
                                                {/* Blocked Visualization */}
                                                {(isBlock || dayBlock) && (
                                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
                                                        <Ban className="w-6 h-6 text-red-600" />
                                                    </div>
                                                )}

                                                {visitsInSlot.map(visit => (
                                                    <div key={visit.id} className="absolute inset-x-1 top-1 bottom-1 z-10 p-1">
                                                        <VisitaCard
                                                            visita={visit}
                                                            onClick={handleVisitClick}
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </Card>

            <NuevaVisitaModal
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                onSuccess={fetchData}
                initialDate={selectedSlot?.date || currentDate}
                initialTime={selectedSlot?.time}
            />

            <DetalleVisitaModal
                isOpen={detailOpen}
                visita={detailVisita}
                onClose={() => setDetailOpen(false)}
            />
        </div>
    );
}
