import React from 'react';

interface ColorBendsProps {
  className?: string;
  colors?: string[];
  speed?: 'slow' | 'normal' | 'fast';
}

export const ColorBends: React.FC<ColorBendsProps> = ({
  className = '',
  colors = [
    'from-blue-400 via-purple-400 to-pink-400',
    'from-green-400 via-teal-400 to-blue-400',
    'from-orange-400 via-red-400 to-pink-400',
  ],
  speed = 'normal',
}) => {
  const speedMap = {
    slow: '30s',
    normal: '20s',
    fast: '10s',
  };

  const animationDuration = speedMap[speed];

  return (
    <div className={`absolute inset-0 overflow-hidden ${className}`}>
      <div className="absolute inset-0">
        {colors.map((colorClass, index) => (
          <div
            key={index}
            className={`absolute inset-0 bg-gradient-to-br ${colorClass} opacity-30 blur-3xl`}
            style={{
              animation: `colorBend ${animationDuration} ease-in-out infinite`,
              animationDelay: `${index * (parseInt(animationDuration) / colors.length)}s`,
            }}
          />
        ))}
      </div>

      <style>{`
        @keyframes colorBend {
          0%, 100% {
            transform: translate(0%, 0%) scale(1) rotate(0deg);
            opacity: 0.3;
          }
          33% {
            transform: translate(20%, -20%) scale(1.1) rotate(120deg);
            opacity: 0.4;
          }
          66% {
            transform: translate(-20%, 20%) scale(0.9) rotate(240deg);
            opacity: 0.3;
          }
        }
      `}</style>
    </div>
  );
};
