import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { ToastProvider } from './contexts/ToastContext';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { ProtectedModuleRoute } from './components/auth/ProtectedModuleRoute';
import { MainLayout } from './layouts/MainLayout';
import { Landing } from './pages/Landing';
import { Login } from './pages/auth/Login';
import { Register } from './pages/auth/Register';
import { Dashboard } from './pages/app/Dashboard';
import { Clients } from './pages/app/Clients';
import { Providers } from './pages/app/Providers';
import { OrdersListPage } from './pages/app/orders/OrdersListPage';
import { CreateOrderPage } from './pages/app/orders/CreateOrderPage';
import { OrderDetailPage } from './pages/app/orders/OrderDetailPage';
import { ProductionPage } from './pages/app/production/ProductionPage';
import Finanzas from './pages/app/Finanzas';
import { Team } from './pages/app/Team';
import { Integrations } from './pages/app/Integrations';
import { WhatsAppIntegration } from './pages/app/integrations/WhatsAppIntegration';
import { SystemSettings } from './pages/app/SystemSettings';
import { Locations } from './pages/app/settings/Locations';
import MediosCobro from './pages/app/settings/MediosCobro';
import Cajas from './pages/app/settings/Cajas';
import TiposEgreso from './pages/app/settings/TiposEgreso';
import TiposIngreso from './pages/app/settings/TiposIngreso';
import CondicionesComerciales from './pages/app/settings/CondicionesComerciales';
import PresupuestosListPage from './pages/app/presupuestos/PresupuestosListPage';
import CrearPresupuesto from './pages/app/presupuestos/CrearPresupuesto';
import EditarPresupuesto from './pages/app/presupuestos/EditarPresupuesto';
import DetallePresupuesto from './pages/app/presupuestos/DetallePresupuesto';
import { Estaciones } from './pages/app/abm-core/Estaciones';
import { Tecnologias } from './pages/app/abm-core/Tecnologias';
import { Materiales } from './pages/app/abm-core/Materiales';
import { Pasos } from './pages/app/abm-core/Pasos';
import { RutasProduccion } from './pages/app/abm-core/RutasProduccion';
import { Servicios } from './pages/app/abm-core/Servicios';
import { Acabados } from './pages/app/abm-core/Acabados';
import { RangosPrecio } from './pages/app/abm-core/RangosPrecio';
import { ImpresionLaser } from './pages/app/productos/ImpresionLaser';
import { Talonarios } from './pages/app/productos/Talonarios';
import { GranFormato } from './pages/app/productos/GranFormato';
import { MaterialesRigidos } from './pages/app/productos/MaterialesRigidos';
import { PlotterCorte } from './pages/app/productos/PlotterCorte';
import { Sellos } from './pages/app/productos/Sellos';
import { Portabanners } from './pages/app/productos/Portabanners';
import { Configuracion as CentroCopiadoConfiguracion } from './pages/app/centro-copiado/Configuracion';
import { Terminaciones as CentroCopiadoTerminaciones } from './pages/app/centro-copiado/Terminaciones';
import { RangosPrecio as CentroCopiadoRangosPrecio } from './pages/app/centro-copiado/RangosPrecio';
import { Precios as CentroCopiadoPrecios } from './pages/app/centro-copiado/Precios';
import { Ordenes as CentroCopiadoOrdenes } from './pages/app/centro-copiado/Ordenes';
import { CrearOrdenCopiado } from './pages/app/centro-copiado/CrearOrdenCopiado';
import { DetalleOrdenCopiado } from './pages/app/centro-copiado/DetalleOrdenCopiado';
import { OrderTracking } from './pages/public/OrderTracking';
import { JobsMonitor } from './pages/public/JobsMonitor';
import PresupuestoTracking from './pages/public/PresupuestoTracking';
import { FacturaRedirect } from './pages/public/FacturaRedirect';
import { ClienteRegistro } from './pages/public/ClienteRegistro';

