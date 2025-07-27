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
        <p className="subtitle">avec la boutique en ligne,</p>

        <div className="main-content">
          <div className="text-container">
            <h2 className="main-title">GÉNÈRES PLUS DE PROFIT</h2>
            <p className="conjunction">et</p>
            <h2 className="main-title">PAIES MOINS DE CHARGES</h2>
          </div>

          <div className="image-container">
            <Image
              src="/tirelire.png" // ✅ Changé de e-commerce2 à tirelire
              alt="Tirelire symbolisant l'économie et les profits"
              width={500}
              height={400}
              className="profit-image"
              priority
            />
          </div>
        </div>
      </section>

      <section className="others services-section" data-section="services">
        <div className="services-card">
          <h2 className="main-title">Notre boutique est :</h2>

          <div className="features-grid">
            <div className="feature-card">
              <MdPalette className="icon-background" />
              <MdPalette className="icon-main" />
              <p className="feature-text">Personnalisable</p>
            </div>

            <div className="feature-card">
              <MdPayment className="icon-background" />
              <MdPayment className="icon-main" />
              <p className="feature-text">
                Avec les paiements électroniques intégrés
              </p>
            </div>

            <div className="feature-card">
              <MdSecurity className="icon-background" />
              <MdSecurity className="icon-main" />
              <p className="feature-text">Rapide et sécurisée</p>
            </div>

            <div className="feature-card">
              <MdVerified className="icon-background" />
              <MdVerified className="icon-main" />
              <p className="feature-text">
                Créée avec les meilleures pratiques des standards internationaux
              </p>
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
