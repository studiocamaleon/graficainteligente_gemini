import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Package, TrendingUp, Clock } from 'lucide-react';

interface WelcomeOverlayProps {
    userName?: string;
    stats?: {
        ordenesPendientes: number;
        entregasHoy: number;
        [key: string]: any;
    };
    tasaCumplimiento?: {
        tasa_cumplimiento: number | string;
        [key: string]: any;
    } | null;
}

export function WelcomeOverlay({ userName, stats, tasaCumplimiento }: WelcomeOverlayProps) {
    const [isVisible, setIsVisible] = useState(false);
    const [shouldRender, setShouldRender] = useState(false);

    useEffect(() => {
        // Check if we've shown the welcome message in this session
        const hasSeenWelcome = sessionStorage.getItem('welcome_seen');

        if (!hasSeenWelcome) {
            setShouldRender(true);
            setIsVisible(true);
            // Mark as seen immediately so it doesn't show again on reload
            sessionStorage.setItem('welcome_seen', 'true');

            // Auto dismiss after 5 seconds
            const timer = setTimeout(() => {
                setIsVisible(false);
            }, 5000);

            const cleanupTimer = setTimeout(() => {
                setShouldRender(false);
            }, 5800); // Wait for exit animation

            return () => {
                clearTimeout(timer);
                clearTimeout(cleanupTimer);
            };
        }
    }, []);

    if (!shouldRender) return null;

    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Buenos días' : hour < 20 ? 'Buenas tardes' : 'Buenas noches';
    const firstName = userName?.split(' ')[0] || 'Hola';

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-white/40 backdrop-blur-xl"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ y: '-100%', opacity: 0, transition: { duration: 0.8, ease: [0.32, 0, 0.67, 0] } }}
                    onClick={() => setIsVisible(false)}
                >
                    <div className="max-w-2xl w-full px-6 text-center">
                        <motion.div
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.2 }}
                            className="mb-8"
                        >
                            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-2">
                                {greeting}, <span className="text-blue-600">{firstName}</span>
                            </h1>
                            <p className="text-xl text-gray-500">
                                Aquí tienes tu resumen para hoy
                            </p>
                        </motion.div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* Entregas Hoy */}
                            <motion.div
                                initial={{ y: 20, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ delay: 0.3, type: "spring" }}
                                className="bg-white/80 backdrop-blur-md p-6 rounded-2xl shadow-xl border border-white/20"
                            >
                                <div className="flex justify-center mb-4">
                                    <div className="p-3 bg-blue-100 rounded-full">
                                        <Package className="w-6 h-6 text-blue-600" />
                                    </div>
                                </div>
                                <div className="text-3xl font-bold text-gray-900 mb-1">
                                    {stats?.entregasHoy || 0}
                                </div>
                                <div className="text-sm font-medium text-gray-500">
                                    Entregas para hoy
                                </div>
                            </motion.div>

                            {/* Pendientes */}
                            <motion.div
                                initial={{ y: 20, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ delay: 0.4, type: "spring" }}
                                className="bg-white/80 backdrop-blur-md p-6 rounded-2xl shadow-xl border border-white/20"
                            >
                                <div className="flex justify-center mb-4">
                                    <div className="p-3 bg-orange-100 rounded-full">
                                        <Clock className="w-6 h-6 text-orange-600" />
                                    </div>
                                </div>
                                <div className="text-3xl font-bold text-gray-900 mb-1">
                                    {stats?.ordenesPendientes || 0}
                                </div>
                                <div className="text-sm font-medium text-gray-500">
                                    Órdenes pendientes
                                </div>
                            </motion.div>

                            {/* Cumplimiento */}
                            <motion.div
                                initial={{ y: 20, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ delay: 0.5, type: "spring" }}
                                className="bg-white/80 backdrop-blur-md p-6 rounded-2xl shadow-xl border border-white/20"
                            >
                                <div className="flex justify-center mb-4">
                                    <div className="p-3 bg-green-100 rounded-full">
                                        <TrendingUp className="w-6 h-6 text-green-600" />
                                    </div>
                                </div>
                                <div className="text-3xl font-bold text-gray-900 mb-1">
                                    {tasaCumplimiento ? Math.round(Number(tasaCumplimiento.tasa_cumplimiento)) : 0}%
                                </div>
                                <div className="text-sm font-medium text-gray-500">
                                    Tasa de cumplimiento
                                </div>
                            </motion.div>
                        </div>

                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 1 }}
                            className="mt-12 text-gray-400 text-sm"
                        >
                            Toca cualquier parte para continuar
                        </motion.div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
