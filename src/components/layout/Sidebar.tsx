import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import {
    X, ChevronLeft, ChevronRight,
    ChevronDown, ChevronUp, Settings, LogOut, Search
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

interface SidebarTooltipProps {
    content: string;
    disabled?: boolean;
    children: React.ReactNode;
}

function SidebarTooltip({ content, disabled = false, children }: SidebarTooltipProps) {
    const [visible, setVisible] = useState(false);
    const [coords, setCoords] = useState({ top: 0, left: 0 });
    const triggerRef = useRef<HTMLDivElement>(null);
    const timeoutRef = useRef<number | null>(null);

    const showTooltip = () => {
        if (disabled) return;
        timeoutRef.current = window.setTimeout(() => {
            if (!triggerRef.current) return;
            const rect = triggerRef.current.getBoundingClientRect();
            setCoords({
                top: rect.top + rect.height / 2,
                left: rect.right + 12,
            });
            setVisible(true);
        }, 120);
    };

    const hideTooltip = () => {
        if (timeoutRef.current) {
            window.clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
        setVisible(false);
    };

    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                window.clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    return (
        <>
            <div ref={triggerRef} onMouseEnter={showTooltip} onMouseLeave={hideTooltip} className="w-full">
                {children}
            </div>
            {!disabled && visible && createPortal(
                <div
                    className="pointer-events-none fixed z-[120] -translate-y-1/2 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-slate-100 shadow-2xl whitespace-nowrap"
                    style={{ top: coords.top, left: coords.left }}
                >
                    {content}
                </div>,
                document.body
            )}
        </>
    );
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
    searchTerm: string;
    collapsedFlyoutModuleId: string | null;
    setCollapsedFlyoutModuleId: (moduleId: string | null) => void;
    onMobileClose?: () => void;
}

const SidebarItem = ({
    module,
    depth = 0,
    isOpen,
    isMobile,
    expandedModules,
    toggleModule,
    isActive,
    canAccessModule,
    searchTerm,
    collapsedFlyoutModuleId,
    setCollapsedFlyoutModuleId,
    onMobileClose
}: SidebarItemProps) => {
    const Icon = module.icon;
    const flyoutTriggerRef = useRef<HTMLButtonElement>(null);
    const [flyoutCoords, setFlyoutCoords] = useState({ top: 0, left: 0 });

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
    const isNested = depth > 0;
    const shouldForceExpand = searchTerm.trim().length > 0;
    const isExpanded = shouldForceExpand ? true : expanded;
    const itemContainerWidthClass = showLabel ? 'w-full' : 'w-10 mx-auto';
    const justifyClass = showLabel ? 'justify-between' : 'justify-center';

    const activeClass = active
        ? "bg-slate-800/95 text-white shadow-sm ring-1 ring-slate-700"
        : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/60";

    const basePaddingClass = showLabel
        ? isNested
            ? 'px-3 py-2'
            : 'px-3.5 py-2.5'
        : 'px-0 py-0 h-10 w-10 justify-center';

    useEffect(() => {
        const isFlyoutOpen = collapsedFlyoutModuleId === module.id;
        if (showLabel || !isFlyoutOpen || !flyoutTriggerRef.current) return;

        const updateCoords = () => {
            if (!flyoutTriggerRef.current) return;
            const rect = flyoutTriggerRef.current.getBoundingClientRect();
            setFlyoutCoords({
                top: rect.top,
                left: rect.right + 12,
            });
        };

        updateCoords();
        window.addEventListener('resize', updateCoords);
        window.addEventListener('scroll', updateCoords, true);
        return () => {
            window.removeEventListener('resize', updateCoords);
            window.removeEventListener('scroll', updateCoords, true);
        };
    }, [collapsedFlyoutModuleId, module.id, showLabel]);

    if (hasChildren) {
        const parentModule = module as Module;
        if (!showLabel) {
            const isFlyoutOpen = collapsedFlyoutModuleId === module.id;
            const visibleChildren = parentModule.children?.filter(m => canAccessModule(m.id)) ?? [];
            return (
                <div className="relative mb-1.5">
                    <button
                        type="button"
                        data-flyout-trigger={module.id}
                        ref={flyoutTriggerRef}
                        onClick={() => setCollapsedFlyoutModuleId(isFlyoutOpen ? null : module.id)}
                        className="w-full"
                    >
                        <SidebarTooltip content={module.name} disabled={showLabel}>
                            <div
                                className={`
          relative flex items-center gap-3 rounded-xl transition-all duration-200 group
          ${itemContainerWidthClass}
          ${justifyClass}
          ${basePaddingClass}
          ${activeClass}
        `}
                            >
                                {Icon && <Icon className={`h-[18px] w-[18px] flex-shrink-0 transition-colors ${active ? 'text-cyan-300' : 'group-hover:text-slate-100'}`} />}
                            </div>
                        </SidebarTooltip>
                    </button>

                    {isFlyoutOpen && createPortal(
                        <div
                            data-flyout-id={module.id}
                            className="fixed z-[130] w-64 rounded-xl border border-slate-700 bg-slate-900 p-2 shadow-2xl"
                            style={{ top: flyoutCoords.top, left: flyoutCoords.left }}
                        >
                            <div className="mb-2 border-b border-slate-700 px-2 pb-2">
                                <p className="text-xs uppercase tracking-wide text-slate-400">Módulo</p>
                                <p className="text-sm font-semibold text-white truncate">{module.name}</p>
                            </div>

                            <Link
                                to={module.path}
                                onClick={() => {
                                    setCollapsedFlyoutModuleId(null);
                                    if (isMobile) onMobileClose?.();
                                }}
                                className="mb-1 flex items-center rounded-lg px-2 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800 hover:text-white transition-colors"
                            >
                                Ir a {module.name}
                            </Link>

                            <div className="mt-1 space-y-1">
                                {visibleChildren.map(child => (
                                    <Link
                                        key={child.id}
                                        to={child.path}
                                        onClick={() => {
                                            setCollapsedFlyoutModuleId(null);
                                            if (isMobile) onMobileClose?.();
                                        }}
                                        className={`flex items-center rounded-lg px-2 py-2 text-sm transition-colors ${
                                            isActive(child.path)
                                                ? 'bg-slate-800 text-white'
                                                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                                        }`}
                                    >
                                        {child.name}
                                    </Link>
                                ))}
                            </div>
                        </div>,
                        document.body
                    )}
                </div>
            );
        }

        return (
            <div className="mb-1.5">
                <SidebarTooltip content={module.name} disabled={showLabel}>
                    <button
                        onClick={() => toggleModule(module.id)}
                        className={`
          relative flex items-center gap-3 rounded-xl transition-all duration-200 group
          ${itemContainerWidthClass}
          ${justifyClass}
          ${basePaddingClass}
          ${activeClass}
        `}
                    >
                        {active && showLabel && (
                            <span className="absolute left-1 top-1/2 h-5 w-1 -translate-y-1/2 rounded-full bg-cyan-300" />
                        )}
                        <div className={`flex items-center gap-3 overflow-hidden ${!showLabel ? 'justify-center w-full' : ''}`}>
                            {Icon && <Icon className={`h-[18px] w-[18px] flex-shrink-0 transition-colors ${active ? 'text-cyan-300' : 'group-hover:text-slate-100'}`} />}
                            {showLabel && (
                                <span className="text-sm font-medium truncate">{module.name}</span>
                            )}
                        </div>
                        {showLabel && (
                            <div className="text-slate-500 group-hover:text-slate-300 transition-colors">
                                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </div>
                        )}
                    </button>
                </SidebarTooltip>

                <AnimatePresence>
                    {isExpanded && showLabel && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden ml-4 pl-2 border-l border-slate-700/70 mt-1.5 space-y-1"
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
                                    searchTerm={searchTerm}
                                    collapsedFlyoutModuleId={collapsedFlyoutModuleId}
                                    setCollapsedFlyoutModuleId={setCollapsedFlyoutModuleId}
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
            <SidebarTooltip content={module.name} disabled={showLabel}>
                <div
                    className={`
        relative flex items-center gap-3 rounded-xl transition-all duration-200 mb-1.5 group
        ${itemContainerWidthClass}
        ${basePaddingClass}
        ${activeClass}
      `}
                >
                    {active && showLabel && (
                        <span className="absolute left-1 top-1/2 h-5 w-1 -translate-y-1/2 rounded-full bg-cyan-300" />
                    )}
                    {Icon ? (
                        <Icon className={`h-[18px] w-[18px] flex-shrink-0 transition-colors ${active ? 'text-cyan-300' : 'group-hover:text-slate-100'}`} />
                    ) : (
                        <div className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-cyan-300' : 'bg-slate-600 group-hover:bg-slate-400'} ml-1.5 mr-0.5`} />
                    )}
                    {showLabel && (
                        <span className={`text-sm font-medium truncate ${active ? 'text-white' : ''}`}>
                            {module.name}
                        </span>
                    )}
                </div>
            </SidebarTooltip>
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
    const [searchTerm, setSearchTerm] = useState('');
    const [collapsedFlyoutModuleId, setCollapsedFlyoutModuleId] = useState<string | null>(null);
    const navHorizontalPadding = isOpen || isMobile ? 'px-3' : 'px-[13px]';

    const canEditCompany = profile?.role === 'super_admin' || profile?.role === 'admin';
    const availableModules = MODULES
        .filter(module => canAccessModule(module.id))
        .map(module => {
            if (!module.children) return module;
            const visibleChildren = module.children.filter(child => canAccessModule(child.id));
            return {
                ...module,
                children: visibleChildren
            };
        })
        .filter(module => {
            if (!searchTerm.trim()) return true;
            const term = searchTerm.toLowerCase().trim();
            const moduleMatch = module.name.toLowerCase().includes(term);
            const childrenMatch = module.children?.some(child => child.name.toLowerCase().includes(term)) ?? false;
            return moduleMatch || childrenMatch;
        })
        .map(module => {
            if (!module.children || !searchTerm.trim()) return module;
            const term = searchTerm.toLowerCase().trim();
            const moduleMatch = module.name.toLowerCase().includes(term);
            if (moduleMatch) return module;
            return {
                ...module,
                children: module.children.filter(child => child.name.toLowerCase().includes(term))
            };
        });

    const isActive = (path: string) => location.pathname === path;

    const toggleModule = (moduleId: string) => {
        setExpandedModules(prev =>
            prev.includes(moduleId)
                ? [] // Close if already open
                : [moduleId] // Open this one, close others (Accordion effect)
        );
    };

    useEffect(() => {
        setCollapsedFlyoutModuleId(null);
    }, [location.pathname, isOpen, isMobile]);

    useEffect(() => {
        if (isOpen || isMobile || !collapsedFlyoutModuleId) return;

        const handleOutside = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            const trigger = target.closest(`[data-flyout-trigger="${collapsedFlyoutModuleId}"]`);
            const panel = target.closest(`[data-flyout-id="${collapsedFlyoutModuleId}"]`);
            if (trigger || panel) return;
            setCollapsedFlyoutModuleId(null);
        };

        document.addEventListener('mousedown', handleOutside);
        return () => document.removeEventListener('mousedown', handleOutside);
    }, [collapsedFlyoutModuleId, isOpen, isMobile]);

    return (
        <aside
            className={`
        ${isOpen ? 'w-72' : 'w-20'} 
        ${isMobile ? 'fixed inset-y-0 left-0 z-50 w-72 shadow-2xl' : 'fixed inset-y-0 left-0 z-30 hidden lg:flex flex-col h-screen'}
        bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 transition-all duration-300
        ${isMobile ? '' : 'm-2 rounded-2xl border border-slate-800/90 shadow-2xl shadow-slate-950/40'}
      `}
        >
            <div className="h-[73px] flex items-center px-4 border-b border-slate-800/90">
                <div className={`flex items-center ${isOpen || isMobile ? 'justify-between w-full' : 'justify-center w-full'}`}>
                    {(isOpen || isMobile) ? (
                        <div
                            className={`flex items-center gap-3 overflow-hidden transition-all ${canEditCompany ? 'cursor-pointer hover:opacity-80' : ''}`}
                            onClick={canEditCompany ? onCompanyClick : undefined}
                        >
                            <div className="w-8 h-8 rounded-xl bg-slate-800 ring-1 ring-slate-700 flex items-center justify-center flex-shrink-0 text-white font-bold shadow-lg">
                                {company?.logo_url ? (
                                    <img src={company.logo_url} alt="Logo" className="w-full h-full object-cover rounded-xl" />
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
                        <button
                            type="button"
                            onClick={() => setIsOpen(true)}
                            className="w-9 h-9 rounded-xl bg-slate-800 ring-1 ring-slate-700 flex items-center justify-center text-white font-bold shadow-lg hover:bg-slate-700 transition-colors"
                            title="Expandir menú"
                        >
                            {company?.name?.charAt(0) || 'P'}
                        </button>
                    )}

                    {!isMobile && isOpen && (
                        <button
                            onClick={() => setIsOpen(false)}
                            className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors border border-transparent hover:border-slate-700"
                            title="Colapsar menú"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                    )}
                </div>

                {isMobile && (
                    <button onClick={onMobileClose} className="p-2 text-slate-400 hover:text-white">
                        <X className="w-6 h-6" />
                    </button>
                )}
            </div>

            {!isMobile && !isOpen && (
                <button
                    onClick={() => setIsOpen(true)}
                    className="fixed left-[5.1rem] top-1/2 -translate-y-1/2 bg-slate-900 text-slate-400 border border-slate-700 rounded-lg p-1.5 hover:text-white transition-colors shadow-sm z-40"
                    title="Expandir menú"
                >
                    <ChevronRight className="w-3.5 h-3.5" />
                </button>
            )}

            {(isOpen || isMobile) && (
                <div className="px-3.5 pt-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input
                            type="text"
                            placeholder="Buscar módulo"
                            value={searchTerm}
                            onChange={(event) => setSearchTerm(event.target.value)}
                            className="w-full rounded-xl border border-slate-800 bg-slate-900/80 py-2.5 pl-9 pr-3 text-sm text-slate-100 placeholder:text-slate-500 outline-none transition-colors focus:border-slate-600"
                        />
                    </div>
                </div>
            )}

            <div className={`sidebar-scrollbar flex-1 overflow-y-auto overflow-x-visible py-4 ${navHorizontalPadding}`}>
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
                            searchTerm={searchTerm}
                            collapsedFlyoutModuleId={collapsedFlyoutModuleId}
                            setCollapsedFlyoutModuleId={setCollapsedFlyoutModuleId}
                            onMobileClose={onMobileClose}
                        />
                    ))}
                </nav>
            </div>

            <div className="p-4 border-t border-slate-800/90 bg-slate-950/40">
                {(isOpen || isMobile) && plan && (
                    <div className="mb-4 p-3 rounded-xl bg-slate-900/90 border border-slate-800">
                        <div className="text-xs font-semibold text-slate-400 mb-1">Plan Actual</div>
                        <div className="flex justify-between items-center text-sm font-medium text-white">
                            <span>{plan.name}</span>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">Activo</span>
                        </div>
                    </div>
                )}

                <button
                    onClick={onProfileClick}
                    className={`relative w-full flex items-center gap-3 p-2 rounded-xl hover:bg-slate-800 transition-colors group ${!isOpen && !isMobile ? 'justify-center' : ''}`}
                    title={!isOpen && !isMobile ? 'Perfil' : undefined}
                >
                    <Avatar src={profile?.avatar_url} name={profile?.full_name} size="sm" />
                    {(isOpen || isMobile) && (
                        <div className="flex-1 text-left min-w-0">
                            <div className="text-sm font-medium text-white truncate group-hover:text-cyan-300 transition-colors">{profile?.full_name}</div>
                            <div className="text-xs text-slate-500 truncate">{profile?.email}</div>
                        </div>
                    )}
                </button>

                {(isOpen || isMobile) && (
                    <button
                        onClick={signOut}
                        className="w-full mt-2 flex items-center gap-2 px-2 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl transition-colors"
                    >
                        <LogOut className="w-4 h-4" />
                        <span>Cerrar Sesión</span>
                    </button>
                )}
            </div>
        </aside>
    );
}
