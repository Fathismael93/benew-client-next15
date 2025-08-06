'use client';

export function HydrationFix() {
  return (
    <script
      id="hydration-fix"
      dangerouslySetInnerHTML={{
        __html: `
          (function() {
            // Liste des attributs problématiques d'extensions
            var problematicAttributes = [
              'webcrx',
              'cz-shortcut-listen', 
              'data-lt-installed',
              'data-new-gr-c-s-check-loaded',
              'data-gr-ext-installed'
            ];
            
            // Fonction pour nettoyer les attributs
            function cleanAttributes() {
              var htmlElement = document.documentElement;
              problematicAttributes.forEach(function(attr) {
                if (htmlElement.hasAttribute(attr)) {
                  htmlElement.removeAttribute(attr);
                }
              });
            }
            
            // Nettoyer immédiatement
            cleanAttributes();
            
            // Observer pour nettoyer en continu
            if (window.MutationObserver) {
              var observer = new MutationObserver(function(mutations) {
                mutations.forEach(function(mutation) {
                  if (
                    mutation.type === 'attributes' && 
                    mutation.target === document.documentElement &&
                    problematicAttributes.indexOf(mutation.attributeName) !== -1
                  ) {
                    document.documentElement.removeAttribute(mutation.attributeName);
                  }
                });
              });
              
              observer.observe(document.documentElement, {
                attributes: true,
                attributeFilter: problematicAttributes
              });
            }
          })();
        `,
      }}
    />
  );
}
