import PresentationComponent from 'components/presentation';

export const metadata = {
  title: 'Présentation - Benew | Notre Vision et Nos Produits',
  description:
    'Découvrez la vision de Benew, nos produits innovants et notre fondateur. Solutions technologiques modernes pour le développement de Djibouti.',
  keywords: [
    'benew présentation',
    'vision entreprise',
    'produits innovants',
    'fondateur',
    'développement Djibouti',
  ],
  openGraph: {
    title: 'Présentation Benew - Notre Vision',
    description: 'Notre manifeste, nos produits et notre fondateur.',
    url: `${process.env.NEXT_PUBLIC_SITE_URL}/presentation`,
  },
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_SITE_URL}/presentation`,
  },
};

function Presentation() {
  return <PresentationComponent />;
}

export default Presentation;
