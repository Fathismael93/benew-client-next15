import './skeletonsStyles/app-examples-skeleton.scss';

const AppExamplesSkeleton = () => {
  return (
    <>
      {/* VERSION DESKTOP (≥ large-xs) - STRUCTURE OVERLAY */}
      <div className="app-examples-skeleton-desktop">
        <div className="skeleton-slider-container">
          {/* Skeleton de l'image principale */}
          <div className="skeleton-slide-image skeleton-animate"></div>

          {/* Skeleton de la carte texte overlay */}
          <div className="skeleton-text-card">
            {/* Skeleton de la description (3 lignes) */}
            <div className="skeleton-description">
              <div className="skeleton-description-line-1 skeleton-animate"></div>
              <div className="skeleton-description-line-2 skeleton-animate"></div>
              <div className="skeleton-description-line-3 skeleton-animate"></div>
            </div>

            {/* Skeleton du bouton boutique */}
            <div className="skeleton-shop-button skeleton-animate"></div>
          </div>

          {/* Skeleton des flèches de navigation */}
          <div className="skeleton-nav-arrow prev skeleton-animate"></div>
          <div className="skeleton-nav-arrow next skeleton-animate"></div>
        </div>
      </div>

      {/* VERSION MOBILE/TABLETTE (< large-xs) - STRUCTURE SÉPARÉE */}
      <div className="app-examples-skeleton-mobile">
        <div className="skeleton-slider-container">
          {/* Section image - 60% de la hauteur */}
          <div className="skeleton-image-section">
            <div className="skeleton-slide-image skeleton-animate"></div>
          </div>

          {/* Section texte - 40% de la hauteur */}
          <div className="skeleton-text-section">
            {/* Skeleton de la description (2 lignes pour mobile) */}
            <div className="skeleton-description">
              <div className="skeleton-description-line-1 skeleton-animate"></div>
              <div className="skeleton-description-line-2 skeleton-animate"></div>
            </div>

            {/* Skeleton du bouton boutique */}
            <div className="skeleton-shop-button skeleton-animate"></div>
          </div>

          {/* Skeleton des flèches de navigation */}
          <div className="skeleton-nav-arrow prev skeleton-animate"></div>
          <div className="skeleton-nav-arrow next skeleton-animate"></div>
        </div>
      </div>
    </>
  );
};

export default AppExamplesSkeleton;
