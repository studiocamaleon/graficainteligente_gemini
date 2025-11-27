import { MessageSquare, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { usePageHeader } from '../../hooks/usePageHeader';

export function Integrations() {
  usePageHeader('Conecta con otras plataformas');

  const integrations = [
    {
      id: 'whatsapp',
      name: 'WhatsApp',
      description: 'Conecta tu WhatsApp Business para enviar mensajes automatizados a tus clientes',
      icon: MessageSquare,
      path: '/app/integrations/whatsapp',
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
      available: true,
    },
  ];

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">
          Integraciones Disponibles
        </h2>
        <p className="text-sm text-gray-600">
          Conecta tu cuenta con otras herramientas para automatizar procesos y mejorar tu flujo de trabajo
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {integrations.map((integration) => {
          const Icon = integration.icon;

          return (
            <Card key={integration.id} className="hover:shadow-lg transition-shadow">
              <div className="flex flex-col h-full">
                <div className="flex items-start gap-4 mb-4">
                  <div
                    className={`w-12 h-12 rounded-lg ${integration.bgColor} border-2 ${integration.borderColor} flex items-center justify-center flex-shrink-0`}
                  >
                    <Icon className={`w-6 h-6 ${integration.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">
                      {integration.name}
                    </h3>
                    {integration.available && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                        Disponible
                      </span>
                    )}
                  </div>
                </div>

                <p className="text-sm text-gray-600 mb-6 flex-1">
                  {integration.description}
                </p>

                {integration.available ? (
                  <Link to={integration.path} className="block">
                    <Button variant="outline" className="w-full group">
                      Configurar
                      <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </Link>
                ) : (
                  <Button variant="outline" disabled className="w-full">
                    Próximamente
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      <div className="mt-8 p-6 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="text-sm font-semibold text-blue-900 mb-2">
          ¿Necesitas otra integración?
        </h3>
        <p className="text-sm text-blue-700">
          Contáctanos para solicitar nuevas integraciones. Estamos constantemente agregando soporte para más plataformas.
        </p>
      </div>
    </div>
  );
}
