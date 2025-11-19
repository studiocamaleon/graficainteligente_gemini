import { ReactNode } from 'react';
import { LucideIcon } from 'lucide-react';

export interface Tab {
  id: string;
  label?: string;
  name?: string;
  icon?: LucideIcon;
  count?: number;
  disabled?: boolean;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange?: (tabId: string) => void;
  onChange?: (tabId: string) => void;
  className?: string;
}

export function Tabs({ tabs, activeTab, onTabChange, onChange, className = '' }: TabsProps) {
  const handleTabClick = (tabId: string) => {
    if (onTabChange) onTabChange(tabId);
    if (onChange) onChange(tabId);
  };

  return (
    <div className={`border-b border-gray-200 ${className}`}>
      <nav className="flex -mb-px">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          const tabLabel = tab.label || tab.name || tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => !tab.disabled && handleTabClick(tab.id)}
              disabled={tab.disabled}
              className={`
                flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors
                ${
                  isActive
                    ? 'border-blue-500 text-blue-600'
                    : tab.disabled
                    ? 'border-transparent text-gray-300 cursor-not-allowed'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }
              `}
            >
              {Icon && <Icon className="w-5 h-5" />}
              <span>{tabLabel}</span>
              {tab.count !== undefined && tab.count > 0 && (
                <span className="ml-1 px-2 py-0.5 text-xs font-semibold rounded-full bg-gray-100 text-gray-600">
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
