import './app.scss';
import Navbar from '../components/layouts/navbar';

export const metadata = {
  title: 'Benew - Votre partenaire digital',
  description:
    'Templates et applications web/mobile de qualité professionnelle',
  viewport: {
    width: 'device-width',
    initialScale: 1,
    // 🚀 NOUVEAU: Fix pour les hauteurs viewport sur mobile
    maximumScale: 1,
    userScalable: false,
    // Gestion spéciale des hauteurs viewport
    viewportFit: 'cover',
  },
  themeColor: '#ff6b35',
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr" className="scroll-smooth">
      <head>
        {/* 🚀 NOUVEAU: Script pour corriger les problèmes de hauteur viewport sur mobile */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Fix pour 100vh sur mobile - doit être exécuté immédiatement
              (function() {
                function setVH() {
                  // Calculer la vraie hauteur du viewport
                  const vh = window.innerHeight * 0.01;
                  document.documentElement.style.setProperty('--vh-actual', vh + 'px');
                  
                  // Détecter le type d'écran pour les variables CSS
                  const height = window.innerHeight;
                  const width = window.innerWidth;
                  const aspectRatio = width / height;
                  
                  // Classes pour le debug et les styles conditionnels
                  document.documentElement.classList.remove(
                    'very-short-screen', 'short-screen', 'medium-screen', 
                    'tall-screen', 'very-tall-screen', 'mobile-landscape'
                  );
                  
                  if (height <= 480) {
                    document.documentElement.classList.add('very-short-screen');
                  } else if (height <= 600) {
                    document.documentElement.classList.add('short-screen');
                  } else if (height <= 800) {
                    document.documentElement.classList.add('medium-screen');
                  } else if (height <= 1000) {
                    document.documentElement.classList.add('tall-screen');
                  } else {
                    document.documentElement.classList.add('very-tall-screen');
                  }
                  
                  // Détecter mobile landscape (problématique)
                  if (height <= 500 && width > height && width <= 900) {
                    document.documentElement.classList.add('mobile-landscape');
                  }
                  
                  // Variables CSS dynamiques selon la hauteur
                  if (height <= 480) {
                    document.documentElement.style.setProperty('--vh-full', 'clamp(400px, 100vh, 600px)');
                    document.documentElement.style.setProperty('--vh-large', 'clamp(350px, 90vh, 500px)');
                    document.documentElement.style.setProperty('--vh-medium', 'clamp(300px, 80vh, 450px)');
                    document.documentElement.style.setProperty('--vh-small', 'clamp(250px, 70vh, 400px)');
                  } else if (height <= 600) {
                    document.documentElement.style.setProperty('--vh-full', 'clamp(500px, 100vh, 700px)');
                    document.documentElement.style.setProperty('--vh-large', 'clamp(450px, 90vh, 650px)');
                    document.documentElement.style.setProperty('--vh-medium', 'clamp(400px, 80vh, 600px)');
                    document.documentElement.style.setProperty('--vh-small', 'clamp(350px, 70vh, 550px)');
                  } else if (height >= 1000) {
                    document.documentElement.style.setProperty('--vh-full', 'clamp(800px, 100vh, 1400px)');
                    document.documentElement.style.setProperty('--vh-large', 'clamp(700px, 90vh, 1200px)');
                    document.documentElement.style.setProperty('--vh-medium', 'clamp(600px, 80vh, 1000px)');
                    document.documentElement.style.setProperty('--vh-small', 'clamp(500px, 70vh, 800px)');
                  } else {
                    // Valeurs par défaut pour écrans moyens
                    document.documentElement.style.setProperty('--vh-full', 'clamp(600px, 100vh, 1200px)');
                    document.documentElement.style.setProperty('--vh-large', 'clamp(500px, 90vh, 1000px)');
                    document.documentElement.style.setProperty('--vh-medium', 'clamp(500px, 80vh, 800px)');
                    document.documentElement.style.setProperty('--vh-small', 'clamp(400px, 70vh, 600px)');
                  }
                }
                
                // Exécuter immédiatement
                setVH();
                
                // Réexécuter lors du redimensionnement avec debounce
                let resizeTimer;
                window.addEventListener('resize', function() {
                  clearTimeout(resizeTimer);
                  resizeTimer = setTimeout(setVH, 100);
                });
                
                // Réexécuter lors du changement d'orientation
                window.addEventListener('orientationchange', function() {
                  setTimeout(setVH, 300); // Délai pour laisser le navigateur s'adapter
                });
                
                // Support pour iOS Safari viewport changes
                window.addEventListener('scroll', function() {
                  if (window.pageYOffset === 0) {
                    setVH();
                  }
                }, { passive: true });
                
              })();
            `,
          }}
        />

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
            
            /* Variables CSS par défaut (overridées par le script) */
            :root {
              --vh-actual: 1vh;
              --vh-full: clamp(600px, 100vh, 1200px);
              --vh-large: clamp(500px, 90vh, 1000px);
              --vh-medium: clamp(500px, 80vh, 800px);
              --vh-small: clamp(400px, 70vh, 600px);
            }
          `,
          }}
        />
      </head>
      <body className="min-h-screen">
        <Navbar />
        <main className="relative">{children}</main>

        {/* 🚀 Script de monitoring des hauteurs en développement */}
        {process.env.NODE_ENV === 'development' && (
          <script
            dangerouslySetInnerHTML={{
              __html: `
                // Monitoring des hauteurs en mode développement
                if (window.location.search.includes('debug-height')) {
                  const debugPanel = document.createElement('div');
                  debugPanel.style.cssText = \`
                    position: fixed;
                    top: 10px;
                    left: 10px;
                    background: rgba(0,0,0,0.8);
                    color: white;
                    padding: 10px;
                    border-radius: 5px;
                    font-family: monospace;
                    font-size: 12px;
                    z-index: 10000;
                    max-width: 200px;
                  \`;
                  
                  function updateDebug() {
                    debugPanel.innerHTML = \`
                      <div><strong>Viewport Debug</strong></div>
                      <div>W: \${window.innerWidth}px</div>
                      <div>H: \${window.innerHeight}px</div>
                      <div>Ratio: \${(window.innerWidth/window.innerHeight).toFixed(2)}</div>
                      <div>VH: \${getComputedStyle(document.documentElement).getPropertyValue('--vh-actual')}</div>
                      <div>Type: \${
                        window.innerHeight <= 480 ? 'Very Short' :
                        window.innerHeight <= 600 ? 'Short' :
                        window.innerHeight <= 800 ? 'Medium' :
                        window.innerHeight <= 1000 ? 'Tall' : 'Very Tall'
                      }</div>
                    \`;
                  }
                  
                  document.body.appendChild(debugPanel);
                  updateDebug();
                  
                  window.addEventListener('resize', updateDebug);
                  window.addEventListener('orientationchange', () => setTimeout(updateDebug, 300));
                }
              `,
            }}
          />
        )}
      </body>
    </html>
  );
}
