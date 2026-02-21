import { ModernTab, TabsModern } from './TabsModern';

export type Tab = ModernTab;

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange?: (tabId: string) => void;
  onChange?: (tabId: string) => void;
  className?: string;
}

export function Tabs(props: TabsProps) {
  return <TabsModern {...props} />;
}
