import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Zap, Menu, X } from 'lucide-react';
import { BRAND } from '../../constants/branding';

interface NavLink {
  title: string;
  sectionId: string;
}

export function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const navigation: NavLink[] = [
    { title: 'Características', sectionId: 'features' },
    { title: 'Módulos', sectionId: 'modules' },
    { title: 'Precios', sectionId: 'pricing' },
  ];

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    setMenuOpen(false);
  };

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled || menuOpen
          ? 'bg-white/95 backdrop-blur-md border-b border-gray-200 shadow-sm'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        <div className={`flex items-center justify-between transition-all duration-300 ${
          isScrolled && !menuOpen ? 'py-2 md:py-3' : 'py-3 md:py-5'
        }`}>
          <Link to="/" className="flex items-center gap-2">
            <div className={`bg-gradient-to-br from-blue-600 to-cyan-600 rounded-xl flex items-center justify-center shadow-lg transition-all duration-300 ${
              isScrolled && !menuOpen ? 'w-8 h-8' : 'w-10 h-10'
            }`}>
              <Zap className={`text-white transition-all duration-300 ${
                isScrolled && !menuOpen ? 'w-5 h-5' : 'w-6 h-6'
              }`} />
            </div>
            <span className={`font-bold text-gray-900 transition-all duration-300 ${
              isScrolled && !menuOpen ? 'text-lg' : 'text-xl'
            }`}>{BRAND.name}</span>
          </Link>

          <ul className="hidden md:flex items-center space-x-6">
            {navigation.map((item, idx) => (
              <li key={idx}>
                <button
                  onClick={() => scrollToSection(item.sectionId)}
                  className="text-gray-700 hover:text-blue-600 font-medium transition-colors"
                >
                  {item.title}
                </button>
              </li>
            ))}

            <span className="w-px h-6 bg-gray-300"></span>

            <li>
              <Link
                to="/login"
                className="text-gray-700 hover:text-blue-600 font-medium transition-colors"
              >
                Iniciar Sesión
              </Link>
            </li>
            <li>
              <Link
                to="/register"
                className="px-6 py-2 font-semibold text-white bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 rounded-lg shadow-lg shadow-blue-500/30 hover:shadow-blue-500/40 transition-all"
              >
                Comenzar Gratis
              </Link>
            </li>
          </ul>

          <div className="md:hidden">
            <button
              className="text-gray-700 hover:text-gray-900"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
              aria-expanded={menuOpen}
            >
              {menuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="md:hidden pb-3">
            <ul className="space-y-3">
              {navigation.map((item, idx) => (
                <li key={idx}>
                  <button
                    onClick={() => scrollToSection(item.sectionId)}
                    className="block w-full text-left text-gray-700 hover:text-blue-600 font-medium transition-colors py-2"
                  >
                    {item.title}
                  </button>
                </li>
              ))}

              <li className="pt-3 border-t border-gray-200">
                <Link
                  to="/login"
                  className="block py-3 text-center text-gray-700 hover:text-blue-600 font-medium border border-gray-300 rounded-lg transition-colors"
                >
                  Iniciar Sesión
                </Link>
              </li>
              <li>
                <Link
                  to="/register"
                  className="block py-3 px-4 font-semibold text-center text-white bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 rounded-lg shadow-lg shadow-blue-500/30 hover:shadow-blue-500/40 transition-all"
                >
                  Comenzar Gratis
                </Link>
              </li>
            </ul>
          </div>
        )}
      </div>
    </nav>
  );
}
