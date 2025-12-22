import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X, ChevronLeft, ChevronRight,
    ChevronDown, ChevronUp, Settings, LogOut
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { MODULES, Module, SubModule } from '../../constants/modules';
import { Avatar } from '../ui/Avatar';
import { usePermissions } from '../../hooks/usePermissions';

interface SidebarProps {
    isOpen: boolean;
    setIsOpen: (isOpen: boolean) => void;
    isMobile: boolean;
    onMobileClose?: () => void;
    onCompanyClick?: () => void;
    onProfileClick?: () => void;
}

// Extracted SidebarItemProps interface
interface SidebarItemProps {
    module: Module | SubModule;
    depth?: number;
    isOpen: boolean;
    isMobile: boolean;
    expandedModules: string[];
    toggleModule: (moduleId: string) => void;
    isActive: (path: string) => boolean;
    canAccessModule: (moduleId: string) => boolean;
    onMobileClose?: () => void;
}

// SidebarItem Component defined OUTSIDE
const SidebarItem = ({
    module,
    depth = 0,
    isOpen,
    isMobile,
    expandedModules,
    toggleModule,
    isActive,
    canAccessModule,
    onMobileClose
}: SidebarItemProps) => {
    const Icon = module.icon;

    // Helper logic moved or duplicated if needed, or passed down.
    // Ideally isModuleActive logic should be passed or reconstructed.
    // For simplicity, let's reconstruct it here or pass it. 
    // Reconstructing it is cheap.
    const isModuleActive = (mod: Module | SubModule) => {
        if (isActive(mod.path)) return true;
        if ('children' in mod && mod.children) {
            return mod.children.some(child => isActive(child.path));
        }
        return false;
    };

    const active = isModuleActive(module);
    const hasChildren = 'children' in module && module.children && module.children.length > 0;
    const expanded = expandedModules.includes(module.id);
    const showLabel = isOpen || isMobile;

    const activeClass = active
        ? "bg-slate-800 text-white shadow-sm"
        : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/50";

    if (hasChildren) {
        const parentModule = module as Module;
        return (
            <div className="mb-1">
                <button
                    onClick={() => toggleModule(module.id)}
                    className={`
          w-full flex items-center justify-between gap-3 px-3 py-2 rounded-md transition-all duration-200 group
          ${activeClass}
        `}
                >
                    <div className="flex items-center gap-3 overflow-hidden">
                        {Icon && <Icon className={`w-5 h-5 flex-shrink-0 transition-colors ${active ? 'text-blue-400' : 'group-hover:text-slate-100'}`} />}
                        {showLabel && (
                            <span className="text-sm font-medium truncate">{module.name}</span>
                        )}
                    </div>
                    {showLabel && (
                        <div className="text-slate-500 group-hover:text-slate-300 transition-colors">
                            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </div>
                    )}
                </button>

                <AnimatePresence>
                    {expanded && showLabel && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden ml-4 pl-2 border-l border-slate-700 mt-1 space-y-1"
                        >
                            {parentModule.children?.filter(m => canAccessModule(m.id)).map(child => (
                                <SidebarItem
                                    key={child.id}
                                    module={child}
                                    depth={depth + 1}
                                    isOpen={isOpen}
                                    isMobile={isMobile}
                                    expandedModules={expandedModules}
                                    toggleModule={toggleModule}
                                    isActive={isActive}
                                    canAccessModule={canAccessModule}
                                    onMobileClose={onMobileClose}
                                />
                            ))}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        );
    }

    return (
        <Link
            to={module.path}
            onClick={() => isMobile && onMobileClose?.()}
        >
            <div
                className={`
        flex items-center gap-3 px-3 py-2 rounded-md transition-all duration-200 mb-1 group
        ${activeClass}
      `}
            >
                {Icon ? (
                    <Icon className={`w-5 h-5 flex-shrink-0 transition-colors ${active ? 'text-blue-400' : 'group-hover:text-slate-100'}`} />
                ) : (
                    <div className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-blue-400' : 'bg-slate-600 group-hover:bg-slate-400'} ml-1.5 mr-0.5`} />
                )}
                {showLabel && (
                    <span className={`text-sm font-medium truncate ${active ? 'text-white' : ''}`}>
                        {module.name}
                    </span>
                )}
            </div>
        </Link>
    );
};

export function Sidebar({
    isOpen,
    setIsOpen,
    isMobile,
    onMobileClose,
    onCompanyClick,
    onProfileClick
}: SidebarProps) {
    const location = useLocation();
    const { profile, company, plan, signOut } = useAuth();
    const { canAccessModule } = usePermissions();
    const [expandedModules, setExpandedModules] = useState<string[]>([]);

    const canEditCompany = profile?.role === 'super_admin' || profile?.role === 'admin';
    const availableModules = MODULES.filter(module => canAccessModule(module.id));

    const isActive = (path: string) => location.pathname === path;

    const toggleModule = (moduleId: string) => {
        setExpandedModules(prev =>
            prev.includes(moduleId)
                ? prev.filter(id => id !== moduleId)
                : [...prev, moduleId]
        );
    };

    return (
        <aside
            className={`
        ${isOpen ? 'w-72' : 'w-20'} 
        ${isMobile ? 'fixed inset-y-0 left-0 z-50 w-72 shadow-2xl' : 'fixed inset-y-0 left-0 z-30 hidden lg:flex flex-col h-screen border-r border-slate-800'}
        bg-slate-950 transition-all duration-300
      `}
        >
            <div className="h-[73px] flex items-center px-4 border-b border-slate-800">
                <div className={`flex items-center ${isOpen || isMobile ? 'justify-between w-full' : 'justify-center w-full'}`}>
                    {(isOpen || isMobile) ? (
                        <div
                            className={`flex items-center gap-3 overflow-hidden transition-all ${canEditCompany ? 'cursor-pointer hover:opacity-80' : ''}`}
                            onClick={canEditCompany ? onCompanyClick : undefined}
                        >
                            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0 text-white font-bold shadow-lg shadow-blue-900/20">
                                {company?.logo_url ? (
                                    <img src={company.logo_url} alt="Logo" className="w-full h-full object-cover rounded-lg" />
                                ) : (
                                    <span>{company?.name?.charAt(0) || 'P'}</span>
                                )}
                            </div>
                            <div className="min-w-0">
                                <h2 className="text-white font-bold text-sm truncate">{company?.name || 'PrintFlow'}</h2>
                                {canEditCompany && <p className="text-xs text-slate-400 flex items-center gap-1"><Settings className="w-3 h-3" /> Configurar</p>}
                            </div>
                        </div>
                    ) : (
                        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold shadow-lg shadow-blue-900/20">
                            {company?.name?.charAt(0) || 'P'}
                        </div>
                    )}

                    {!isMobile && isOpen && (
                        <button
                            onClick={() => setIsOpen(false)}
                            className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                    )}
                </div>

                {!isMobile && !isOpen && (
                    <button
                        onClick={() => setIsOpen(true)}
                        className="absolute right-[-12px] top-6 bg-slate-800 text-slate-400 border border-slate-700 rounded-full p-1 hover:text-white transition-colors shadow-sm"
                    >
                        <ChevronRight className="w-3 h-3" />
                    </button>
                )}

                {isMobile && (
                    <button onClick={onMobileClose} className="p-2 text-slate-400 hover:text-white">
                        <X className="w-6 h-6" />
                    </button>
                )}
            </div>

            <div className="flex-1 overflow-y-auto py-4 px-3 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
                <nav className="space-y-1">
                    {availableModules.map(module => (
                        <SidebarItem
                            key={module.id}
                            module={module}
                            isOpen={isOpen}
                            isMobile={isMobile}
                            expandedModules={expandedModules}
                            toggleModule={toggleModule}
                            isActive={isActive}
                            canAccessModule={canAccessModule}
                            onMobileClose={onMobileClose}
                        />
                    ))}
                </nav>
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-950/50">
                {(isOpen || isMobile) && plan && (
                    <div className="mb-4 p-3 rounded-lg bg-slate-900 border border-slate-800">
                        <div className="text-xs font-semibold text-slate-400 mb-1">Plan Actual</div>
                        <div className="flex justify-between items-center text-sm font-medium text-white">
                            <span>{plan.name}</span>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">Activo</span>
                        </div>
                    </div>
                )}

                <button
                    onClick={onProfileClick}
                    className={`w-full flex items-center gap-3 p-2 rounded-lg hover:bg-slate-800 transition-colors group ${!isOpen && !isMobile ? 'justify-center' : ''}`}
                >
                    <Avatar src={profile?.avatar_url} name={profile?.full_name} size="sm" />
                    {(isOpen || isMobile) && (
                        <div className="flex-1 text-left min-w-0">
                            <div className="text-sm font-medium text-white truncate group-hover:text-blue-400 transition-colors">{profile?.full_name}</div>
                            <div className="text-xs text-slate-500 truncate">{profile?.email}</div>
                        </div>
                    )}
                </button>

                {(isOpen || isMobile) && (
                    <button
                        onClick={signOut}
                        className="w-full mt-2 flex items-center gap-2 px-2 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
                    >
                        <LogOut className="w-4 h-4" />
                        <span>Cerrar Sesión</span>
                    </button>
                )}
            </div>
        </aside>
    );
}
