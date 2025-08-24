// =============================
// MÉTADONNÉES SPÉCIFIQUES PAGE D'ACCUEIL

import HomeComponent from 'components/home';

// =============================
export const metadata = {
  metadataBase: 'https://benew-dj.com',
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
  },

  // Données structurées pour le SEO
  other: {
    'application-name': 'Benew',
    'theme-color': '#f6a037',
  },

  // URL canonique
  alternates: {
    canonical: process.env.NEXT_PUBLIC_SITE_URL,
  },
};

export default function Home() {
  return <HomeComponent />;
}
