import { Globe, MessageCircle, Store, Smartphone } from 'lucide-react';
import type { CanalVenta } from '../../types/database';

interface ChannelBadgeProps {
  canal: CanalVenta;
  showLabel?: boolean;
  size?: 'sm' | 'md';
}

const canalConfig: Record<
  CanalVenta,
  { label: string; icon: typeof Globe; className: string }
> = {
  Web: {
    label: 'Web',
    icon: Globe,
    className: 'bg-blue-100 text-blue-700',
  },
  WhatsApp: {
    label: 'WhatsApp',
    icon: MessageCircle,
    className: 'bg-green-100 text-green-700',
  },
  Mostrador: {
    label: 'Mostrador',
    icon: Store,
    className: 'bg-purple-100 text-purple-700',
  },
  'App Mobile': {
    label: 'App Mobile',
    icon: Smartphone,
    className: 'bg-orange-100 text-orange-700',
  },
};

export function ChannelBadge({ canal, showLabel = true, size = 'md' }: ChannelBadgeProps) {
  const config = canalConfig[canal];
  const Icon = config.icon;

  const sizeClasses = size === 'sm' ? 'p-1' : 'p-1.5';
  const iconSize = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4';

  if (!showLabel) {
    return (
      <div className={`inline-flex items-center justify-center rounded-full ${config.className} ${sizeClasses}`}>
        <Icon className={iconSize} />
      </div>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full ${config.className} text-sm font-medium`}>
      <Icon className={iconSize} />
      {config.label}
    </span>
  );
}
