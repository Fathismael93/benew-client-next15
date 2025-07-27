import Hero from '../components/layouts/hero';
import './styles/homePage.scss';
import PageTracker from '../components/analytics/PageTracker';
import Image from 'next/image';

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
              src="/images/profit-illustration.jpg" // Remplacez par votre image
              alt="Illustration génération de profit avec boutique en ligne"
              width={500}
              height={400}
              className="profit-image"
              priority
            />
          </div>
        </div>
      </section>

      <section className="others" data-section="services"></section>

      <section className="others" data-section="portfolio_intro"></section>

      <section className="others" data-section="portfolio_showcase"></section>

      <section className="others" data-section="portfolio_showcase"></section>
    </div>
  );
}
