// app/contact/page.jsx
// Server Component optimisé pour page de contact
// Next.js 15 - Page statique simple sans DB

import { Suspense } from 'react';
import Contact from '@/components/contact';

// Skeleton component simple
function ContactPageSkeleton() {
  return (
    <div className="contact-page-skeleton">
      {/* Header skeleton */}
      <div className="skeleton-header">
        <div className="skeleton-title-large"></div>
        <div className="skeleton-text"></div>
      </div>

      {/* Form skeleton */}
      <div className="skeleton-form">
        <div className="skeleton-form-group">
          <div className="skeleton-label"></div>
          <div className="skeleton-input"></div>
        </div>
        <div className="skeleton-form-group">
          <div className="skeleton-label"></div>
          <div className="skeleton-input"></div>
        </div>
        <div className="skeleton-form-group">
          <div className="skeleton-label"></div>
          <div className="skeleton-textarea"></div>
        </div>
        <div className="skeleton-button"></div>
      </div>

      {/* Contact info skeleton */}
      <div className="skeleton-contact-info">
        <div className="skeleton-title"></div>
        <div className="skeleton-contact-item"></div>
        <div className="skeleton-contact-item"></div>
        <div className="skeleton-contact-item"></div>
      </div>
    </div>
  );
}

// Composant principal épuré
export default function ContactPage() {
  return (
    <Suspense fallback={<ContactPageSkeleton />}>
      <Contact />
    </Suspense>
  );
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
