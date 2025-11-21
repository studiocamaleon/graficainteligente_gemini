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
    { title: 'Casos de Uso', sectionId: 'use-cases' },
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
          ? 'bg-white/90 backdrop-blur-md border-b border-gray-200 shadow-sm'
          : 'bg-white border-b border-gray-200 md:bg-transparent md:border-b-0'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        <div className="flex items-center justify-between py-3 md:py-5">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-cyan-600 rounded-xl flex items-center justify-center shadow-lg">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900">{BRAND.name}</span>
          </Link>

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

        <div
          className={`flex-1 pb-3 md:block md:pb-0 ${
            menuOpen ? 'block' : 'hidden'
          }`}
        >
          <ul className="justify-end items-center space-y-6 md:flex md:space-x-6 md:space-y-0">
            {navigation.map((item, idx) => (
              <li key={idx}>
                <button
                  onClick={() => scrollToSection(item.sectionId)}
                  className="block w-full text-left text-gray-700 hover:text-blue-600 font-medium transition-colors"
                >
                  {item.title}
                </button>
              </li>
            ))}

            <span className="hidden w-px h-6 bg-gray-300 md:block"></span>

            <div className="space-y-3 items-center gap-x-6 md:flex md:space-y-0">
              <li>
                <Link
                  to="/login"
                  className="block py-3 text-center text-gray-700 hover:text-blue-600 font-medium border rounded-lg md:border-none transition-colors"
                >
                  Iniciar Sesión
                </Link>
              </li>
              <li>
                <Link
                  to="/register"
                  className="block py-3 px-4 font-semibold text-center text-white bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 rounded-lg shadow-lg shadow-blue-500/30 hover:shadow-blue-500/40 transition-all md:inline"
                >
                  Comenzar Gratis
                </Link>
              </li>
            </div>
          </ul>
        </div>
      </div>
    </nav>
  );
}
