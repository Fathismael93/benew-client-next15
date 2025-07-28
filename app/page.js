import Hero from '../components/layouts/hero';
import './styles/homePage.scss';
import PageTracker from '../components/analytics/PageTracker';
import Image from 'next/image';
import { MdPalette, MdPayment, MdSecurity, MdVerified } from 'react-icons/md';

// =============================
// MÉTADONNÉES SPÉCIFIQUES PAGE D'ACCUEIL
// =============================
export const metadata = {
  title: 'Accueil - Benew | Templates et Applications Web & Mobile',
  description:
    'Découvrez Benew, votre partenaire pour des templates premium et applications web & mobile professionnelles. Solutions sur-mesure pour votre business en ligne.',
  keywords: [
    'benew',
    'accueil',
    'templates premium',
    'applications web',
    'développement mobile',
    'e-commerce',
    'Djibouti',
  ],

  openGraph: {
    title: 'Benew - Votre partenaire digital',
    description:
      'Templates premium et applications web & mobile pour propulser votre business en ligne.',
    url: process.env.NEXT_PUBLIC_SITE_URL,
    // images: [
    //   {
    //     url: '/og-home.png', // Image spécifique à l'accueil
    //     width: 1200,
    //     height: 630,
    //     alt: "Benew - Page d'accueil",
    //   },
    // ],
  },

  // Données structurées pour le SEO
  other: {
    'application-name': 'Benew',
    'theme-color': '#f6a037', // Couleur primaire de ton site
  },

  // URL canonique
  alternates: {
    canonical: process.env.NEXT_PUBLIC_SITE_URL,
  },
};

export default function Home() {
  return (
    <div className="home-container">
      {/* Tracking spécifique à la page d'accueil */}
      <PageTracker
        pageName="home"
        pageType="landing"
        sections={[
          'hero',
          'products_intro',
          'services',
          'portfolio_intro',
          'portfolio_showcase',
          'contact_teaser',
        ]}
      />
      <section className="first" data-section="hero">
        <Hero />
      </section>

      <section
        className="others products-intro-section"
        data-section="products_intro"
      >
        <div className="main-content">
          <Image
            src="/tirelire.png"
            alt="Tirelire symbolisant l'économie et les profits"
            width={256}
            height={384}
            className="profit-image"
            priority
          />

          <div className="text-container">
            <h2 className="main-title">GÉNÈRES PLUS DE PROFIT,</h2>
            <h2 className="main-title">PAIES MOINS DE CHARGES</h2>
          </div>
        </div>
      </section>

      <section className="others services-section" data-section="services">
        <div className="services-card">
          <h2 className="main-title">Notre boutique est :</h2>

          <div className="features-grid">
            <div className="feature-card">
              <MdPalette className="icon-main" />
              <div className="feature-label">Personnalisable</div>
            </div>

            <div className="feature-card">
              <MdPayment className="icon-main" />
              <div className="feature-label">
                Avec les paiements electroniques intégrés
              </div>
            </div>

            <div className="feature-card">
              <MdSecurity className="icon-main" />
              <div className="feature-label">Rapide et sécurisée</div>
            </div>

            <div className="feature-card">
              <MdVerified className="icon-main" />
              <div className="feature-label">
                Créée avec les meilleurs pratiques des standards internationaux
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="others" data-section="portfolio_intro"></section>
      <section className="others" data-section="portfolio_showcase"></section>
      <section className="others" data-section="portfolio_showcase"></section>
    </div>
  );
}
