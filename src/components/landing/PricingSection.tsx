import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Check, Zap } from 'lucide-react';
import { staggerContainer, staggerItem } from '../../animations/variants';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { SubscriptionPlan } from '../../types/database';

export function PricingSection() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = async () => {
    const { data, error } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('is_active', true)
      .order('price', { ascending: true });

    if (!error && data) {
      setPlans(data);
    }
    setLoading(false);
  };

  const getPlanStyle = (slug: string) => {
    switch (slug) {
      case 'free':
        return {
          border: 'border-gray-300',
          badge: 'bg-gray-100 text-gray-800',
          button: 'bg-gray-900 hover:bg-gray-800',
        };
      case 'pro':
        return {
          border: 'border-purple-500 shadow-xl shadow-purple-500/20',
          badge: 'bg-gradient-to-r from-purple-600 to-blue-600 text-white',
          button: 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 shadow-lg shadow-purple-500/40',
        };
      case 'enterprise':
        return {
          border: 'border-lime-500 shadow-xl shadow-lime-500/20',
          badge: 'bg-gradient-to-r from-lime-500 to-green-500 text-white',
          button: 'bg-gradient-to-r from-lime-600 to-green-600 hover:from-lime-700 hover:to-green-700 shadow-lg shadow-lime-500/40',
        };
      default:
        return {
          border: 'border-gray-300',
          badge: 'bg-gray-100 text-gray-800',
          button: 'bg-gray-900 hover:bg-gray-800',
        };
    }
  };

  if (loading) {
    return (
      <section id="pricing" className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-purple-50/30 via-white to-blue-50/30">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-gray-600">Cargando planes...</p>
        </div>
      </section>
    );
  }

  return (
    <section id="pricing" className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-purple-50/30 via-white to-blue-50/30">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
            Planes{' '}
            <span className="bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              Flexibles
            </span>
            {' '}para Crecer
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Elige el plan que mejor se adapte a tu negocio y escala cuando lo necesites
          </p>
        </motion.div>

        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="grid md:grid-cols-3 gap-8"
        >
          {plans.map((plan, index) => {
            const style = getPlanStyle(plan.slug);
            const isRecommended = plan.slug === 'pro';

            return (
              <motion.div
                key={plan.id}
                variants={staggerItem}
                whileHover={{ y: -8 }}
                className="relative"
              >
                {isRecommended && (
                  <div className="absolute -top-5 left-0 right-0 flex justify-center">
                    <span className="inline-flex items-center gap-1 px-4 py-1 bg-gradient-to-r from-purple-600 to-blue-600 text-white text-sm font-bold rounded-full shadow-lg">
                      <Zap className="w-4 h-4" />
                      Más Popular
                    </span>
                  </div>
                )}

                <div
                  className={`h-full bg-white rounded-2xl border-2 ${style.border} p-8 transition-all duration-300`}
                >
                  <div className={`inline-block px-4 py-1 ${style.badge} rounded-full text-sm font-semibold mb-4`}>
                    {plan.name}
                  </div>

                  <div className="mb-6">
                    <span className="text-5xl font-bold text-gray-900">
                      ${plan.price}
                    </span>
                    <span className="text-gray-600">/mes</span>
                  </div>

                  <ul className="space-y-4 mb-8">
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-3">
                        <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                        <span className="text-gray-700">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Link to={`/register?plan=${plan.slug}`} className="block">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className={`w-full py-3 text-white font-bold rounded-xl transition-all ${style.button}`}
                    >
                      {plan.slug === 'free' ? 'Comenzar Gratis' : 'Elegir Plan'}
                    </motion.button>
                  </Link>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
