import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Zap } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { fadeInUp } from '../../animations/variants';
import { BRAND } from '../../constants/branding';

export function Login() {
  const navigate = useNavigate();
  const { signIn } = useAuth();

  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    if (!formData.email || !formData.password) {
      setErrors({ submit: 'Por favor completa todos los campos' });
      return;
    }

    setLoading(true);

    try {
      const { error } = await signIn(formData.email, formData.password);

      setLoading(false);

      if (error) {
        // Detectar si es un error de restricción de IP
        if (
          error.message.includes('ubicación') ||
          error.message.includes('IP no está autorizada') ||
          error.message.includes('Acceso denegado')
        ) {
          setErrors({ submit: error.message });
        } else if (error.message.includes('Invalid login credentials')) {
          setErrors({ submit: 'Email o contraseña incorrectos' });
        } else {
          setErrors({ submit: error.message || 'Error al iniciar sesión' });
        }
      } else {
        navigate('/app/dashboard');
      }
    } catch (error) {
      setLoading(false);
      console.error('Error en handleSubmit:', error);
      setErrors({ submit: 'Ocurrió un error inesperado. Por favor intenta de nuevo.' });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-blue-50 to-lime-50 px-4">
      <motion.div
        initial="hidden"
        animate="visible"
        variants={fadeInUp}
        className="max-w-md w-full"
      >
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Volver al inicio
        </Link>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-purple-600 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
              <Zap className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              Bienvenido a {BRAND.name}
            </h2>
            <p className="text-gray-600">
              Ingresa a tu cuenta para gestionar tu negocio
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
            />

            <Input
              label="Contraseña"
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required
            />

            {errors.submit && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 bg-red-50 border-l-4 border-red-500 rounded-lg"
              >
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <svg
                      className="h-5 w-5 text-red-500"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div className="ml-3 flex-1">
                    <p className="text-sm font-medium text-red-800">
                      {errors.submit}
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            <Button type="submit" variant="primary" className="w-full" isLoading={loading}>
              Iniciar Sesión
            </Button>
          </form>

          <div className="mt-6 text-center">
            <Link to="#" className="text-sm text-purple-600 hover:text-purple-700">
              ¿Olvidaste tu contraseña?
            </Link>
          </div>

          <p className="mt-6 text-center text-gray-600">
            ¿No tienes una cuenta?{' '}
            <Link to="/register" className="text-purple-600 hover:text-purple-700 font-semibold">
              Regístrate gratis
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
