import './templates-skeleton.scss';

const TemplatesSkeleton = ({ count = 6 }) => {
  return (
    <div className="templates-skeleton-container">
      {/* Section parallax skeleton */}
      <section className="first">
        <div className="skeleton-parallax-section">
          {/* Skeleton du titre parallax */}
          <div className="skeleton-parallax-title skeleton-animate"></div>

          {/* Skeleton de l'image planète */}
          <div className="skeleton-parallax-planet skeleton-animate"></div>
        </div>
      </section>

      {/* Grille de cartes skeleton */}
      <div className="templates-skeleton-grid">
        {Array.from({ length: count }, (_, index) => (
          <section key={index} className="others projectSection">
            <div className="skeleton-template-card">
              <div className="skeleton-card-inner skeleton-animate">
                {/* Skeleton conteneur image */}
                <div className="skeleton-image-container">
                  <div className="skeleton-template-image skeleton-animate"></div>
                </div>

                {/* Skeleton contenu */}
                <div className="skeleton-content">
                  {/* Skeleton catégorie avec icônes */}
                  <div className="skeleton-category">
                    <div className="skeleton-category-icons">
                      <div className="skeleton-icon skeleton-animate"></div>
                      <div className="skeleton-icon skeleton-animate"></div>
                    </div>
                    <div className="skeleton-category-text skeleton-animate"></div>
                  </div>

                  {/* Skeleton titre */}
                  <div className="skeleton-title skeleton-animate"></div>
                </div>
              </div>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
};

export default TemplatesSkeleton;
