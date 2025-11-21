import { HeroSection } from '../components/landing/HeroSection';
import { FeaturesSection } from '../components/landing/FeaturesSection';
import { ModulesSection } from '../components/landing/ModulesSection';
import { UseCasesSection } from '../components/landing/UseCasesSection';
import { PricingSection } from '../components/landing/PricingSection';
import { ContactSection } from '../components/landing/ContactSection';
import { Footer } from '../components/landing/Footer';
import { Navbar } from '../components/landing/Navbar';
import { WhatsAppButton } from '../components/ui/WhatsAppButton';

export function Landing() {
  return (
    <div className="min-h-screen bg-white">
      <Navbar />

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
