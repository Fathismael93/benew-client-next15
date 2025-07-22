// app/layout.js
import './styles/main.scss';
import Navbar from '../components/layouts/navbar';
import { GoogleAnalytics } from '@next/third-parties/google';

export default function RootLayout({ children }) {
  const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

  return (
    <html lang="en">
      <body>
        <Navbar />
        {children}
        {/* Chargement GA4 uniquement en production */}
        {process.env.NODE_ENV === 'production' && gaId && (
          <GoogleAnalytics gaId={gaId} />
        )}
      </body>
    </html>
  );
}
