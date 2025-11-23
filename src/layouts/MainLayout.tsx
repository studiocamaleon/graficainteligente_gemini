import { ReactNode, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, LogOut, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Settings, Building2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { MODULES, Module } from '../constants/modules';
import { Avatar } from '../components/ui/Avatar';
import { Badge } from '../components/ui/Badge';
import { PLAN_COLORS } from '../constants/plans';
import { PageHeaderProvider, usePageHeaderContext } from '../hooks/usePageHeader';
import { ProfileModal } from '../components/user/ProfileModal';
import { CompanyProfileModal } from '../components/company/CompanyProfileModal';
import { usePermissions } from '../hooks/usePermissions';

interface MainLayoutProps {
  children: ReactNode;
}

function MainLayoutContent({ children }: MainLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, company, plan, signOut } = useAuth();
  const { canAccessModule } = usePermissions();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [expandedModules, setExpandedModules] = useState<string[]>([]);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);

  const canEditCompany = profile?.role === 'super_admin' || profile?.role === 'admin';

  const availableModules = MODULES.filter(module => canAccessModule(module.id));

  const handleSignOut = async () => {
    await signOut();
  };

  const isActive = (path: string) => location.pathname === path;
  const isModuleActive = (module: Module) => {
    if (isActive(module.path)) return true;
    if (module.children) {
      return module.children.some(child => isActive(child.path));
    }
    return false;
  };

  const toggleModule = (moduleId: string) => {
    setExpandedModules(prev =>
      prev.includes(moduleId)
        ? prev.filter(id => id !== moduleId)
        : [...prev, moduleId]
    );
  };

  const planColor = plan ? PLAN_COLORS[plan.slug as keyof typeof PLAN_COLORS] : PLAN_COLORS.free;

  const renderModule = (module: Module, isMobile: boolean = false) => {
    const Icon = module.icon;
    const active = isModuleActive(module);
    const hasChildren = module.children && module.children.length > 0;
    const isExpanded = expandedModules.includes(module.id);

    return (
      <div key={module.id}>
        {hasChildren ? (
          <>
            <motion.button
              onClick={() => toggleModule(module.id)}
              whileHover={{ x: active ? 0 : 4 }}
              whileTap={{ scale: 0.98 }}
              className={`
                w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg transition-all relative overflow-hidden group
                ${active
                  ? 'text-white'
                  : 'text-white/70 hover:text-white'
                }
              `}
              style={active ? {
                background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.4) 0%, rgba(6, 182, 212, 0.4) 100%)',
                border: '1px solid rgba(59, 130, 246, 0.5)',
                boxShadow: '0 0 25px rgba(59, 130, 246, 0.4), inset 0 0 15px rgba(6, 182, 212, 0.2)'
              } : {
                border: '1px solid transparent'
              }}
            >
              {!active && (
                <div className="absolute inset-0 bg-white/0 group-hover:bg-white/5 transition-all duration-300 rounded-lg" />
              )}
              {active && (
                <>
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 via-cyan-500/20 to-blue-500/20 animate-pulse" />
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-400 to-cyan-400 shadow-lg shadow-cyan-500/50" />
                </>
              )}
              <div className="flex items-center gap-3 relative z-10">
                <Icon className={`w-5 h-5 flex-shrink-0 transition-all duration-300 ${active ? 'text-cyan-300 drop-shadow-lg' : 'text-white/60 group-hover:text-cyan-400'}`} />
                {(isSidebarOpen || isMobile) && (
                  <span className="font-medium text-sm truncate">{module.name}</span>
                )}
              </div>
              {(isSidebarOpen || isMobile) && (
                <div className="relative z-10">
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 flex-shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 flex-shrink-0" />
                  )}
                </div>
              )}
            </motion.button>

            <AnimatePresence>
              {isExpanded && (isSidebarOpen || isMobile) && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="ml-4 mt-1 space-y-1 overflow-hidden"
                >
                  {module.children?.map((subModule) => {
                    const SubIcon = subModule.icon;
                    const subActive = isActive(subModule.path);

                    return (
                      <Link
                        key={subModule.id}
                        to={subModule.path}
                        onClick={() => isMobile && setIsMobileMenuOpen(false)}
                      >
                        <motion.div
                          whileHover={{ x: 4 }}
                          whileTap={{ scale: 0.98 }}
                          className={`
                            flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-sm relative overflow-hidden group
                            ${subActive
                              ? 'text-cyan-300 font-medium'
                              : 'text-white/60 hover:text-white/90'
                            }
                          `}
                          style={subActive ? {
                            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(6, 182, 212, 0.2) 100%)',
                            border: '1px solid rgba(6, 182, 212, 0.3)'
                          } : {}}
                        >
                          {!subActive && (
                            <div className="absolute inset-0 bg-white/0 group-hover:bg-white/5 transition-colors rounded-lg" />
                          )}
                          {subActive && (
                            <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gradient-to-b from-cyan-400 to-blue-400" />
                          )}
                          {SubIcon && <SubIcon className="w-4 h-4 flex-shrink-0 relative z-10" />}
                          <span className="truncate relative z-10">{subModule.name}</span>
                        </motion.div>
                      </Link>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </>
        ) : (
          <Link to={module.path} onClick={() => isMobile && setIsMobileMenuOpen(false)}>
            <motion.div
              whileHover={{ x: active ? 0 : 4 }}
              whileTap={{ scale: 0.98 }}
              className={`
                flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all relative overflow-hidden group
                ${active
                  ? 'text-white'
                  : 'text-white/70 hover:text-white'
                }
              `}
              style={active ? {
                background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.4) 0%, rgba(6, 182, 212, 0.4) 100%)',
                border: '1px solid rgba(59, 130, 246, 0.5)',
                boxShadow: '0 0 25px rgba(59, 130, 246, 0.4), inset 0 0 15px rgba(6, 182, 212, 0.2)'
              } : {
                border: '1px solid transparent'
              }}
            >
              {!active && (
                <div className="absolute inset-0 bg-white/0 group-hover:bg-white/5 transition-all duration-300 rounded-lg" />
              )}
              {active && (
                <>
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 via-cyan-500/20 to-blue-500/20 animate-pulse" />
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-400 to-cyan-400 shadow-lg shadow-cyan-500/50" />
                </>
              )}
              <Icon className={`w-5 h-5 flex-shrink-0 relative z-10 transition-all duration-300 ${active ? 'text-cyan-300 drop-shadow-lg' : 'text-white/60 group-hover:text-cyan-400'}`} />
              {(isSidebarOpen || isMobile) && (
                <span className="font-medium text-sm truncate relative z-10">{module.name}</span>
              )}
            </motion.div>
          </Link>
        )}
      </div>
    );
  };

  const { description, action } = usePageHeaderContext();

  const getCurrentPageTitle = () => {
    // Detectar rutas dinámicas de detalle de orden
    if (location.pathname.match(/^\/app\/orders\/[a-f0-9-]+$/)) {
      return 'Detalle de Orden';
    }

    // Detectar rutas dinámicas de detalle de orden de copiado
    if (location.pathname.match(/^\/app\/centro-copiado\/ordenes\/[a-f0-9-]+$/)) {
      return 'Detalle de Orden de Copiado';
    }

    for (const module of availableModules) {
      if (isActive(module.path)) return module.name;
      if (module.children) {
        const activeChild = module.children.find(child => isActive(child.path));
        if (activeChild) return activeChild.name;
      }
    }
    return 'PrintFlow';
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <aside
        className={`${
          isSidebarOpen ? 'w-72' : 'w-20'
        } hidden lg:flex flex-col bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 transition-all duration-300 fixed h-screen z-30 shadow-2xl shadow-blue-500/20`}
        style={{
          backgroundImage: `
            radial-gradient(circle at 20% 50%, rgba(6, 182, 212, 0.08) 0%, transparent 50%),
            radial-gradient(circle at 80% 80%, rgba(59, 130, 246, 0.08) 0%, transparent 50%),
            linear-gradient(135deg, #0f172a 0%, #1e3a8a 50%, #0f172a 100%)
          `,
          borderRight: '1px solid rgba(59, 130, 246, 0.2)',
          boxShadow: '0 0 40px rgba(59, 130, 246, 0.15), inset 0 0 60px rgba(59, 130, 246, 0.03)'
        }}
      >
        <div className="absolute inset-0 opacity-5 pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(circle, rgba(59, 130, 246, 0.5) 1px, transparent 1px)`,
            backgroundSize: '20px 20px'
          }}
        />

        <div className="relative p-4 border-b border-white/10 flex items-center justify-between backdrop-blur-sm">
          {isSidebarOpen && (
            <motion.button
              onClick={() => canEditCompany && setIsCompanyModalOpen(true)}
              disabled={!canEditCompany}
              className={`flex items-center gap-2 flex-1 min-w-0 ${canEditCompany ? 'cursor-pointer hover:opacity-80' : 'cursor-default'} transition-opacity group`}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
              whileHover={canEditCompany ? { scale: 1.02 } : {}}
              whileTap={canEditCompany ? { scale: 0.98 } : {}}
            >
              <motion.div
                className="w-10 h-10 bg-gradient-to-br from-blue-500 via-cyan-500 to-blue-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-blue-500/50 relative overflow-hidden"
                animate={{
                  boxShadow: [
                    '0 0 20px rgba(59, 130, 246, 0.5)',
                    '0 0 30px rgba(6, 182, 212, 0.6)',
                    '0 0 20px rgba(59, 130, 246, 0.5)'
                  ]
                }}
                transition={{
                  boxShadow: { duration: 2, repeat: Infinity, ease: "easeInOut" }
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-tr from-white/20 to-transparent" />
                {company?.logo_url ? (
                  <img
                    src={company.logo_url}
                    alt={company.name}
                    className="w-full h-full object-cover rounded-xl relative z-10"
                  />
                ) : (
                  <span className="text-white font-bold text-xl relative z-10">P</span>
                )}
              </motion.div>
              <div className="flex-1 min-w-0 overflow-hidden">
                <div className="font-bold text-white text-sm truncate drop-shadow-lg">
                  {company?.name || 'PrintFlow'}
                </div>
              </div>
              {canEditCompany && (
                <Building2 className="w-4 h-4 text-white/60 group-hover:text-cyan-300 transition-colors flex-shrink-0" />
              )}
            </motion.button>
          )}
          <motion.button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 hover:bg-white/10 rounded-lg transition-all duration-300 backdrop-blur-sm group"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            {isSidebarOpen ? (
              <ChevronLeft className="w-5 h-5 text-white/80 group-hover:text-cyan-400 transition-colors" />
            ) : (
              <ChevronRight className="w-5 h-5 text-white/80 group-hover:text-cyan-400 transition-colors" />
            )}
          </motion.button>
        </div>

        <nav className="relative flex-1 overflow-y-auto p-4 space-y-1 scrollbar-thin scrollbar-thumb-blue-500/30 scrollbar-track-transparent">
          {availableModules.map((module) => renderModule(module, false))}
        </nav>

        <div className="relative p-4 border-t border-white/10 space-y-3 backdrop-blur-sm">
          {plan && isSidebarOpen && (
            <motion.div
              className="p-3 rounded-lg relative overflow-hidden"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(6, 182, 212, 0.2) 100%)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                boxShadow: '0 0 20px rgba(59, 130, 246, 0.2)'
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent" />
              <div className="relative z-10">
                <div className="text-xs font-semibold mb-1 text-cyan-300">Plan Actual</div>
                <div className="font-bold text-sm text-white">{plan.name}</div>
              </div>
            </motion.div>
          )}

          <motion.button
            onClick={() => setIsProfileModalOpen(true)}
            className="flex items-center gap-3 w-full p-2 rounded-lg hover:bg-white/10 transition-all cursor-pointer group"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Avatar src={profile?.avatar_url} name={profile?.full_name} size="md" />
            {isSidebarOpen && (
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm text-white truncate drop-shadow group-hover:text-cyan-300 transition-colors">
                  {profile?.full_name}
                </div>
                <div className="text-xs text-white/60 truncate">{profile?.email}</div>
                {profile?.role && (
                  <div className="mt-1">
                    <div className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-gradient-to-r from-blue-500/30 to-cyan-500/30 text-cyan-300 border border-cyan-500/30">
                      {profile.role.replace('_', ' ')}
                    </div>
                  </div>
                )}
              </div>
            )}
            {isSidebarOpen && (
              <Settings className="w-4 h-4 text-white/60 group-hover:text-cyan-300 transition-colors flex-shrink-0" />
            )}
          </motion.button>

          {isSidebarOpen && (
            <motion.button
              onClick={handleSignOut}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-all font-medium text-sm relative overflow-hidden group"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              style={{
                background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(220, 38, 38, 0.15) 100%)',
                border: '1px solid rgba(239, 68, 68, 0.3)'
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-red-500/0 via-red-500/10 to-red-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
              <LogOut className="w-4 h-4 text-red-400 relative z-10" />
              <span className="text-red-400 relative z-10">Cerrar Sesión</span>
            </motion.button>
          )}
        </div>
      </aside>

      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
            />

            <motion.aside
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed left-0 top-0 bottom-0 w-72 bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 z-50 lg:hidden flex flex-col shadow-2xl shadow-blue-500/30"
              style={{
                backgroundImage: `
                  radial-gradient(circle at 20% 50%, rgba(6, 182, 212, 0.08) 0%, transparent 50%),
                  radial-gradient(circle at 80% 80%, rgba(59, 130, 246, 0.08) 0%, transparent 50%),
                  linear-gradient(135deg, #0f172a 0%, #1e3a8a 50%, #0f172a 100%)
                `,
                borderRight: '1px solid rgba(59, 130, 246, 0.2)'
              }}
            >
              <div className="absolute inset-0 opacity-5 pointer-events-none"
                style={{
                  backgroundImage: `radial-gradient(circle, rgba(59, 130, 246, 0.5) 1px, transparent 1px)`,
                  backgroundSize: '20px 20px'
                }}
              />

              <div className="relative p-4 border-b border-white/10 flex items-center justify-between backdrop-blur-sm">
                <motion.button
                  onClick={() => {
                    if (canEditCompany) {
                      setIsMobileMenuOpen(false);
                      setIsCompanyModalOpen(true);
                    }
                  }}
                  disabled={!canEditCompany}
                  className={`flex items-center gap-2 flex-1 min-w-0 ${canEditCompany ? 'cursor-pointer hover:opacity-80' : 'cursor-default'} transition-opacity group`}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3 }}
                  whileHover={canEditCompany ? { scale: 1.02 } : {}}
                  whileTap={canEditCompany ? { scale: 0.98 } : {}}
                >
                  <motion.div
                    className="w-10 h-10 bg-gradient-to-br from-blue-500 via-cyan-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/50 relative overflow-hidden"
                    animate={{
                      boxShadow: [
                        '0 0 20px rgba(59, 130, 246, 0.5)',
                        '0 0 30px rgba(6, 182, 212, 0.6)',
                        '0 0 20px rgba(59, 130, 246, 0.5)'
                      ]
                    }}
                    transition={{
                      boxShadow: { duration: 2, repeat: Infinity, ease: "easeInOut" }
                    }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-tr from-white/20 to-transparent" />
                    {company?.logo_url ? (
                      <img
                        src={company.logo_url}
                        alt={company.name}
                        className="w-full h-full object-cover rounded-xl relative z-10"
                      />
                    ) : (
                      <span className="text-white font-bold text-xl relative z-10">P</span>
                    )}
                  </motion.div>
                  <span className="font-bold text-white drop-shadow-lg flex-1 truncate">{company?.name || 'PrintFlow'}</span>
                  {canEditCompany && (
                    <Building2 className="w-4 h-4 text-white/60 group-hover:text-cyan-300 transition-colors flex-shrink-0" />
                  )}
                </motion.button>
                <motion.button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-2 hover:bg-white/10 rounded-lg transition-all backdrop-blur-sm group ml-2"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <X className="w-5 h-5 text-white/80 group-hover:text-cyan-400 transition-colors" />
                </motion.button>
              </div>

              <nav className="relative flex-1 overflow-y-auto p-4 space-y-1 scrollbar-thin scrollbar-thumb-blue-500/30 scrollbar-track-transparent">
                {availableModules.map((module) => renderModule(module, true))}
              </nav>

              <div className="relative p-4 border-t border-white/10 space-y-3 backdrop-blur-sm">
                {plan && (
                  <motion.div
                    className="p-3 rounded-lg relative overflow-hidden"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{
                      background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(6, 182, 212, 0.2) 100%)',
                      border: '1px solid rgba(59, 130, 246, 0.3)',
                      boxShadow: '0 0 20px rgba(59, 130, 246, 0.2)'
                    }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent" />
                    <div className="relative z-10">
                      <div className="text-xs font-semibold mb-1 text-cyan-300">Plan Actual</div>
                      <div className="font-bold text-sm text-white">{plan.name}</div>
                    </div>
                  </motion.div>
                )}

                <motion.button
                  onClick={() => setIsProfileModalOpen(true)}
                  className="flex items-center gap-3 w-full p-2 rounded-lg hover:bg-white/10 transition-all cursor-pointer group"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Avatar src={profile?.avatar_url} name={profile?.full_name} size="md" />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm text-white truncate drop-shadow group-hover:text-cyan-300 transition-colors">
                      {profile?.full_name}
                    </div>
                    <div className="text-xs text-white/60 truncate">{profile?.email}</div>
                    {profile?.role && (
                      <div className="mt-1">
                        <div className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-gradient-to-r from-blue-500/30 to-cyan-500/30 text-cyan-300 border border-cyan-500/30">
                          {profile.role.replace('_', ' ')}
                        </div>
                      </div>
                    )}
                  </div>
                  <Settings className="w-4 h-4 text-white/60 group-hover:text-cyan-300 transition-colors flex-shrink-0" />
                </motion.button>

                <motion.button
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-all font-medium text-sm relative overflow-hidden group"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  style={{
                    background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(220, 38, 38, 0.15) 100%)',
                    border: '1px solid rgba(239, 68, 68, 0.3)'
                  }}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-red-500/0 via-red-500/10 to-red-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                  <LogOut className="w-4 h-4 text-red-400 relative z-10" />
                  <span className="text-red-400 relative z-10">Cerrar Sesión</span>
                </motion.button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div
        className={`flex-1 flex flex-col ${isSidebarOpen ? 'lg:ml-72' : 'lg:ml-20'} transition-all duration-300`}
      >
        <header className="bg-white border-b border-gray-200 sticky top-0 z-20 shadow-sm">
          <div className="px-4 sm:px-6 lg:px-8 h-[72px] flex items-center">
            <div className="flex items-center justify-between gap-4 w-full">
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <button
                  onClick={() => setIsMobileMenuOpen(true)}
                  className="lg:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
                >
                  <Menu className="w-6 h-6 text-gray-600" />
                </button>

                <div className="flex-1 min-w-0">
                  <h1 className="text-2xl font-bold text-gray-900">
                    {getCurrentPageTitle()}
                  </h1>
                  {description && (
                    <p className="text-sm text-gray-600 mt-1">{description}</p>
                  )}
                </div>
              </div>

              {action && (
                <div className="flex-shrink-0">
                  {action}
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto">
          <div className="px-4 sm:px-6 lg:px-8 py-6">{children}</div>
        </main>
      </div>

      <ProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
      />

      <CompanyProfileModal
        isOpen={isCompanyModalOpen}
        onClose={() => setIsCompanyModalOpen(false)}
      />
    </div>
  );
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <PageHeaderProvider>
      <MainLayoutContent>{children}</MainLayoutContent>
    </PageHeaderProvider>
  );
}
