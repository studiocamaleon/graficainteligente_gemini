import { motion } from 'framer-motion';
import { Calendar, AlertCircle, Clock, Package } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '../ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '../ui/shadcn-table';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { ProximaEntrega, UrgenciaConfig } from '../../types/dashboard';

interface ProximasEntregasTableProps {
  entregas: ProximaEntrega[];
  loading?: boolean;
}

const urgenciaConfig: Record<string, UrgenciaConfig> = {
  critico: {
    color: 'bg-red-500',
    bgColor: 'bg-red-50',
    textColor: 'text-red-700',
    label: 'Crítico',
  },
  urgente: {
    color: 'bg-orange-500',
    bgColor: 'bg-orange-50',
    textColor: 'text-orange-700',
    label: 'Urgente',
  },
  proximo: {
    color: 'bg-yellow-500',
    bgColor: 'bg-yellow-50',
    textColor: 'text-yellow-700',
    label: 'Próximo',
  },
  normal: {
    color: 'bg-green-500',
    bgColor: 'bg-green-50',
    textColor: 'text-green-700',
    label: 'Normal',
  },
};

export function ProximasEntregasTable({ entregas, loading }: ProximasEntregasTableProps) {
  const navigate = useNavigate();
  const INITIAL_VISIBLE_ROWS = 10;
  const LOAD_MORE_STEP = 10;
  const [visibleRows, setVisibleRows] = useState(INITIAL_VISIBLE_ROWS);

  useEffect(() => {
    setVisibleRows(INITIAL_VISIBLE_ROWS);
  }, [entregas]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="h-6 bg-gray-200 rounded w-48 animate-pulse"></div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-4">
                <div className="h-12 w-12 bg-gray-200 rounded animate-pulse"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-3/4 animate-pulse"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2 animate-pulse"></div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="col-span-1 lg:col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-gray-500" />
          Próximas Entregas
        </CardTitle>
        <CardDescription>
          Órdenes pendientes de entrega organizadas por urgencia
        </CardDescription>
      </CardHeader>
      <CardContent>
        {entregas.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No hay entregas pendientes próximas</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Orden</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Entrega</TableHead>
                <TableHead>Progreso</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entregas.slice(0, visibleRows).map((entrega) => {
                const urgencia = urgenciaConfig[entrega.nivel_urgencia];

                return (
                  <TableRow
                    key={entrega.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/app/orders/${entrega.id}`)}
                  >
                    <TableCell className="font-medium">
                      {entrega.numero_orden}
                      {entrega.nivel_urgencia === 'critico' && (
                        <AlertCircle className="w-4 h-4 text-red-500 inline ml-2" />
                      )}
                    </TableCell>
                    <TableCell>{entrega.cliente_nombre}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="flex items-center gap-1 text-sm">
                          <Calendar className="w-3 h-3 text-gray-400" />
                          {new Date(entrega.fecha_estimada_entrega).toLocaleDateString()}
                        </span>
                        <span className={`text-xs w-fit px-1.5 py-0.5 rounded-full mt-1 ${urgencia.bgColor} ${urgencia.textColor}`}>
                          {entrega.dias_restantes} días
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="w-full max-w-[100px]">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-gray-500">{entrega.progreso_porcentaje}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${entrega.progreso_porcentaje}%` }}
                            className={`h-full rounded-full ${urgencia.color}`}
                          />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={entrega.estado === 'en_proceso' ? 'blue' : 'default'}>
                        {entrega.estado === 'en_proceso' ? 'En Proceso' : 'Pendiente'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}

        {entregas.length > visibleRows && (
          <div className="mt-4 flex justify-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setVisibleRows((prev) => Math.min(prev + LOAD_MORE_STEP, entregas.length))}
            >
              Ver más
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
