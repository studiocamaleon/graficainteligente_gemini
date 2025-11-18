import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight, Sparkles, Zap, TrendingUp } from 'lucide-react';
import { fadeInUp, fadeInDown } from '../../animations/variants';
import { BRAND } from '../../constants/branding';

export function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden px-4 sm:px-6 lg:px-8">
      <div className="absolute inset-0 bg-gradient-to-br from-purple-50 via-blue-50 to-lime-50 opacity-70"></div>

      <div className="absolute inset-0 overflow-hidden">
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-2 h-2 bg-purple-400 rounded-full opacity-20"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            animate={{
              y: [0, -30, 0],
              opacity: [0.2, 0.5, 0.2],
            }}
            transition={{
              duration: 3 + Math.random() * 2,
              repeat: Infinity,
              delay: Math.random() * 2,
            }}
          />
        ))}
      </div>

      <div className="relative max-w-7xl mx-auto text-center">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={fadeInDown}
          className="mb-6"
        >
          <span className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-100 to-blue-100 text-purple-800 rounded-full text-sm font-semibold">
            <Zap className="w-4 h-4" />
            {BRAND.tagline}
          </span>
        </motion.div>

        <motion.h1
          initial="hidden"
          animate="visible"
          variants={fadeInUp}
          className="text-5xl sm:text-6xl lg:text-7xl font-bold text-gray-900 mb-6 leading-tight"
        >
          Gestión{' '}
          <span className="bg-gradient-to-r from-purple-600 via-blue-600 to-lime-500 bg-clip-text text-transparent">
            Inteligente
          </span>
          {' '}para tu Imprenta
        </motion.h1>

        <motion.p
          initial="hidden"
          animate="visible"
          variants={fadeInUp}
          transition={{ delay: 0.2 }}
          className="text-xl sm:text-2xl text-gray-600 mb-12 max-w-3xl mx-auto leading-relaxed"
        >
          {BRAND.description}
        </motion.p>

        <motion.div
          initial="hidden"
          animate="visible"
          variants={fadeInUp}
          transition={{ delay: 0.4 }}
          className="flex flex-col sm:flex-row gap-4 justify-center items-center"
        >
          <Link to="/register">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-8 py-4 bg-gradient-to-r from-purple-600 via-blue-600 to-purple-600 text-white font-bold rounded-xl shadow-2xl shadow-purple-500/40 hover:shadow-purple-500/60 transition-all inline-flex items-center gap-2 text-lg"
            >
              Comenzar Gratis
              <ArrowRight className="w-5 h-5" />
            </motion.button>
          </Link>
          <Link to="#pricing">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-8 py-4 bg-white text-gray-900 font-bold rounded-xl border-2 border-gray-300 hover:border-gray-400 transition-all text-lg"
            >
              Ver Planes
            </motion.button>
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.8 }}
          className="mt-16"
        >
          <div className="bg-white/60 backdrop-blur-sm rounded-2xl shadow-2xl border border-gray-200 p-4 max-w-5xl mx-auto">
            <div className="aspect-video bg-gradient-to-br from-purple-50 via-blue-50 to-white rounded-xl flex items-center justify-center relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-blue-500/5 to-lime-500/5"></div>
              <div className="text-center relative z-10">
                <div className="w-20 h-20 mx-auto bg-gradient-to-br from-purple-600 via-blue-600 to-purple-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg">
                  <TrendingUp className="w-10 h-10 text-white" />
                </div>
                <p className="text-gray-700 font-semibold text-lg">Dashboard de {BRAND.name}</p>
                <p className="text-gray-500 text-sm mt-1">Visualiza tus métricas en tiempo real</p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
