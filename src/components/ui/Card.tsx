import { ReactNode, HTMLAttributes } from 'react';
import { motion } from 'framer-motion';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  hover?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  allowOverflow?: boolean;
}

const paddingStyles = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
};

export function Card({ children, hover = false, padding = 'md', allowOverflow = false, className = '', ...props }: CardProps) {
  const baseStyles = 'bg-white rounded-xl border border-gray-200 shadow-sm';
  const hoverStyles = hover ? 'hover:shadow-lg hover:border-gray-300 cursor-pointer' : '';
  const overflowStyles = allowOverflow ? 'overflow-visible' : '';

  return (
    <motion.div
      initial={hover ? { y: 0 } : undefined}
      whileHover={hover ? { y: -4 } : undefined}
      transition={{ duration: 0.2 }}
      className={`${baseStyles} ${hoverStyles} ${overflowStyles} ${paddingStyles[padding]} transition-all duration-200 ${className}`}
      {...props}
    >
      {children}
    </motion.div>
  );
}
