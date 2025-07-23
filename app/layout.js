// app/layout.js
import './styles/main.scss';
import Navbar from '../components/layouts/navbar';
import { GoogleAnalytics, GoogleTagManager } from '@next/third-parties/google';
import AnalyticsInitializer from '../components/analytics/AnalyticsInitializer';
import Script from 'next/script';

// =============================
// MÉTADONNÉES GLOBALES
// =============================
export const metadata = {
  title: {
    default: 'Benew - Templates et Applications Web & Mobile',
    template: '%s | Benew',
  },
  description:
    'Découvrez nos templates premium et applications web & mobile. Solutions professionnelles pour votre business en ligne.',
  keywords: [
    'templates',
    'applications web',
    'mobile apps',
    'e-commerce',
    'Djibouti',
  ],
  authors: [{ name: 'Benew', url: 'https://benew-dj.com' }],
  creator: 'Benew',
  publisher: 'Benew',

  // OpenGraph pour réseaux sociaux
  openGraph: {
    type: 'website',
    locale: 'fr_FR',
    url: process.env.NEXT_PUBLIC_SITE_URL,
    siteName: 'Benew',
    title: 'Benew - Templates et Applications Web & Mobile',
    description:
      'Découvrez nos templates premium et applications web & mobile. Solutions professionnelles pour votre business en ligne.',
    // images: [
    //   {
    //     url: '/og-image.png', // Assure-toi d'avoir cette image
    //     width: 1200,
    //     height: 630,
    //     alt: 'Benew - Templates et Applications',
    //   },
    // ],
  },

  // Twitter Card
  twitter: {
    card: 'summary_large_image',
    title: 'Benew - Templates et Applications Web & Mobile',
    description:
      'Découvrez nos templates premium et applications web & mobile.',
    // images: ['/og-image.png'],
  },

  // Métadonnées techniques
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },

  // Vérification propriétaires (optionnel)
  // verification: {
  //   google: process.env.GOOGLE_SITE_VERIFICATION,
  //   // bing: process.env.BING_SITE_VERIFICATION,
  // },

  // Métadonnées additionnelles
  category: 'technology',
  classification: 'business',
  referrer: 'origin-when-cross-origin',

  // Liens alternatifs
  alternates: {
    canonical: process.env.NEXT_PUBLIC_SITE_URL,
    languages: {
      'fr-FR': process.env.NEXT_PUBLIC_SITE_URL,
    },
  },

  // Icônes et manifeste
  // icons: {
  //   icon: '/favicon.ico',
  //   shortcut: '/favicon-16x16.png',
  //   apple: '/apple-touch-icon.png',
  // },
  // manifest: '/site.webmanifest',
};

export default function RootLayout({ children }) {
  const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

  return (
    <html lang="fr">
      <head>
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/site.webmanifest" />
        <meta name="theme-color" content="#f6a037" />
        <meta name="application-name" content="Benew" />
        <meta name="msapplication-TileColor" content="#f6a037" />

        <Script
          id="gtm-script"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              (function(w,d,s,l,i){
                w[l]=w[l]||[];
                w[l].push({'gtm.start': new Date().getTime(),event:'gtm.js'});
                var f=d.getElementsByTagName(s)[0],
                j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';
                j.async=true;
                j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;
                f.parentNode.insertBefore(j,f);
              })(window,document,'script','dataLayer','GTM-K4F2X42H');
            `,
          }}
        />
      </head>
      <body>
        <Navbar />
        {children}

        {/* Analytics avec initialisation automatique */}
        {process.env.NODE_ENV === 'production' && gaId && (
          <>
            <GoogleTagManager gaId={gaId} />
            <AnalyticsInitializer />
          </>
        )}

        {/* Analytics en développement pour tests */}
        {process.env.NODE_ENV === 'development' && gaId && (
          <>
            <GoogleTagManager gaId={gaId} />
            <AnalyticsInitializer isDevelopment />
          </>
        )}

        {/* Partie script de GTM */}
        <Script
          id="gtm-script"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              (function(w,d,s,l,i){
                w[l]=w[l]||[];
                w[l].push({'gtm.start': new Date().getTime(),event:'gtm.js'});
                var f=d.getElementsByTagName(s)[0],
                j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';
                j.async=true;
                j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;
                f.parentNode.insertBefore(j,f);
              })(window,document,'script','dataLayer','GTM-K4F2X42H');
            `,
          }}
        />
      </body>
    </html>
  );
}
