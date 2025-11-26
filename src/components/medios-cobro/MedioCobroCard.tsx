import { CreditCard, Building2, Wallet, MoreVertical, Edit2, Trash2, Inbox } from 'lucide-react';
import { MedioCobro } from '../../types/medios-cobro';
import { Badge } from '../ui/Badge';
import { Switch } from '../ui/Switch';
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

interface MedioCobroCardProps {
  medio: MedioCobro;
  onEdit: (medio: MedioCobro) => void;
  onDelete: (id: string) => void;
  onToggleActive: (id: string) => void;
}

export function MedioCobroCard({ medio, onEdit, onDelete, onToggleActive }: MedioCobroCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [cajaNombre, setCajaNombre] = useState<string | null>(null);

  useEffect(() => {
    const fetchCaja = async () => {
      if (!medio.caja_id) return;

      const { data } = await supabase
        .from('cajas')
        .select('nombre')
        .eq('id', medio.caja_id)
        .single();

      if (data) {
        setCajaNombre(data.nombre);
      }
    };

    fetchCaja();
  }, [medio.caja_id]);

  const getIcon = () => {
    switch (medio.tipo) {
      case 'pasarela':
        return CreditCard;
      case 'bancario':
        return Building2;
      case 'efectivo':
        return Wallet;
      default:
        return CreditCard;
    }
  };

  const Icon = getIcon();

  const getTipoBadgeColor = () => {
    switch (medio.tipo) {
      case 'pasarela':
        return 'primary';
      case 'bancario':
        return 'secondary';
      case 'efectivo':
        return 'success';
      default:
        return 'secondary';
    }
  };

  return (
    <div className="relative bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3">
        <div className={`flex items-center justify-center w-12 h-12 rounded-lg flex-shrink-0 ${
          medio.tipo === 'pasarela' ? 'bg-blue-100' :
          medio.tipo === 'bancario' ? 'bg-purple-100' :
          'bg-green-100'
        }`}>
          <Icon className={`w-6 h-6 ${
            medio.tipo === 'pasarela' ? 'text-blue-600' :
            medio.tipo === 'bancario' ? 'text-purple-600' :
            'text-green-600'
          }`} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-2">
            <h3 className="font-semibold text-gray-900 truncate">{medio.nombre}</h3>
            <div className="flex items-center gap-2">
              <Switch
                checked={medio.is_active}
                onChange={() => onToggleActive(medio.id)}
              />
              <div className="relative">
                <button
                  onClick={() => setShowMenu(!showMenu)}
                  className="p-1 hover:bg-gray-100 rounded transition-colors"
                >
                  <MoreVertical className="w-4 h-4 text-gray-500" />
                </button>
                {showMenu && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setShowMenu(false)}
                    />
                    <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                      <button
                        onClick={() => {
                          onEdit(medio);
                          setShowMenu(false);
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                      >
                        <Edit2 className="w-4 h-4" />
                        Editar
                      </button>
                      <button
                        onClick={() => {
                          onDelete(medio.id);
                          setShowMenu(false);
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                      >
                        <Trash2 className="w-4 h-4" />
                        Eliminar
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 mb-3">
            <Badge variant={getTipoBadgeColor()}>
              {medio.tipo === 'pasarela' ? 'Pasarela' : medio.tipo === 'bancario' ? 'Bancario' : 'Efectivo'}
            </Badge>
            <Badge variant={medio.is_active ? 'success' : 'secondary'}>
              {medio.is_active ? 'Activo' : 'Inactivo'}
            </Badge>
            {medio.categoria && (
              <Badge variant="secondary">{medio.categoria}</Badge>
            )}
            {medio.forma_cobro && (
              <Badge variant="secondary">{medio.forma_cobro}</Badge>
            )}
          </div>

          <div className="space-y-2">
            {cajaNombre && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Inbox className="w-4 h-4 text-gray-400" />
                <span className="font-medium">Caja:</span>
                <span className="text-blue-600 font-semibold">{cajaNombre}</span>
              </div>
            )}

            {(medio.comision_porcentaje > 0 || medio.dias_liberacion > 0) && (
              <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                {medio.comision_porcentaje > 0 && (
                  <div>
                    <span className="font-medium">Comisión:</span>{' '}
                    <span className="text-orange-600 font-semibold">{medio.comision_porcentaje}%</span>
                  </div>
                )}
                {medio.dias_liberacion > 0 ? (
                  <div>
                    <span className="font-medium">Liberación:</span>{' '}
                    <span className="text-blue-600 font-semibold">{medio.dias_liberacion} días</span>
                  </div>
                ) : medio.comision_porcentaje === 0 && (
                  <div>
                    <span className="font-medium">Liberación:</span>{' '}
                    <span className="text-green-600 font-semibold">Inmediato</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
