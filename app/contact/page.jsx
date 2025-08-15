// app/contact/page.jsx
// Server Component optimisé pour page de contact
// Next.js 15 - Page statique simple sans DB

// import { Suspense } from 'react';
import Contact from '@/components/contact';
// import ContactSkeleton from '@/components/contact/skeletons/ContactSkeleton';

// Composant principal épuré
export default function ContactPage() {
  // return (
  //   <Suspense fallback={<ContactSkeleton />}>
  //     <Contact />
  //   </Suspense>
  // );

  return <Contact />;
}

// Metadata pour SEO
export const metadata = {
  title: 'Contact - Benew | Contactez-nous pour vos projets',
  description:
    'Contactez Benew pour vos projets de templates et applications web & mobile. Nous vous accompagnons dans vos besoins digitaux à Djibouti.',
  keywords: [
    'contact benew',
    'devis template',
    'développement web djibouti',
    'contact développeur',
    'projet digital',
    'Djibouti',
  ],
  robots: { index: true, follow: true },
  openGraph: {
    title: 'Contact Benew - Démarrez votre projet',
    description:
      'Contactez-nous pour transformer vos idées en solutions digitales.',
    url: `${process.env.NEXT_PUBLIC_SITE_URL}/contact`,
    type: 'website',
    locale: 'fr_FR',
  },
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_SITE_URL}/contact`,
  },
};

// Configuration Next.js 15 pour page statique
export const dynamic = 'force-static';

// Pas de revalidation nécessaire pour une page de contact
export const revalidate = false;
