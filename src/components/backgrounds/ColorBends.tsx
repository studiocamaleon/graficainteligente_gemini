import { motion, useReducedMotion } from 'framer-motion';

interface ColorBendsProps {
  colors?: string[];
  className?: string;
  speed?: number;
  opacity?: number;
}

export function ColorBends({
  colors = [
    'from-blue-400/30 via-cyan-400/30 to-blue-500/30',
    'from-cyan-400/30 via-blue-500/30 to-cyan-500/30',
    'from-blue-500/30 via-cyan-500/30 to-blue-400/30',
  ],
  className = '',
  speed = 20,
  opacity = 0.6,
}: ColorBendsProps) {
  const prefersReducedMotion = useReducedMotion();
  return (
    <div className={`absolute inset-0 overflow-hidden ${className}`}>
      {/* Base gradient layer */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-white to-cyan-50" />

      {/* Animated gradient orbs */}
      <motion.div
        className="absolute -top-1/2 -left-1/2 w-full h-full"
        animate={prefersReducedMotion ? {} : {
          rotate: [0, 360],
          scale: [1, 1.2, 1],
        }}
        transition={{
          duration: speed * 2,
          repeat: Infinity,
          ease: 'linear',
        }}
      >
        <div
          className={`absolute top-1/4 left-1/4 w-96 h-96 bg-gradient-to-br ${colors[0]} rounded-full blur-3xl`}
          style={{ opacity }}
        />
      </motion.div>

      <motion.div
        className="absolute -bottom-1/2 -right-1/2 w-full h-full"
        animate={prefersReducedMotion ? {} : {
          rotate: [360, 0],
          scale: [1.2, 1, 1.2],
        }}
        transition={{
          duration: speed * 1.5,
          repeat: Infinity,
          ease: 'linear',
        }}
      >
        <div
          className={`absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-gradient-to-br ${colors[1]} rounded-full blur-3xl`}
          style={{ opacity }}
        />
      </motion.div>

      <motion.div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full"
        animate={prefersReducedMotion ? {} : {
          rotate: [180, -180],
          scale: [1, 1.3, 1],
        }}
        transition={{
          duration: speed * 2.5,
          repeat: Infinity,
          ease: 'linear',
        }}
      >
        <div
          className={`absolute top-1/2 left-1/2 w-[600px] h-[600px] bg-gradient-to-br ${colors[2]} rounded-full blur-3xl opacity-50`}
          style={{ opacity: opacity * 0.8 }}
        />
      </motion.div>

      {/* Animated waves */}
      <motion.div
        className="absolute inset-0"
        animate={prefersReducedMotion ? {} : {
          backgroundPosition: ['0% 0%', '100% 100%'],
        }}
        transition={{
          duration: speed * 3,
          repeat: Infinity,
          ease: 'linear',
        }}
        style={{
          backgroundImage: `radial-gradient(circle at 20% 50%, rgba(59, 130, 246, 0.1) 0%, transparent 50%),
                           radial-gradient(circle at 80% 80%, rgba(6, 182, 212, 0.1) 0%, transparent 50%),
                           radial-gradient(circle at 40% 20%, rgba(37, 99, 235, 0.1) 0%, transparent 50%)`,
          backgroundSize: '200% 200%',
        }}
      />

      {/* Subtle grid overlay */}
      <div
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `linear-gradient(rgba(59, 130, 246, 0.5) 1px, transparent 1px),
                           linear-gradient(90deg, rgba(59, 130, 246, 0.5) 1px, transparent 1px)`,
          backgroundSize: '100px 100px',
        }}
      />

      {/* Light rays effect */}
      <motion.div
        className="absolute inset-0"
        animate={prefersReducedMotion ? { opacity: 0.2 } : {
          opacity: [0.1, 0.3, 0.1],
        }}
        transition={{
          duration: speed * 1.5,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      >
        <div className="absolute top-0 left-1/4 w-1 h-full bg-gradient-to-b from-blue-400/20 via-transparent to-transparent blur-sm" />
        <div className="absolute top-0 left-2/4 w-1 h-full bg-gradient-to-b from-cyan-400/20 via-transparent to-transparent blur-sm" />
        <div className="absolute top-0 left-3/4 w-1 h-full bg-gradient-to-b from-blue-500/20 via-transparent to-transparent blur-sm" />
      </motion.div>

      {/* Overlay gradient for better text readability */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/10 to-white/30" />
    </div>
  );
}
