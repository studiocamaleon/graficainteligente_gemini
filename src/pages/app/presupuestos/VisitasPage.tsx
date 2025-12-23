import { useState } from 'react';

import { Tabs } from '../../../components/ui/Tabs';
import { CalendarioSemanal } from '../../../components/visitas/CalendarioSemanal';
import { ConfiguracionVisitasForm } from '../../../components/visitas/ConfiguracionVisitasForm';
import { VisitasStaffTab } from '../../../components/visitas/VisitasStaffTab';
import { Calendar, Settings, Users } from 'lucide-react';

export default function VisitasPage() {
    const [activeTab, setActiveTab] = useState('calendario');

    const tabs = [
        { id: 'calendario', label: 'Calendario', icon: Calendar },
        { id: 'staff', label: 'Equipo / Staff', icon: Users },
        { id: 'configuracion', label: 'Configuración', icon: Settings }
    ];

    return (
        <div className="p-6 space-y-6 h-[calc(100vh-64px)] flex flex-col">

            <Tabs
                tabs={tabs}
                activeTab={activeTab}
                onChange={setActiveTab}
            />

            <div className="flex-1 mt-4 relative">
                {activeTab === 'calendario' && (
                    <div className="absolute inset-0">
                        <CalendarioSemanal />
                    </div>
                )}

                {activeTab === 'staff' && (
                    <div className="absolute inset-0 overflow-y-auto">
                        <VisitasStaffTab />
                    </div>
                )}

                {activeTab === 'configuracion' && (
                    <ConfiguracionVisitasForm />
                )}
            </div>
        </div >
    );
}
