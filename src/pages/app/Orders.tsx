import { useLocation } from 'react-router-dom';
import { OrdersListPage } from './orders/OrdersListPage';
import { CreateOrderPage } from './orders/CreateOrderPage';

export function Orders() {
  const location = useLocation();

  if (location.pathname === '/app/orders/crear-ot') {
    return <CreateOrderPage />;
  }

  return <OrdersListPage />;
}