function AppRoutes() {
  const { user, loading, isAuthenticating } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route
        path="/"
        element={user && !isAuthenticating ? <Navigate to="/app/dashboard" replace /> : <Landing />}
      />
      <Route
        path="/login"
        element={user && !isAuthenticating ? <Navigate to="/app/dashboard" replace /> : <Login />}
      />
      <Route
        path="/register"
        element={user && !isAuthenticating ? <Navigate to="/app/dashboard" replace /> : <Register />}
      />

      <Route path="/track/:token" element={<OrderTracking />} />
      <Route path="/tracking/presupuesto/:token" element={<PresupuestoTracking />} />
      <Route path="/monitor/jobs/:companyId" element={<JobsMonitor />} />
      <Route path="/:companyId/facturas/:token" element={<FacturaRedirect />} />
      <Route path="/registro/:companyId" element={<ClienteRegistro />} />

      <Route
        path="/app/*"
        element={
          <ProtectedRoute>
            <MainLayout>
              <Routes>
                <Route path="dashboard" element={<Dashboard />} />
                <Route
                  path="clients"
                  element={
                    <ProtectedModuleRoute moduleId="clients">
                      <Clients />
                    </ProtectedModuleRoute>
                  }
                />
                <Route
                  path="providers"
                  element={
                    <ProtectedModuleRoute moduleId="providers">
                      <Providers />
                    </ProtectedModuleRoute>
                  }
                />
                <Route
                  path="abm-core/estaciones"
                  element={
                    <ProtectedModuleRoute moduleId="abm-core-estaciones">
                      <Estaciones />
                    </ProtectedModuleRoute>
                  }
                />
                <Route
                  path="abm-core/tecnologias"
                  element={
                    <ProtectedModuleRoute moduleId="abm-core-tecnologias">
                      <Tecnologias />
                    </ProtectedModuleRoute>
                  }
                />
                <Route
                  path="abm-core/materiales"
                  element={
                    <ProtectedModuleRoute moduleId="abm-core-materiales">
                      <Materiales />
                    </ProtectedModuleRoute>
                  }
                />
                <Route
                  path="abm-core/pasos"
                  element={
                    <ProtectedModuleRoute moduleId="abm-core-pasos">
                      <Pasos />
                    </ProtectedModuleRoute>
                  }
                />
                <Route
                  path="abm-core/rutas-produccion"
                  element={
                    <ProtectedModuleRoute moduleId="abm-core-rutas-produccion">
                      <RutasProduccion />
                    </ProtectedModuleRoute>
                  }
                />
                <Route
                  path="abm-core/servicios"
                  element={
                    <ProtectedModuleRoute moduleId="abm-core-servicios">
                      <Servicios />
                    </ProtectedModuleRoute>
                  }
                />
                <Route
                  path="abm-core/acabados"
                  element={
                    <ProtectedModuleRoute moduleId="abm-core-acabados">
                      <Acabados />
                    </ProtectedModuleRoute>
                  }
                />
                <Route
                  path="abm-core/rangos-precio"
                  element={
                    <ProtectedModuleRoute moduleId="abm-core-rangos-precio">
                      <RangosPrecio />
                    </ProtectedModuleRoute>
                  }
                />
                <Route
                  path="productos/impresion-laser"
                  element={
                    <ProtectedModuleRoute moduleId="productos-impresion-laser">
                      <ImpresionLaser />
                    </ProtectedModuleRoute>
                  }
                />
                <Route
                  path="productos/talonarios"
                  element={
                    <ProtectedModuleRoute moduleId="productos-talonarios">
                      <Talonarios />
                    </ProtectedModuleRoute>
                  }
                />
                <Route
                  path="productos/gran-formato"
                  element={
                    <ProtectedModuleRoute moduleId="productos-gran-formato">
                      <GranFormato />
                    </ProtectedModuleRoute>
                  }
                />
                <Route
                  path="productos/materiales-rigidos"
                  element={
                    <ProtectedModuleRoute moduleId="productos-materiales-rigidos">
                      <MaterialesRigidos />
                    </ProtectedModuleRoute>
                  }
                />
                <Route
                  path="productos/plotter-corte"
                  element={
                    <ProtectedModuleRoute moduleId="productos-plotter-corte">
                      <PlotterCorte />
                    </ProtectedModuleRoute>
                  }
                />
                <Route
                  path="productos/sellos"
                  element={
                    <ProtectedModuleRoute moduleId="productos-sellos">
                      <Sellos />
                    </ProtectedModuleRoute>
                  }
                />
                <Route
                  path="productos/portabanners"
                  element={
                    <ProtectedModuleRoute moduleId="productos-portabanners">
                      <Portabanners />
                    </ProtectedModuleRoute>
                  }
                />
                <Route
                  path="centro-copiado/configuracion"
                  element={
                    <ProtectedModuleRoute moduleId="centro-copiado-configuracion">
                      <CentroCopiadoConfiguracion />
                    </ProtectedModuleRoute>
                  }
                />
                <Route
                  path="centro-copiado/terminaciones"
                  element={
                    <ProtectedModuleRoute moduleId="centro-copiado-terminaciones">
                      <CentroCopiadoTerminaciones />
                    </ProtectedModuleRoute>
                  }
                />
                <Route
                  path="centro-copiado/rangos-precio"
                  element={
                    <ProtectedModuleRoute moduleId="centro-copiado-rangos-precio">
                      <CentroCopiadoRangosPrecio />
                    </ProtectedModuleRoute>
                  }
                />
                <Route
                  path="centro-copiado/precios"
                  element={
                    <ProtectedModuleRoute moduleId="centro-copiado-precios">
                      <CentroCopiadoPrecios />
                    </ProtectedModuleRoute>
                  }
                />
                <Route
                  path="centro-copiado/ordenes"
                  element={
                    <ProtectedModuleRoute moduleId="centro-copiado-ordenes">
                      <CentroCopiadoOrdenes />
                    </ProtectedModuleRoute>
                  }
                />
                <Route
                  path="centro-copiado/ordenes/crear"
                  element={
                    <ProtectedModuleRoute moduleId="centro-copiado-ordenes-crear">
                      <CrearOrdenCopiado />
                    </ProtectedModuleRoute>
                  }
                />
                <Route
                  path="centro-copiado/ordenes/:id"
                  element={
                    <ProtectedModuleRoute moduleId="centro-copiado-ordenes">
                      <DetalleOrdenCopiado />
                    </ProtectedModuleRoute>
                  }
                />
                <Route path="orders" element={<Navigate to="/app/orders/ordenes" replace />} />
                <Route
                  path="orders/ordenes"
                  element={
                    <ProtectedModuleRoute moduleId="orders-lista">
                      <OrdersListPage />
                    </ProtectedModuleRoute>
                  }
                />
                <Route
                  path="orders/crear-ot"
                  element={
                    <ProtectedModuleRoute moduleId="orders-crear">
                      <CreateOrderPage />
                    </ProtectedModuleRoute>
                  }
                />
                <Route
                  path="orders/:id"
                  element={
                    <ProtectedModuleRoute moduleId="orders-lista">
                      <OrderDetailPage />
                    </ProtectedModuleRoute>
                  }
                />
                <Route path="presupuestos" element={<Navigate to="/app/presupuestos/lista" replace />} />
                <Route
                  path="presupuestos/lista"
                  element={
                    <ProtectedModuleRoute moduleId="presupuestos-lista">
                      <PresupuestosListPage />
                    </ProtectedModuleRoute>
                  }
                />
                <Route
                  path="presupuestos/nuevo"
                  element={
                    <ProtectedModuleRoute moduleId="presupuestos-crear">
                      <CrearPresupuesto />
                    </ProtectedModuleRoute>
                  }
                />
                <Route
                  path="presupuestos/:id/editar"
                  element={
                    <ProtectedModuleRoute moduleId="presupuestos-crear">
                      <EditarPresupuesto />
                    </ProtectedModuleRoute>
                  }
                />
                <Route
                  path="presupuestos/:id"
                  element={
                    <ProtectedModuleRoute moduleId="presupuestos-lista">
                      <DetallePresupuesto />
                    </ProtectedModuleRoute>
                  }
                />
                <Route
                  path="production"
                  element={
                    <ProtectedModuleRoute moduleId="production">
                      <ProductionPage />
                    </ProtectedModuleRoute>
                  }
                />
                <Route
                  path="finanzas/*"
                  element={
                    <ProtectedModuleRoute moduleId="finance">
                      <Finanzas />
                    </ProtectedModuleRoute>
                  }
                />
                <Route
                  path="team"
                  element={
                    <ProtectedModuleRoute moduleId="team">
                      <Team />
                    </ProtectedModuleRoute>
                  }
                />
                <Route
                  path="integrations"
                  element={
                    <ProtectedModuleRoute moduleId="integrations">
                      <Integrations />
                    </ProtectedModuleRoute>
                  }
                />
                <Route
                  path="integrations/whatsapp"
                  element={
                    <ProtectedModuleRoute moduleId="integrations-whatsapp">
                      <WhatsAppIntegration />
                    </ProtectedModuleRoute>
                  }
                />
                <Route
                  path="settings"
                  element={
                    <ProtectedModuleRoute moduleId="settings">
                      <SystemSettings />
                    </ProtectedModuleRoute>
                  }
                />
                <Route
                  path="settings/pausas"
                  element={
                    <ProtectedModuleRoute moduleId="settings-pausas">
                      <SystemSettings />
                    </ProtectedModuleRoute>
                  }
                />
                <Route
                  path="settings/locations"
                  element={
                    <ProtectedModuleRoute moduleId="settings-locations">
                      <Locations />
                    </ProtectedModuleRoute>
                  }
                />
                <Route
                  path="settings/medios-cobro"
                  element={
                    <ProtectedModuleRoute moduleId="settings-medios-cobro">
                      <MediosCobro />
                    </ProtectedModuleRoute>
                  }
                />
                <Route
                  path="settings/cajas"
                  element={
                    <ProtectedModuleRoute moduleId="settings-cajas">
                      <Cajas />
                    </ProtectedModuleRoute>
                  }
                />
                <Route
                  path="settings/tipos-egreso"
                  element={
                    <ProtectedModuleRoute moduleId="settings-tipos-egreso">
                      <TiposEgreso />
                    </ProtectedModuleRoute>
                  }
                />
                <Route
                  path="settings/tipos-ingreso"
                  element={
                    <ProtectedModuleRoute moduleId="settings-tipos-ingreso">
                      <TiposIngreso />
                    </ProtectedModuleRoute>
                  }
                />
                <Route
                  path="settings/condiciones-comerciales"
                  element={
                    <ProtectedModuleRoute moduleId="presupuestos-condiciones">
                      <CondicionesComerciales />
                    </ProtectedModuleRoute>
                  }
                />
                <Route path="*" element={<Navigate to="/app/dashboard" replace />} />
              </Routes>
            </MainLayout>
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <AppRoutes />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
