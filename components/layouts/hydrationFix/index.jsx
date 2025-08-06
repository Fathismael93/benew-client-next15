'use client';

import { useEffect } from 'react';

export function HydrationFix() {
  useEffect(() => {
    // Nettoyer les attributs ajoutés par les extensions de navigateur
    if (typeof window !== 'undefined') {
      const htmlElement = document.documentElement;

      // Liste des attributs problématiques connus
      const problematicAttributes = [
        'webcrx',
        'cz-shortcut-listen',
        'data-lt-installed',
        'data-new-gr-c-s-check-loaded',
        'data-gr-ext-installed',
      ];

      // Supprimer les attributs existants
      problematicAttributes.forEach((attr) => {
        if (htmlElement.hasAttribute(attr)) {
          htmlElement.removeAttribute(attr);
        }
      });

      // Observer pour les attributs ajoutés dynamiquement
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (
            mutation.type === 'attributes' &&
            mutation.target === htmlElement &&
            problematicAttributes.includes(mutation.attributeName || '')
          ) {
            htmlElement.removeAttribute(mutation.attributeName || '');
          }
        });
      });

      // Observer les changements d'attributs sur <html>
      observer.observe(htmlElement, {
        attributes: true,
        attributeFilter: problematicAttributes,
      });

      // Cleanup
      return () => observer.disconnect();
    }
  }, []);

  return null; // Ce composant ne rend rien visuellement
}
