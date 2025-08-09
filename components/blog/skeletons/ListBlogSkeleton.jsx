import './list-blog-skeleton.scss';

const ListBlogSkeleton = ({ articlesCount = 6, showProgressBar = true }) => {
  return (
    <div className="list-blog-skeleton-container">
      {/* Section parallax skeleton - réutilisée */}
      <section className="first">
        <div className="skeleton-parallax-section">
          {/* Skeleton du titre parallax (Notre Blog) */}
          <div className="skeleton-parallax-title skeleton-animate"></div>

          {/* Skeleton de l'image planète */}
          <div className="skeleton-parallax-planet skeleton-animate"></div>
        </div>
      </section>

      {/* Portfolio section skeleton */}
      <div className="skeleton-portfolio">
        {/* Barre de progression skeleton */}
        {showProgressBar && (
          <div className="skeleton-progress">
            <div className="skeleton-progress-title skeleton-animate"></div>
            <div className="skeleton-progress-bar skeleton-animate"></div>
          </div>
        )}

        {/* Grille d'articles skeleton ou état vide */}
        {articlesCount > 0 ? (
          <div className="skeleton-articles-grid">
            {Array.from({ length: articlesCount }, (_, index) => (
              <div key={index} className="skeleton-article-item">
                {/* Image de l'article skeleton */}
                <div className="skeleton-article-image skeleton-animate"></div>

                {/* Contenu de l'article skeleton */}
                <div className="skeleton-article-content">
                  {/* Titre de l'article skeleton */}
                  <div className="skeleton-article-title skeleton-animate"></div>

                  {/* Date de création skeleton */}
                  <div className="skeleton-article-date skeleton-animate"></div>

                  {/* Bouton de lecture skeleton */}
                  <div className="skeleton-article-button skeleton-animate">
                    <div className="skeleton-button-icon skeleton-animate"></div>
                    <div className="skeleton-button-text skeleton-animate"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          // État vide skeleton
          <div className="skeleton-no-content">
            <div className="skeleton-no-content-text skeleton-animate"></div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ListBlogSkeleton;
