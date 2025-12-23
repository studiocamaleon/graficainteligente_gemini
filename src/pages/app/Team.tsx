import { useState } from 'react';
import { Users, Shield, Lock, FileText } from 'lucide-react';
import { Card } from '../../components/ui/card';
import { usePageHeader } from '../../hooks/usePageHeader';
import { TeamMembersTab } from './team/TeamMembersTab';
import { CustomRolesTab } from './team/CustomRolesTab';
import { SecurityTab } from './team/SecurityTab';
import { AuditLogTab } from './team/AuditLogTab';

type TabType = 'members' | 'roles' | 'security' | 'audit';

interface Tab {
  id: TabType;
  name: string;
  icon: typeof Users;
}

const TABS: Tab[] = [
  { id: 'members', name: 'Usuarios', icon: Users },
  { id: 'roles', name: 'Roles Personalizados', icon: Shield },
  { id: 'security', name: 'Seguridad', icon: Lock },
  { id: 'audit', name: 'Auditoría', icon: FileText },
];

export function Team() {
  const [activeTab, setActiveTab] = useState<TabType>('members');

  usePageHeader('Gestiona usuarios, roles, permisos y seguridad');

  const renderTabContent = () => {
    switch (activeTab) {
      case 'members':
        return <TeamMembersTab />;
      case 'roles':
        return <CustomRolesTab />;
      case 'security':
        return <SecurityTab />;
      case 'audit':
        return <AuditLogTab />;
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-72px-3rem)]">
      <Card padding="none" className="flex-shrink-0">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors
                    ${
                      isActive
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }
                  `}
                >
                  <Icon className="w-5 h-5" />
                  <span>{tab.name}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </Card>

      <div className="flex-1 min-h-0 mt-6">
        {renderTabContent()}
      </div>
    </div>
  );
}
