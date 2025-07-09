import './app.scss';
import Navbar from '../components/layouts/navbar';

export const metadata = {
  title: 'Benew - Votre partenaire digital',
  description:
    'Templates et applications web/mobile de qualité professionnelle',
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    viewportFit: 'cover',
  },
  themeColor: '#ff6b35',
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr" className="scroll-smooth">
      <head>
        {/* Styles CSS inline pour éviter le flash */}
        <style
          dangerouslySetInnerHTML={{
            __html: `
            /* Fix immédiat pour éviter le flash */
            html, body {
              height: 100%;
              overflow-x: hidden;
            }
            
            /* Support WebKit pour mobile */
            @supports (-webkit-touch-callout: none) {
              html {
                height: -webkit-fill-available;
              }
              body {
                min-height: -webkit-fill-available;
              }
            }
          `,
          }}
        />
      </head>
      <body className="min-h-screen">
        <Navbar />
        <main className="relative">{children}</main>
      </body>
    </html>
  );
}
