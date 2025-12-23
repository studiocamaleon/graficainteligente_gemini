import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { format, addDays, startOfDay, addMinutes, setHours, setMinutes, isSameDay, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Clock, MapPin, User, Phone, CheckCircle2, Calendar as CalendarIcon, Loader2 } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Label } from '../../components/ui/Label';
import { Card } from '../../components/ui/card';

// Types for Public Config
interface PublicConfig {
    dias_habilitados: number[];
    horarios_disponibles: { inicio: string; fin: string }[];
    duracion_slot: number;
    deshabilitar_visitas_hoy: boolean;
    bloqueos: any[];
    hora_inicio?: string;
    hora_fin?: string;
    empresa_nombre?: string;
    empresa_logo?: string;
}

export function AgendarVisita() {
    const { companyId } = useParams<{ companyId: string }>();
    const [step, setStep] = useState<'loading' | 'calendar' | 'form' | 'success' | 'error'>('loading');
    const [config, setConfig] = useState<PublicConfig | null>(null);
    const [busySlots, setBusySlots] = useState<{ fecha_inicio: string; fecha_fin: string }[]>([]);

    // Selection State
    const [selectedDay, setSelectedDay] = useState(startOfDay(new Date()));
    const [selectedSlot, setSelectedSlot] = useState<Date | null>(null);

    // Form State
    const [formData, setFormData] = useState({
        nombre: '',
        whatsapp: '',
        domicilio: '',
        notas: ''
    });
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (companyId) {
            loadData();
        }
    }, [companyId]);

    const loadData = async () => {
        try {
            // 1. Load Config
            const { data: configData, error: configError } = await supabase.rpc('get_visitas_config_public', {
                p_company_id: companyId
            });

            if (configError) throw configError;
            setConfig(configData);

            // 2. Load Busy Slots (Next 30 days)
            const start = startOfDay(new Date());
            const end = addDays(start, 30);

            const { data: slotsData, error: slotsError } = await supabase.rpc('get_busy_slots_public', {
                p_company_id: companyId,
                p_start: start.toISOString(),
                p_end: end.toISOString()
            });

            if (slotsError) throw slotsError;
            setBusySlots(slotsData || []);

            setStep('calendar');
        } catch (err) {
            console.error(err);
            setStep('error');
        }
    };

    // --- Slot Generation (Reused logic mostly) ---
    const generateTimeSlots = () => {
        if (!config) return [];
        const now = new Date();
        const isToday = isSameDay(selectedDay, now);

        if (isToday && config.deshabilitar_visitas_hoy) return [];

        // Check Whole Day Block
        const dateStr = format(selectedDay, 'yyyy-MM-dd');
        const dayBlocked = config.bloqueos?.some((b: any) => b.fecha === dateStr && b.todo_el_dia);
        if (dayBlocked) return [];

        // Check Day of Week Enabled
        if (config.dias_habilitados && !config.dias_habilitados.includes(selectedDay.getDay())) {
            return [];
        }

        let slots: Date[] = [];
        const duration = config.duracion_slot || 60;

        let ranges = config.horarios_disponibles || [];
        if (ranges.length === 0 && config.hora_inicio && config.hora_fin) {
            ranges = [{ inicio: config.hora_inicio, fin: config.hora_fin }];
        }
        if (ranges.length === 0) ranges = [{ inicio: '08:00', fin: '18:00' }];

        ranges.forEach(range => {
            const [h1, m1] = range.inicio.split(':').map(Number);
            const [h2, m2] = range.fin.split(':').map(Number);

            let current = setMinutes(setHours(selectedDay, h1), m1);
            const rangeEnd = setMinutes(setHours(selectedDay, h2), m2);

            while (current < rangeEnd) {
                const slotEnd = addMinutes(current, duration);
                if (slotEnd <= rangeEnd) {
                    let isValid = true;
                    // Past check
                    if (isToday && current < now) isValid = false;

                    // Manual Block Check
                    if (isValid && config.bloqueos?.length) {
                        const slotTime = format(current, 'HH:mm');
                        const isBlocked = config.bloqueos.some((b: any) =>
                            b.fecha === dateStr && !b.todo_el_dia && b.hora_inicio === slotTime
                        );
                        if (isBlocked) isValid = false;
                    }

                    // Existing Visits Check (Busy Slots)
                    if (isValid && busySlots.length > 0) {
                        const isBusy = busySlots.some(busy => {
                            const bStart = parseISO(busy.fecha_inicio);
                            const bEnd = parseISO(busy.fecha_fin);
                            // Verify overlap: (StartA < EndB) and (EndA > StartB)
                            return current < bEnd && slotEnd > bStart;
                        });
                        if (isBusy) isValid = false;
                    }

                    if (isValid) slots.push(new Date(current));
                }
                current = addMinutes(current, duration);
            }
        });

        return slots.sort((a, b) => a.getTime() - b.getTime());
    };

    const handleSlotClick = (date: Date) => {
        setSelectedSlot(date);
        setStep('form');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedSlot || !config) return;

        setSubmitting(true);
        try {
            const duration = config.duracion_slot || 60;
            const endDate = addMinutes(selectedSlot, duration);

            const { data, error } = await supabase.functions.invoke('public-book-visit', {
                body: {
                    company_id: companyId,
                    cliente_nombre: formData.nombre,
                    cliente_whatsapp: formData.whatsapp,
                    domicilio: formData.domicilio,
                    fecha_inicio: selectedSlot.toISOString(),
                    fecha_fin: endDate.toISOString(),
                    titulo: 'Visita Web - ' + formData.nombre,
                    notas: formData.notas
                }
            });

            if (error) throw error;
            if (data && !data.success) throw new Error(data.error || 'Error al agendar');

            setStep('success');
        } catch (err: any) {
            console.error(err);
            alert(err.message || "Error al agendar");
        } finally {
            setSubmitting(false);
        }
    };

    if (step === 'loading') return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin w-8 h-8 text-blue-600" /></div>;
    if (step === 'error') return <div className="min-h-screen flex items-center justify-center text-red-600">Empresa no encontrada o enlace inválido.</div>;

    if (step === 'success') {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
                <Card className="w-full max-w-md p-8 text-center space-y-6 shadow-xl border-t-4 border-t-green-500">
                    <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                        <CheckCircle2 className="w-10 h-10 text-green-600" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800">¡Visita Agendada!</h2>
                        <p className="text-slate-600 mt-2">Te hemos enviado un mensaje de confirmación a tu WhatsApp.</p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-lg text-left text-sm space-y-2 border">
                        <p><span className="font-semibold text-slate-700">Fecha:</span> {format(selectedSlot!, "EEEE d 'de' MMMM", { locale: es })}</p>
                        <p><span className="font-semibold text-slate-700">Hora:</span> {format(selectedSlot!, "HH:mm")} hs</p>
                        <p><span className="font-semibold text-slate-700">Domicilio:</span> {formData.domicilio}</p>
                    </div>
                    <Button onClick={() => window.location.reload()} variant="outline" className="w-full">
                        Agendar otra visita
                    </Button>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 md:py-8">
            <div className="max-w-md mx-auto bg-white min-h-screen md:min-h-0 md:rounded-xl md:shadow-lg overflow-hidden flex flex-col">
                {/* Header */}
                <div className="bg-blue-600 p-6 text-white text-center">
                    {config?.empresa_logo ? (
                        <div className="bg-white p-2 rounded-lg inline-block mb-3 shadow-md">
                            <img src={config.empresa_logo} alt={config.empresa_nombre} className="h-12 w-auto object-contain" />
                        </div>
                    ) : null}
                    <h1 className="text-xl font-bold">{config?.empresa_nombre ? `Visita con ${config.empresa_nombre}` : 'Agendar Visita Técnica'}</h1>
                    <p className="opacity-80 text-sm mt-1">Selecciona el horario de tu preferencia</p>
                </div>

                <div className="flex-1 flex flex-col">
                    {step === 'calendar' ? (
                        <div className="p-4 space-y-6 flex-1">
                            {/* Day Navigation */}
                            <div className="flex items-center justify-between pb-4 border-b">
                                <Button variant="ghost" size="sm" onClick={() => setSelectedDay(addDays(selectedDay, -1))} disabled={isSameDay(selectedDay, new Date())}>
                                    <ChevronLeft className="w-5 h-5" />
                                </Button>
                                <div className="text-center">
                                    <h3 className="font-bold text-lg capitalize text-slate-800">
                                        {format(selectedDay, "EEEE d 'de' MMMM", { locale: es })}
                                    </h3>
                                    <p className="text-xs text-slate-500">
                                        Disponibilidad
                                    </p>
                                </div>
                                <Button variant="ghost" size="sm" onClick={() => setSelectedDay(addDays(selectedDay, 1))}>
                                    <ChevronLeft className="w-5 h-5 rotate-180" />
                                </Button>
                            </div>

                            {/* Slots */}
                            <div className="grid grid-cols-3 gap-3">
                                {generateTimeSlots().map((slot, i) => (
                                    <button
                                        key={i}
                                        onClick={() => handleSlotClick(slot)}
                                        className="flex flex-col items-center justify-center p-3 rounded-lg border border-slate-200 bg-white hover:border-blue-500 hover:shadow-md cursor-pointer text-slate-700 transition-all active:scale-95"
                                    >
                                        <span className="text-lg font-bold text-blue-600">{format(slot, 'HH:mm')}</span>
                                    </button>
                                ))}
                                {generateTimeSlots().length === 0 && (
                                    <div className="col-span-full text-center py-10 text-slate-400">
                                        <CalendarIcon className="w-12 h-12 mx-auto mb-2 opacity-20" />
                                        <p>No hay horarios disponibles.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        /* Form Step */
                        <form onSubmit={handleSubmit} className="p-6 space-y-6 flex-1 flex flex-col animate-in slide-in-from-right">
                            <div className="bg-blue-50 p-4 rounded-lg flex items-center gap-4 border border-blue-100">
                                <div className="bg-white p-2 rounded shadow-sm">
                                    <Clock className="w-5 h-5 text-blue-600" />
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-blue-800 uppercase">Horario Seleccionado</p>
                                    <p className="text-sm font-medium text-blue-900 capitalize">
                                        {format(selectedDay, "EEEE d", { locale: es })} - {selectedSlot && format(selectedSlot, "HH:mm")} hs
                                    </p>
                                </div>
                                <Button type="button" variant="ghost" size="sm" className="ml-auto" onClick={() => setStep('calendar')}>Cambiar</Button>
                            </div>

                            <div className="space-y-4 flex-1">
                                <div className="space-y-2">
                                    <Label>Nombre Completo</Label>
                                    <div className="relative">
                                        <User className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                                        <Input
                                            value={formData.nombre}
                                            onChange={e => setFormData({ ...formData, nombre: e.target.value })}
                                            className="pl-10"
                                            required
                                            placeholder="Tu nombre"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>WhatsApp de Contacto</Label>
                                    <div className="relative">
                                        <Phone className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                                        <Input
                                            value={formData.whatsapp}
                                            onChange={e => setFormData({ ...formData, whatsapp: e.target.value })}
                                            className="pl-10"
                                            required
                                            placeholder="Ej: 11 1234 5678"
                                            type="tel"
                                        />
                                    </div>
                                    <p className="text-xs text-slate-500">Te enviaremos la confirmación aquí.</p>
                                </div>
                                <div className="space-y-2">
                                    <Label>Dirección / Domicilio</Label>
                                    <div className="relative">
                                        <MapPin className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                                        <Input
                                            value={formData.domicilio}
                                            onChange={e => setFormData({ ...formData, domicilio: e.target.value })}
                                            className="pl-10"
                                            required
                                            placeholder="Calle, Altura, Localidad"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Notas Adicionales (Opcional)</Label>
                                    <textarea
                                        className="w-full rounded-md border border-slate-300 p-3 text-sm focus:ring-2 focus:ring-blue-500 min-h-[80px]"
                                        placeholder="Referencia, timbre, detalle del trabajo..."
                                        value={formData.notas}
                                        onChange={e => setFormData({ ...formData, notas: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="pt-4">
                                <Button type="submit" isLoading={submitting} className="w-full bg-blue-600 hover:bg-blue-700 text-lg py-6 shadow-lg shadow-blue-200">
                                    Confirmar Reserva
                                </Button>
                                <Button type="button" variant="ghost" className="w-full mt-2" onClick={() => setStep('calendar')}>
                                    Volver
                                </Button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
