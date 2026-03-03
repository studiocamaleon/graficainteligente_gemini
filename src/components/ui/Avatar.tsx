interface AvatarProps {
  src?: string | null;
  alt?: string;
  name?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showPresence?: boolean;
  isOnline?: boolean;
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

export function Avatar({ src, alt, name, size = 'md', showPresence = false, isOnline = false }: AvatarProps) {
  const initials = name ? getInitials(name) : '?';

  const avatarContent = src ? (
    <img
      src={src}
      alt={alt || name || 'Avatar'}
      className={`${sizeStyles[size]} rounded-full object-cover border-2 border-gray-200`}
    />
  ) : (
    <div
      className={`${sizeStyles[size]} rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 text-white font-semibold flex items-center justify-center border-2 border-gray-200`}
    >
      {initials}
    </div>
  );

  return (
    <div className="relative inline-flex">
      {avatarContent}
      {showPresence && (
        <span
          className={`absolute bottom-0 right-0 block h-3.5 w-3.5 rounded-full border-2 border-white ${
            isOnline ? 'bg-emerald-500' : 'bg-slate-300'
          }`}
          aria-label={isOnline ? 'En línea' : 'Desconectado'}
          title={isOnline ? 'En línea' : 'Desconectado'}
        />
      )}
    </div>
  );
}
