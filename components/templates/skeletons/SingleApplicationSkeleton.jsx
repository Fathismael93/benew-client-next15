import './single-application-skeleton.scss';

const SingleApplicationSkeleton = ({ hasImages = true, sections = 'all' }) => {
  return (
    <div className="single-application-skeleton-container">
      {/* Section parallax skeleton - réutilisée */}
      <section className="first">
        <div className="skeleton-parallax-section">
          {/* Skeleton du titre parallax (nom de l'application) */}
          <div className="skeleton-parallax-title skeleton-animate"></div>

          {/* Skeleton de l'image planète */}
          <div className="skeleton-parallax-planet skeleton-animate"></div>
        </div>
      </section>

      {/* Section galerie skeleton */}
      {hasImages && (
        <section className="others gallery-section">
          <div className="skeleton-gallery-container">
            <div className="skeleton-gallery-swiper-wrapper">
              {/* Images latérales skeleton (desktop uniquement) */}
              <div className="skeleton-gallery-side-images skeleton-gallery-left">
                <div className="skeleton-gallery-side-image">
                  <div className="skeleton-side-image skeleton-animate"></div>
                </div>
              </div>

              {/* Flèche gauche skeleton */}
              <div className="skeleton-gallery-arrow skeleton-gallery-arrow-left skeleton-animate"></div>

              {/* Image principale skeleton */}
              <div className="skeleton-gallery-main-container">
                <div className="skeleton-gallery-image-wrapper">
                  <div className="skeleton-gallery-main-image skeleton-animate"></div>
                </div>

                {/* Compteur skeleton */}
                <div className="skeleton-gallery-counter skeleton-animate"></div>
              </div>

              {/* Flèche droite skeleton */}
              <div className="skeleton-gallery-arrow skeleton-gallery-arrow-right skeleton-animate"></div>

              {/* Images latérales skeleton (desktop uniquement) */}
              <div className="skeleton-gallery-side-images skeleton-gallery-right">
                <div className="skeleton-gallery-side-image">
                  <div className="skeleton-side-image skeleton-animate"></div>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Section header et informations skeleton */}
      {(sections === 'all' || sections.includes('header')) && (
        <section className="others app-header-section">
          <div className="skeleton-app-header-container">
            {/* En-tête principal skeleton */}
            <div className="skeleton-app-header">
              {/* Bloc titre skeleton */}
              <div className="skeleton-title-block">
                <div className="skeleton-app-title skeleton-animate"></div>
              </div>

              {/* Badges skeleton */}
              <div className="skeleton-app-badges">
                <div className="skeleton-badge skeleton-level-badge skeleton-animate">
                  <div className="skeleton-badge-value skeleton-animate"></div>
                </div>
                <div className="skeleton-badge skeleton-category-badge skeleton-animate">
                  <div className="skeleton-badge-value skeleton-animate"></div>
                </div>
              </div>
            </div>

            {/* Contenu principal skeleton */}
            <div className="skeleton-main-content">
              {/* Boutons toggle mobile skeleton */}
              <div className="skeleton-mobile-toggle-buttons">
                <div className="skeleton-toggle-btn skeleton-active skeleton-animate">
                  <div className="skeleton-toggle-icon skeleton-animate"></div>
                  <div className="skeleton-toggle-text skeleton-animate"></div>
                </div>
                <div className="skeleton-toggle-btn skeleton-animate">
                  <div className="skeleton-toggle-icon skeleton-animate"></div>
                  <div className="skeleton-toggle-text skeleton-animate"></div>
                </div>
              </div>

              {/* Grille de contenu skeleton */}
              <div className="skeleton-content-grid">
                {/* Section description skeleton */}
                <div className="skeleton-description-section skeleton-active">
                  <div className="skeleton-section-title skeleton-animate"></div>
                  <div className="skeleton-description-content">
                    <div className="skeleton-description-text skeleton-animate"></div>
                  </div>
                </div>

                {/* Section technique skeleton */}
                <div className="skeleton-technical-section">
                  <div className="skeleton-section-title skeleton-animate"></div>
                  <div className="skeleton-info-table-container">
                    <div className="skeleton-info-table">
                      {/* 5 lignes d'informations techniques */}
                      {Array.from({ length: 5 }, (_, index) => (
                        <div key={index} className="skeleton-info-row">
                          <div className="skeleton-info-label skeleton-animate"></div>
                          <div className="skeleton-info-value skeleton-animate"></div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Section détails (besoins + tarification) skeleton */}
      {(sections === 'all' || sections.includes('details')) && (
        <section className="others app-details-section">
          <div className="skeleton-app-details-container">
            {/* Navigation mobile pour pricing skeleton */}
            <div className="skeleton-mobile-section-nav">
              <div className="skeleton-section-btn skeleton-active skeleton-animate">
                <div className="skeleton-btn-icon skeleton-animate"></div>
                <div className="skeleton-btn-text skeleton-animate"></div>
              </div>
              <div className="skeleton-section-btn skeleton-animate">
                <div className="skeleton-btn-icon skeleton-animate"></div>
                <div className="skeleton-btn-text skeleton-animate"></div>
              </div>
            </div>

            {/* Grille d'achat skeleton */}
            <div className="skeleton-purchase-grid">
              {/* Besoins spécifiques skeleton */}
              <div className="skeleton-needs-section skeleton-active">
                <div className="skeleton-section-title skeleton-animate"></div>
                <div className="skeleton-needs-table-container">
                  <div className="skeleton-needs-table">
                    {/* 5 lignes de besoins */}
                    {Array.from({ length: 5 }, (_, index) => (
                      <div
                        key={index}
                        className={`skeleton-needs-row ${index === 4 ? 'skeleton-free-tools' : ''}`}
                      >
                        <div className="skeleton-needs-item">
                          <div className="skeleton-needs-icon skeleton-animate"></div>
                          <div className="skeleton-needs-text skeleton-animate"></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Tarification skeleton */}
              <div className="skeleton-pricing-section">
                <div className="skeleton-section-title skeleton-animate"></div>
                <div className="skeleton-pricing-table-container">
                  <div className="skeleton-pricing-table">
                    {/* 3 lignes de tarification */}
                    {Array.from({ length: 3 }, (_, index) => (
                      <div
                        key={index}
                        className={`skeleton-pricing-row ${index === 2 ? 'skeleton-total-row' : ''}`}
                      >
                        <div className="skeleton-pricing-label skeleton-animate"></div>
                        <div className="skeleton-pricing-value skeleton-animate"></div>
                      </div>
                    ))}
                  </div>
                  {/* Note de tarification */}
                  <div className="skeleton-pricing-note">
                    <div className="skeleton-note-text skeleton-animate"></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Bouton commander skeleton */}
            <div className="skeleton-order-button-container">
              <div className="skeleton-purchase-btn skeleton-animate">
                <div className="skeleton-btn-icon skeleton-animate"></div>
                <div className="skeleton-btn-text skeleton-animate"></div>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
};

export default SingleApplicationSkeleton;
