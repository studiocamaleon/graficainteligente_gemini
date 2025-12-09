import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sun, Moon, Sunset, CheckCircle, Package, AlertCircle } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

interface WelcomeIntroProps {
    stats: {
        ordenesPendientes: number;
        entregasHoy: number;
        ordenesEnProceso: number;
    };
    loading?: boolean;
}

export function WelcomeIntro({ stats, loading }: WelcomeIntroProps) {
    const { profile } = useAuth();
    const [isVisible, setIsVisible] = useState(false);
    const [greeting, setGreeting] = useState('');
    const [timeIcon, setTimeIcon] = useState<any>(Sun);

    useEffect(() => {
        // Verificar si ya se mostró en esta sesión
        const hasSeenWelcome = sessionStorage.getItem('hasSeenWelcome');

        // Si no se ha mostrado y no está cargando los datos
        if (!hasSeenWelcome && !loading) {
            setIsVisible(true);
            sessionStorage.setItem('hasSeenWelcome', 'true');

            // Determinar saludo según la hora
            const hour = new Date().getHours();
            if (hour >= 5 && hour < 12) {
                setGreeting('Buenos días');
                setTimeIcon(Sun);
            } else if (hour >= 12 && hour < 20) {
                setGreeting('Buenas tardes');
                setTimeIcon(Sunset);
            } else {
                setGreeting('Buenas noches');
                setTimeIcon(Moon);
            }

            // Ocultar automáticamente después de unos segundos
            const timer = setTimeout(() => {
                setIsVisible(false);
            }, 4500); // 4.5 segundos de duración

            return () => clearTimeout(timer);
        }
    }, [loading]);

    if (!isVisible) return null;

    const Icon = timeIcon;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-md p-4"
                onClick={() => setIsVisible(false)} // Permitir cerrar al click
            >
                <motion.div
                    initial={{ scale: 0.9, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.95, opacity: 0, y: -20 }}
                    transition={{ duration: 0.6, type: 'spring', bounce: 0.3 }}
                    className="bg-white/80 backdrop-filter backdrop-blur-xl border border-white/40 shadow-2xl rounded-3xl p-8 md:p-12 max-w-2xl w-full text-center relative overflow-hidden"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Fondo decorativo sutil */}
                    <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500" />
                    <div className="absolute -top-20 -right-20 w-64 h-64 bg-blue-400/10 rounded-full blur-3xl" />
                    <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-purple-400/10 rounded-full blur-3xl" />

                    {/* Saludo Principal */}
                    <div className="relative z-10">
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ delay: 0.2, type: 'spring' }}
                            className="w-20 h-20 bg-gradient-to-br from-white to-gray-100 rounded-2xl shadow-xl flex items-center justify-center mx-auto mb-6 border border-white/50"
                        >
                            <Icon className="w-10 h-10 text-amber-500" />
                        </motion.div>

                        <motion.h2
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                            className="text-4xl md:text-5xl font-bold text-gray-800 tracking-tight mb-2"
                        >
                            {greeting}, {profile?.full_name?.split(' ')[0] || 'Usuario'}
                        </motion.h2>

                        <motion.p
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.4 }}
                            className="text-gray-500 text-lg mb-8"
                        >
                            Aquí tienes el resumen para hoy
                        </motion.p>
                    </div>

                    {/* Resumen del Día */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.6 }}
                        className="grid grid-cols-1 md:grid-cols-3 gap-4 relative z-10"
                    >
                        {/* Entregas Hoy */}
                        <div className={`p-4 rounded-2xl border ${stats.entregasHoy > 0 ? 'bg-red-50/80 border-red-100' : 'bg-gray-50/50 border-gray-100'}`}>
                            <div className="flex justify-center mb-2">
                                <AlertCircle className={`w-6 h-6 ${stats.entregasHoy > 0 ? 'text-red-500' : 'text-gray-400'}`} />
                            </div>
                            <div className="text-3xl font-bold text-gray-800 mb-1">{stats.entregasHoy}</div>
                            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Para Entregar Hoy</div>
                        </div>

                        {/* Pendientes */}
                        <div className="p-4 rounded-2xl border bg-blue-50/80 border-blue-100">
                            <div className="flex justify-center mb-2">
                                <Package className="w-6 h-6 text-blue-500" />
                            </div>
                            <div className="text-3xl font-bold text-gray-800 mb-1">{stats.ordenesPendientes}</div>
                            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Nuevas Órdenes</div>
                        </div>

                        {/* En Proceso */}
                        <div className="p-4 rounded-2xl border bg-green-50/80 border-green-100">
                            <div className="flex justify-center mb-2">
                                <CheckCircle className="w-6 h-6 text-green-500" />
                            </div>
                            <div className="text-3xl font-bold text-gray-800 mb-1">{stats.ordenesEnProceso}</div>
                            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">En Producción</div>
                        </div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 1 }}
                        className="mt-8 text-sm text-gray-400"
                    >
                        Presiona cualquier lugar para continuar
                    </motion.div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
