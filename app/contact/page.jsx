import Contact from 'components/contact';

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
  ],
  openGraph: {
    title: 'Contact Benew - Démarrez votre projet',
    description:
      'Contactez-nous pour transformer vos idées en solutions digitales.',
    url: `${process.env.NEXT_PUBLIC_SITE_URL}/contact`,
  },
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_SITE_URL}/contact`,
  },
};

function ContactPage() {
  return <Contact />;
}

export default ContactPage;
