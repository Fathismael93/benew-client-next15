import './single-template-skeleton.scss';

const SingleTemplateSkeleton = ({ count = 4 }) => {
  return (
    <div className="single-template-skeleton-container">
      {/* Section parallax skeleton */}
      <section className="first">
        <div className="skeleton-parallax-section">
          {/* Skeleton du titre parallax (nom du template) */}
          <div className="skeleton-parallax-title skeleton-animate"></div>

          {/* Skeleton de l'image planète */}
          <div className="skeleton-parallax-planet skeleton-animate"></div>
        </div>
      </section>

      {/* Liste des applications skeleton */}
      <div className="applications-skeleton-list">
        {Array.from({ length: count }, (_, index) => (
          <section key={index} className="others projectSection">
            <div className="skeleton-application-card">
              {/* Skeleton image de l'application */}
              <div className="skeleton-card-image">
                <div className="skeleton-app-image skeleton-animate"></div>
              </div>

              {/* Skeleton contenu de la carte */}
              <div className="skeleton-card-content">
                {/* Skeleton titre de l'application */}
                <div className="skeleton-app-title skeleton-animate"></div>

                {/* Skeleton méta informations (level • category) */}
                <div className="skeleton-app-meta">
                  <div className="skeleton-level skeleton-animate"></div>
                  <div className="skeleton-separator skeleton-animate"></div>
                  <div className="skeleton-category skeleton-animate"></div>
                </div>

                {/* Skeleton section prix */}
                <div className="skeleton-price-section">
                  {/* Skeleton frais d'acquisition */}
                  <div className="skeleton-price-item">
                    <div className="skeleton-price-label skeleton-animate"></div>
                    <div className="skeleton-price skeleton-animate"></div>
                  </div>

                  {/* Skeleton frais de gestion */}
                  <div className="skeleton-price-item">
                    <div className="skeleton-rent-label skeleton-animate"></div>
                    <div className="skeleton-rent-price skeleton-animate"></div>
                  </div>
                </div>

                {/* Skeleton boutons d'action */}
                <div className="skeleton-action-buttons">
                  <div className="skeleton-btn skeleton-btn-cart skeleton-animate">
                    <div className="skeleton-btn-icon skeleton-animate"></div>
                    <div className="skeleton-btn-text skeleton-animate"></div>
                  </div>
                  <div className="skeleton-btn skeleton-btn-preview skeleton-animate">
                    <div className="skeleton-btn-icon skeleton-animate"></div>
                    <div className="skeleton-btn-text skeleton-animate"></div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
};

export default SingleTemplateSkeleton;
