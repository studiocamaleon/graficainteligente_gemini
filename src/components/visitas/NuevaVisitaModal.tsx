import { useState, useEffect } from 'react';
import { useDebounce } from '../../hooks/useDebounce';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import { useClients } from '../../hooks/useClients';
import { useVisitas } from '../../hooks/useVisitas';
import { VisitasConfig, Visita } from '../../types/database';
import { format, addMinutes, startOfDay, addDays, setHours, setMinutes, isSameDay, isWithinInterval, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Clock, MapPin, User, Building, Search, Phone, Users, Calendar as CalendarIcon, ChevronLeft } from 'lucide-react';

import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { sendWatiMessage } from '../../lib/wati';

interface NuevaVisitaModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    initialDate?: Date;
    initialTime?: string;
}

export function NuevaVisitaModal({ isOpen, onClose, onSuccess, initialDate, initialTime }: NuevaVisitaModalProps) {
    // Hooks
    const { createVisita, loadConfig, loadVisitas } = useVisitas();
    const { profile } = useAuth();

    // Client Search State (with Debounce)
    const [searchTerm, setSearchTerm] = useState('');
    const debouncedSearchTerm = useDebounce(searchTerm, 300);
    const [showClientResults, setShowClientResults] = useState(false);
    const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

    // FIX: Use server-side search with debounce
    const { clients, refetch: loadClients, loading: loadingClients } = useClients({
        searchTerm: debouncedSearchTerm,
        itemsPerPage: 20
    });

    // State
    const [step, setStep] = useState<'slots' | 'details'>('slots');
    const [config, setConfig] = useState<VisitasConfig | null>(null);
    const [loading, setLoading] = useState(false);
    const [initializing, setInitializing] = useState(true);

    // Slots Data
    const [existingVisitas, setExistingVisitas] = useState<Visita[]>([]);
    const [selectedDay, setSelectedDay] = useState<Date>(startOfDay(new Date()));

    // Form State
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [titulo, setTitulo] = useState('Visita Técnica');
    const [clienteNombre, setClienteNombre] = useState('');
    const [clienteWhatsapp, setClienteWhatsapp] = useState('');
    const [clienteEmpresa, setClienteEmpresa] = useState('');
    const [domicilio, setDomicilio] = useState('');
    const [descripcion, setDescripcion] = useState('');

    // New Features State
    const [staffList, setStaffList] = useState<any[]>([]);
    const [selectedStaffId, setSelectedStaffId] = useState<string>('');
    const [status] = useState<'pendiente' | 'confirmada'>('confirmada');



    // Initial Load & Reset
    useEffect(() => {
        if (isOpen) {
            const init = async () => {
                setInitializing(true);
                // Load Config
                const cfg = await loadConfig();
                setConfig(cfg);

                // Load Visits for overlap check (next 15 days)
                const start = startOfDay(new Date());
                const end = addDays(start, 15);
                const visits = await loadVisitas(start, end);
                setExistingVisitas(visits);
                setInitializing(false);

                // Load Active Staff
                const { data: staff } = await supabase.from('visitas_staff')
                    .select('*')
                    .eq('activo', true)
                    .order('nombre');
                if (staff) setStaffList(staff);
            };
            init();

            // Determine Start Step
            // If we have both date and time (clicked from slot), go to details
            // If we only have date (clicked "New Visit" on a day) or nothing, show slots
            if (initialDate && initialTime) {
                const [h, m] = initialTime.split(':').map(Number);
                const d = new Date(initialDate);
                d.setHours(h, m, 0, 0);
                setSelectedDate(d);
                setStep('details');
            } else {
                setStep('slots');
                setSelectedDate(null);
                if (initialDate) {
                    setSelectedDay(startOfDay(initialDate));
                } else {
                    setSelectedDay(startOfDay(new Date()));
                }
            }

            // Reset Form Fields
            setTitulo('Visita Técnica');
            setSelectedClientId('');
            setClienteNombre('');
            setClienteEmpresa('');
            setClienteWhatsapp('');
            setDomicilio('');
            setDescripcion('');
            setSearchTerm('');
            loadClients();
        }
    }, [isOpen, initialDate, initialTime]);

    const handleClientSelect = (client: any) => {
        setSelectedClientId(client.id);
        setClienteNombre(client.nombre_fantasia || client.razon_social);
        setClienteEmpresa(client.razon_social || '');
        setClienteWhatsapp(client.whatsapp || '');
        setDomicilio(client.direccion || '');
        setSearchTerm('');
        setShowClientResults(false);
    };



    // --- Slot Generation Logic ---
    // --- Slot Generation Logic ---
    const generateTimeSlots = () => {
        if (!config) return [];

        const now = new Date();
        const isToday = isSameDay(selectedDay, now);

        // 1. Check if "Today" is disabled
        if (isToday && config.deshabilitar_visitas_hoy) {
            console.log('DEBUG: Visits disabled for today by config');
            return [];
        }

        // 1B. Check for "Whole Day" blocks
        const dateStr = format(selectedDay, 'yyyy-MM-dd');
        const dayBlocked = config.bloqueos?.some(b => b.fecha === dateStr && b.todo_el_dia);

        if (dayBlocked) {
            console.log('DEBUG: Day blocked by manual block');
            return [];
        }

        let slots: Date[] = [];
        const duration = config.duracion_slot || 60;

        // Determine ranges: use headers OR legacy start/end
        let ranges = config.horarios_disponibles || [];

        // Fallback if no ranges defined but legacy fields exist
        if (ranges.length === 0 && config.hora_inicio && config.hora_fin) {
            ranges = [{ inicio: config.hora_inicio, fin: config.hora_fin }];
        }

        // Fallback default
        if (ranges.length === 0) {
            ranges = [{ inicio: '08:00', fin: '18:00' }];
        }

        // Iterate all ranges
        ranges.forEach(range => {
            if (!range.inicio || !range.fin) return;

            const startHour = parseInt(range.inicio.split(':')[0]);
            const startMin = parseInt(range.inicio.split(':')[1] || '0');
            const endHour = parseInt(range.fin.split(':')[0]);
            const endMin = parseInt(range.fin.split(':')[1] || '0');

            let current = setMinutes(setHours(selectedDay, startHour), startMin);
            const rangeEnd = setMinutes(setHours(selectedDay, endHour), endMin);

            while (current < rangeEnd) {
                // Determine slot end
                const slotEnd = addMinutes(current, duration);

                // Only add if slot finishes before or exactly at range end
                if (slotEnd <= rangeEnd) {
                    // 2. Filter Past Slots if "Today"
                    let isValid = true;
                    if (isToday && current < now) {
                        isValid = false;
                    }

                    // 3. Filter Blocked Ranges
                    if (isValid && config.bloqueos?.length) {
                        const slotStartTime = format(current, 'HH:mm');
                        const isBlocked = config.bloqueos.some(b => {
                            if (b.fecha !== dateStr) return false;
                            if (b.todo_el_dia) return true;

                            // Check overlap? Actually strict equality for start time is usually enough if grid is aligned
                            // But let's check basic overlap or exact match to be safe.
                            // Simplified: Just match start time for now as visually we block slots by start time
                            return b.hora_inicio === slotStartTime;
                        });
                        if (isBlocked) isValid = false;
                    }

                    if (isValid) {
                        slots.push(new Date(current));
                    }
                }

                current = addMinutes(current, duration);
            }
        });

        // Sort by time
        return slots.sort((a, b) => a.getTime() - b.getTime());
    };

    const isSlotAvailable = (slotDate: Date) => {
        const duration = config?.duracion_slot || 60;
        const slotEnd = addMinutes(slotDate, duration);

        // Check against existing visits
        return !existingVisitas.some(v => {
            const vStart = parseISO(v.fecha_inicio);
            const vEnd = parseISO(v.fecha_fin);
            // Overlap condition: (StartA < EndB) and (EndA > StartB)
            return slotDate < vEnd && slotEnd > vStart;
        });
    };

    const handleSlotClick = (date: Date) => {
        setSelectedDate(date);
        setStep('details');
    };

    // --- Form Submission ---
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!selectedDate || !titulo || !clienteNombre) {
            alert("Por favor completa los campos principales.");
            return;
        }

        try {
            setLoading(true);
            const duration = config?.duracion_slot || 60;
            const endDateTime = addMinutes(selectedDate, duration);

            const newVisita = await createVisita({
                titulo,
                cliente_nombre: clienteNombre,
                cliente_empresa: clienteEmpresa,
                cliente_whatsapp: clienteWhatsapp,
                domicilio,
                descripcion,
                fecha_inicio: selectedDate.toISOString(),
                fecha_fin: endDateTime.toISOString(),
                estado: status,
                cliente_id: selectedClientId || null,
                staff_id: selectedStaffId || null,
                orden_id: null
            });

            if (newVisita) {
                console.log('Visit created:', newVisita.id);
                // Send Wati Notification if client has whatsapp
                if (clienteWhatsapp && profile?.company_id) {
                    sendWatiMessage({
                        companyId: profile.company_id,
                        phone: clienteWhatsapp,
                        message: `Hola ${clienteNombre}, se ha agendado una visita técnica para el ${format(selectedDate, "d 'de' MMMM 'a las' HH:mm", { locale: es })} hs. Título: ${titulo}.`,
                        metadata: {
                            tipo: 'nueva_visita',
                            visita_id: newVisita.id
                        }
                    }).catch(err => {
                        console.error('Error sending Wati notification for visit:', err);
                    });
                }
            }

            onSuccess();
            onClose();
        } catch (err) {
            console.error(err);
            alert("Error al crear la visita");
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={step === 'slots' ? "Seleccionar Horario" : "Detalles de Visita"} size="lg">
            {step === 'slots' ? (
                /* --- STEP 1: SLOTS SELECTION --- */
                <div className="space-y-6">
                    {/* Day Selection */}
                    <div className="flex items-center justify-between pb-4 border-b">
                        <Button variant="ghost" size="sm" onClick={() => setSelectedDay(addDays(selectedDay, -1))} disabled={isSameDay(selectedDay, new Date())}>
                            <ChevronLeft className="w-5 h-5" />
                        </Button>
                        <div className="text-center">
                            <h3 className="font-bold text-lg capitalize text-slate-800">
                                {format(selectedDay, "EEEE d 'de' MMMM", { locale: es })}
                            </h3>
                            <p className="text-xs text-slate-500">
                                {existingVisitas.filter(v => isSameDay(parseISO(v.fecha_inicio), selectedDay)).length} visitas agendadas
                            </p>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => setSelectedDay(addDays(selectedDay, 1))}>
                            <ChevronLeft className="w-5 h-5 rotate-180" />
                        </Button>
                    </div>

                    {/* Slots Grid */}
                    {initializing ? (
                        <div className="p-10 text-center text-slate-500">Cargando disponibilidad...</div>
                    ) : (
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 max-h-[400px] overflow-y-auto p-1">
                            {generateTimeSlots().map((slot, i) => {
                                const available = isSlotAvailable(slot);
                                return (
                                    <button
                                        key={i}
                                        onClick={() => available && handleSlotClick(slot)}
                                        disabled={!available}
                                        className={`
                                            flex flex-col items-center justify-center p-3 rounded-lg border transition-all
                                            ${available
                                                ? 'bg-white border-slate-200 hover:border-blue-500 hover:shadow-md cursor-pointer text-slate-700'
                                                : 'bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed'}
                                        `}
                                    >
                                        <span className="text-sm font-bold">{format(slot, 'HH:mm')}</span>
                                        <span className="text-[10px] uppercase mt-1">
                                            {available ? 'Libre' : 'Ocupado'}
                                        </span>
                                    </button>
                                );
                            })}
                            {generateTimeSlots().length === 0 && (
                                <div className="col-span-full text-center py-8 text-slate-500">
                                    No hay horarios configurados para este día.
                                </div>
                            )}
                        </div>
                    )}
                </div>
            ) : (
                /* --- STEP 2: DETAILS FORM --- */
                <form onSubmit={handleSubmit} className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">

                    {/* Date/Time Banner with Back Button */}
                    <div className="bg-blue-50 p-4 rounded-lg flex items-center justify-between border border-blue-100">
                        <div className="flex items-center gap-4">
                            <div className="p-2 bg-white rounded-md shadow-sm">
                                <Clock className="w-5 h-5 text-blue-600" />
                            </div>
                            <div>
                                <p className="text-sm font-semibold uppercase tracking-wide opacity-70 text-blue-800">Fecha y Hora</p>
                                <p className="text-lg font-bold capitalize text-blue-900">
                                    {selectedDate ? format(selectedDate, "EEEE d 'de' MMMM - HH:mm", { locale: es }) : 'Seleccione horario'} hs
                                </p>
                            </div>
                        </div>
                        <Button type="button" variant="secondary" size="sm" onClick={() => setStep('slots')}>
                            Cambiar Horario
                        </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Left Column: Client Data */}
                        <div className="space-y-4">
                            <div className="space-y-2 relative">
                                <Label>Buscar Cliente (Opcional)</Label>
                                <div className="relative">
                                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                                    <Input
                                        className="pl-9"
                                        placeholder="Escribe para buscar..."
                                        value={searchTerm}
                                        onChange={e => { setSearchTerm(e.target.value); setShowClientResults(true); }}
                                        onFocus={() => setShowClientResults(true)}
                                    />
                                </div>
                                {showClientResults && searchTerm && (
                                    <div className="absolute top-full left-0 right-0 bg-white border rounded-md shadow-lg z-50 mt-1 max-h-48 overflow-y-auto">
                                        {loadingClients ? (
                                            <div className="p-4 text-center text-sm text-slate-500">Buscando...</div>
                                        ) : clients.length > 0 ? (
                                            clients.map(c => (
                                                <div
                                                    key={c.id}
                                                    className="p-2 hover:bg-slate-50 cursor-pointer text-sm"
                                                    onClick={() => handleClientSelect(c)}
                                                >
                                                    <div className="font-bold">{c.nombre_fantasia}</div>
                                                    <div className="text-xs text-slate-500">{c.razon_social}</div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="p-4 text-center text-sm text-slate-500">No se encontraron resultados</div>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label>Nombre Contacto *</Label>
                                <div className="relative">
                                    <User className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                                    <Input value={clienteNombre} onChange={e => setClienteNombre(e.target.value)} className="pl-9" placeholder="Ej: Juan Pérez" required />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>WhatsApp (para notificaciones) *</Label>
                                <div className="relative">
                                    <Phone className="absolute left-3 top-2.5 w-4 h-4 text-green-600" />
                                    <Input value={clienteWhatsapp} onChange={e => setClienteWhatsapp(e.target.value)} className="pl-9" placeholder="549..." required />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Empresa / Local</Label>
                                <div className="relative">
                                    <Building className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                                    <Input value={clienteEmpresa} onChange={e => setClienteEmpresa(e.target.value)} className="pl-9" placeholder="Ej: Kiosco Pepe" />
                                </div>
                            </div>
                        </div>

                        {/* Right Column: Details */}
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label>Domicilio *</Label>
                                <div className="relative">
                                    <MapPin className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                                    <Input value={domicilio} onChange={e => setDomicilio(e.target.value)} className="pl-9" placeholder="Calle y altura..." required />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Asignar Técnico (Equipo)</Label>
                                <div className="relative">
                                    <Users className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                                    <select
                                        className="w-full rounded-md border border-slate-300 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                        value={selectedStaffId}
                                        onChange={e => setSelectedStaffId(e.target.value)}
                                    >
                                        <option value="">-- Sin asignar (Notificar a todos) --</option>
                                        {staffList.map(s => (
                                            <option key={s.id} value={s.id}>{s.nombre} ({s.rol})</option>
                                        ))}
                                    </select>
                                </div>
                                <p className="text-xs text-slate-500">Se notificará a todos los activos de todas formas.</p>
                            </div>

                            <div className="space-y-2">
                                <Label>Título / Referencia *</Label>
                                <Input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ej: Medición de Vidriera" required />
                            </div>

                            <div className="space-y-2">
                                <Label>Notas / Descripción</Label>
                                <textarea
                                    className="w-full h-24 rounded-md border border-slate-300 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    value={descripcion}
                                    onChange={e => setDescripcion(e.target.value)}
                                    placeholder="Detalles del trabajo..."
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t">
                        <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
                        <Button type="submit" isLoading={loading} className="bg-blue-600 hover:bg-blue-700 text-white">
                            Confirmar Visita
                        </Button>
                    </div>
                </form>
            )}
        </Modal>
    );
}
