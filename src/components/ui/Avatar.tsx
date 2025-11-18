interface AvatarProps {
  src?: string | null;
  alt?: string;
  name?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const sizeStyles = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-16 h-16 text-xl',
};

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function Avatar({ src, alt, name, size = 'md' }: AvatarProps) {
  const initials = name ? getInitials(name) : '?';

  if (src) {
    return (
      <img
        src={src}
        alt={alt || name || 'Avatar'}
        className={`${sizeStyles[size]} rounded-full object-cover border-2 border-gray-200`}
      />
    );
  }

  return (
    <div
      className={`${sizeStyles[size]} rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 text-white font-semibold flex items-center justify-center border-2 border-gray-200`}
    >
      {initials}
    </div>
  );
}
