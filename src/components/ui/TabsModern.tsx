import * as RadixTabs from '@radix-ui/react-tabs';
import { LucideIcon } from 'lucide-react';

export interface ModernTab {
  id: string;
  label?: string;
  name?: string;
  icon?: LucideIcon;
  count?: number;
  disabled?: boolean;
}

interface TabsModernProps {
  tabs: ModernTab[];
  activeTab: string;
  onTabChange?: (tabId: string) => void;
  onChange?: (tabId: string) => void;
  className?: string;
}

export function TabsModern({
  tabs,
  activeTab,
  onTabChange,
  onChange,
  className = '',
}: TabsModernProps) {
  const handleValueChange = (tabId: string) => {
    if (onTabChange) onTabChange(tabId);
    if (onChange) onChange(tabId);
  };

  return (
    <RadixTabs.Root value={activeTab} onValueChange={handleValueChange} className={className}>
      <RadixTabs.List
        className="
          inline-flex w-full flex-wrap items-center gap-2 rounded-xl border border-slate-200
          bg-slate-50 p-2
        "
        aria-label="Navegación de pestañas"
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const tabLabel = tab.label || tab.name || tab.id;

          return (
            <RadixTabs.Trigger
              key={tab.id}
              value={tab.id}
              disabled={tab.disabled}
              className="
                group inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-slate-600
                transition-all duration-150
                hover:bg-white hover:text-slate-900
                data-[state=active]:bg-gradient-to-r data-[state=active]:from-sky-500 data-[state=active]:to-blue-600
                data-[state=active]:text-white data-[state=active]:shadow-sm
                data-[state=active]:ring-1 data-[state=active]:ring-sky-300
                disabled:cursor-not-allowed disabled:opacity-45
              "
            >
              {Icon && <Icon className="h-4 w-4" />}
              <span>{tabLabel}</span>
              {tab.count !== undefined && tab.count > 0 && (
                <span
                  className="
                    rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600
                    group-data-[state=active]:bg-white/20 group-data-[state=active]:text-white
                  "
                >
                  {tab.count}
                </span>
              )}
            </RadixTabs.Trigger>
          );
        })}
      </RadixTabs.List>
    </RadixTabs.Root>
  );
}
