import { Link } from 'react-router-dom';
import { Zap } from 'lucide-react';
import { useState, useEffect } from 'react';
import { HeroSection } from '../components/landing/HeroSection';
import { FeaturesSection } from '../components/landing/FeaturesSection';
import { ModulesSection } from '../components/landing/ModulesSection';
import { UseCasesSection } from '../components/landing/UseCasesSection';
import { PricingSection } from '../components/landing/PricingSection';
import { ContactSection } from '../components/landing/ContactSection';
import { Footer } from '../components/landing/Footer';
import { WhatsAppButton } from '../components/ui/WhatsAppButton';
import { BRAND } from '../constants/branding';

export function Landing() {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-white">
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          isScrolled
            ? 'bg-white/90 backdrop-blur-md border-b border-gray-200 shadow-sm'
            : 'bg-transparent'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-cyan-600 rounded-xl flex items-center justify-center shadow-lg">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold text-gray-900">{BRAND.name}</span>
            </div>
            <div className="flex items-center gap-4">
              <Link
                to="/login"
                className="text-gray-700 hover:text-gray-900 font-medium transition-colors"
              >
                Iniciar Sesión
              </Link>
              <Link
                to="/register"
                className="px-6 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-cyan-700 transition-all shadow-lg shadow-blue-500/30 hover:shadow-blue-500/40"
              >
                Comenzar Gratis
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <main className="pt-16">
        <HeroSection />
        <FeaturesSection />
        <ModulesSection />
        <UseCasesSection />
        <PricingSection />
        <ContactSection />
        <Footer />
      </main>

      <WhatsAppButton />
    </div>
  );
}
