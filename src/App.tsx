import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
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
import { Production } from './pages/app/Production';
import { Finance } from './pages/app/Finance';
import { Team } from './pages/app/Team';
import { Integrations } from './pages/app/Integrations';
import { SystemSettings } from './pages/app/SystemSettings';
import { Locations } from './pages/app/settings/Locations';
import { Estaciones } from './pages/app/abm-core/Estaciones';
import { Tecnologias } from './pages/app/abm-core/Tecnologias';
import { Materiales } from './pages/app/abm-core/Materiales';
import { Pasos } from './pages/app/abm-core/Pasos';
import { RutasProduccion } from './pages/app/abm-core/RutasProduccion';
import { Servicios } from './pages/app/abm-core/Servicios';
import { Acabados } from './pages/app/abm-core/Acabados';
import { RangosPrecio } from './pages/app/abm-core/RangosPrecio';
import { ImpresionLaser } from './pages/app/productos/ImpresionLaser';
import { GranFormato } from './pages/app/productos/GranFormato';
import { MaterialesRigidos } from './pages/app/productos/MaterialesRigidos';
import { PlotterCorte } from './pages/app/productos/PlotterCorte';
import { Sellos } from './pages/app/productos/Sellos';
import { Portabanners } from './pages/app/productos/Portabanners';
import { Configuracion as CentroCopiadoConfiguracion } from './pages/app/centro-copiado/Configuracion';
import { RangosPrecio as CentroCopiadoRangosPrecio } from './pages/app/centro-copiado/RangosPrecio';
import { Precios as CentroCopiadoPrecios } from './pages/app/centro-copiado/Precios';
import { Ordenes as CentroCopiadoOrdenes } from './pages/app/centro-copiado/Ordenes';

function AppRoutes() {
  const { user, loading } = useAuth();

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
        element={user ? <Navigate to="/app/dashboard" replace /> : <Landing />}
      />
      <Route
        path="/login"
        element={user ? <Navigate to="/app/dashboard" replace /> : <Login />}
      />
      <Route
        path="/register"
        element={user ? <Navigate to="/app/dashboard" replace /> : <Register />}
      />

      <Route
        path="/app/*"
        element={
          <ProtectedRoute>
            <MainLayout>
              <Routes>
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="clients" element={<Clients />} />
                <Route path="providers" element={<Providers />} />
                <Route path="abm-core/estaciones" element={<Estaciones />} />
                <Route path="abm-core/tecnologias" element={<Tecnologias />} />
                <Route path="abm-core/materiales" element={<Materiales />} />
                <Route path="abm-core/pasos" element={<Pasos />} />
                <Route path="abm-core/rutas-produccion" element={<RutasProduccion />} />
                <Route path="abm-core/servicios" element={<Servicios />} />
                <Route path="abm-core/acabados" element={<Acabados />} />
                <Route path="abm-core/rangos-precio" element={<RangosPrecio />} />
                <Route path="productos/impresion-laser" element={<ImpresionLaser />} />
                <Route path="productos/gran-formato" element={<GranFormato />} />
                <Route path="productos/materiales-rigidos" element={<MaterialesRigidos />} />
                <Route path="productos/plotter-corte" element={<PlotterCorte />} />
                <Route path="productos/sellos" element={<Sellos />} />
                <Route path="productos/portabanners" element={<Portabanners />} />
                <Route path="centro-copiado/configuracion" element={<CentroCopiadoConfiguracion />} />
                <Route path="centro-copiado/rangos-precio" element={<CentroCopiadoRangosPrecio />} />
                <Route path="centro-copiado/precios" element={<CentroCopiadoPrecios />} />
                <Route path="centro-copiado/ordenes" element={<CentroCopiadoOrdenes />} />
                <Route path="orders" element={<Navigate to="/app/orders/ordenes" replace />} />
                <Route path="orders/ordenes" element={<OrdersListPage />} />
                <Route path="orders/crear-ot" element={<CreateOrderPage />} />
                <Route path="orders/:id" element={<OrderDetailPage />} />
                <Route path="production" element={<Production />} />
                <Route path="finanzas" element={<Finance />} />
                <Route
                  path="team"
                  element={
                    <ProtectedModuleRoute moduleId="team">
                      <Team />
                    </ProtectedModuleRoute>
                  }
                />
                <Route path="integrations" element={<Integrations />} />
                <Route path="settings" element={<SystemSettings />} />
                <Route path="settings/locations" element={<Locations />} />
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
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
