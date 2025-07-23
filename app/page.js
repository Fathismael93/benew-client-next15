import Parallax from '../components/layouts/parallax';
import Hero from '../components/layouts/hero';
import PageTracker from '../components/analytics/PageTracker';

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
    images: [
      {
        url: '/og-home.png', // Image spécifique à l'accueil
        width: 1200,
        height: 630,
        alt: "Benew - Page d'accueil",
      },
    ],
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
    <div>
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

      <section className="others" data-section="products_intro">
        <Parallax
          bgColor="linear-gradient(180deg, #111132, #0c0c1d)"
          title="Nos Produits..."
          planets="/sun.png"
        />
      </section>

      <section className="others" data-section="services">
        Services
      </section>

      <section className="others" data-section="portfolio_intro">
        <Parallax
          bgColor="linear-gradient(180deg, #111132, #505064)"
          title="What We Did?"
          planets="/planets.png"
        />
      </section>

      <section className="others" data-section="portfolio_showcase">
        Portfolio1
      </section>

      <section className="others" data-section="portfolio_showcase">
        Portfolio2
      </section>

      <section className="others" data-section="portfolio_showcase">
        Portfolio3
      </section>

      <section className="others" data-section="contact_teaser">
        Contact
      </section>
    </div>
  );
}
