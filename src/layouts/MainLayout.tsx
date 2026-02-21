import { type CSSProperties, ReactNode, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion'; // Keep for Notifications/Mobile logic if needed, or check usage
import { Menu, Bell, ClipboardList, CopyPlus } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { Sidebar } from '../components/layout/Sidebar';
import { PageHeaderProvider, usePageHeaderContext } from '../hooks/usePageHeader';
import { ProfileModal } from '../components/user/ProfileModal';
import { CompanyProfileModal } from '../components/company/CompanyProfileModal';
import { usePermissions } from '../hooks/usePermissions';
import { useNotificaciones } from '../hooks/useNotificaciones';
import { NotificationsPanel } from '../components/notifications/NotificationsPanel';
import { MODULES } from '../constants/modules'; // Used for title resolution

interface MainLayoutProps {
  children: ReactNode;
}

function MainLayoutContent({ children }: MainLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile } = useAuth(); // company/plan unused here now? actually Sidebar needs them but it gets them from hook internally.
  const { canAccessModule, hasPermission } = usePermissions();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  // expandedModules removed
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const { noLeidas } = useNotificaciones();

  const canEditCompany = profile?.role === 'super_admin' || profile?.role === 'admin';

  const availableModules = MODULES.filter(module => canAccessModule(module.id));

  const isActive = (path: string) => location.pathname === path;

  // renderModule removed



  const pageHeaderContext = usePageHeaderContext();
  const description = pageHeaderContext.description;
  const action = pageHeaderContext.action;
  const pageTitle = description;
  const canCreateOT = hasPermission('orders-crear', 'create');
  const canCreateOC = hasPermission('centro-copiado-ordenes-crear', 'create');
  const isOrderDetailRoute = /^\/app\/orders\/[a-f0-9-]+$/i.test(location.pathname);
  const isCopyOrderDetailRoute = /^\/app\/centro-copiado\/ordenes\/[a-f0-9-]+$/i.test(location.pathname);
  const hideQuickActions = isOrderDetailRoute || isCopyOrderDetailRoute;
  const showQuickActions = (canCreateOT || canCreateOC) && !hideQuickActions;

  const getCurrentPageTitle = () => {
    // Si hay un título configurado vía usePageHeader, usarlo
    if (pageTitle) {
      return pageTitle;
    }

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
      <Sidebar
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
        isMobile={false}
        onCompanyClick={() => canEditCompany && setIsCompanyModalOpen(true)}
        onProfileClick={() => setIsProfileModalOpen(true)}
      />

      <AnimatePresence>
        {isMobileMenuOpen && (
          <Sidebar
            isOpen={true}
            setIsOpen={() => { }}
            isMobile={true}
            onMobileClose={() => setIsMobileMenuOpen(false)}
            onCompanyClick={() => {
              if (canEditCompany) {
                setIsMobileMenuOpen(false);
                setIsCompanyModalOpen(true);
              }
            }}
            onProfileClick={() => setIsProfileModalOpen(true)}
          />
        )}
      </AnimatePresence>

      <div
        style={{ '--main-layout-offset': isSidebarOpen ? '19rem' : '6rem' } as CSSProperties}
        className={`flex-1 flex flex-col ${isSidebarOpen ? 'lg:ml-[19rem]' : 'lg:ml-24'} transition-all duration-300`}
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
                </div>
              </div>

              <div className="flex items-center gap-3">
                {/* Botón de Notificaciones */}
                <div className="relative">
                  <button
                    onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                    className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
                  >
                    <Bell className="w-5 h-5 text-gray-600" />
                    {noLeidas > 0 && (
                      <motion.span
                        key={noLeidas}
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center px-1"
                      >
                        {noLeidas > 9 ? '9+' : noLeidas}
                      </motion.span>
                    )}
                  </button>

                  {/* Panel de Notificaciones */}
                  <AnimatePresence>
                    {isNotificationsOpen && (
                      <>
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          onClick={() => setIsNotificationsOpen(false)}
                          className="fixed inset-0 z-40"
                        />
                        <motion.div
                          initial={{ opacity: 0, y: -10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -10, scale: 0.95 }}
                          transition={{ duration: 0.15 }}
                          className="absolute right-0 top-full mt-2 z-50"
                        >
                          <NotificationsPanel />
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>

                {action && (
                  <div className="flex-shrink-0">
                    {action}
                  </div>
                )}
              </div>
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

      {showQuickActions && (
        <div className="fixed bottom-24 right-6 z-40 flex flex-col gap-3 md:bottom-20">
          {canCreateOT && (
            <button
              type="button"
              onClick={() => navigate('/app/orders/crear-ot')}
              className="group inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-lg transition-all hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
            >
              <ClipboardList className="h-4 w-4 text-blue-600" />
              <span>Crear OT</span>
            </button>
          )}

          {canCreateOC && (
            <button
              type="button"
              onClick={() => navigate('/app/centro-copiado/ordenes/crear')}
              className="group inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-lg transition-all hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
            >
              <CopyPlus className="h-4 w-4 text-emerald-600" />
              <span>Crear OC</span>
            </button>
          )}
        </div>
      )}
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
