import './single-post-skeleton.scss';

const SinglePostSkeleton = ({
  showHeaderImage = true,
  titleLength = 'medium', // 'short', 'medium', 'long'
  contentParagraphs = 6, // Nombre de paragraphes de contenu
  showArticleMeta = true,
  showRelatedArticles = true,
  relatedArticlesCount = 3,
  showReadingTime = true,
  contentVariations = 'mixed', // 'text', 'mixed', 'rich' (avec images, blockquotes, etc.)
}) => {
  // Génération des variations de contenu
  const generateContentElements = () => {
    const elements = [];

    for (let i = 0; i < contentParagraphs; i++) {
      // Paragraphe de base
      elements.push(
        <div
          key={`p-${i}`}
          className="skeleton-paragraph skeleton-animate"
        ></div>,
      );

      // Variations selon le type de contenu
      if (contentVariations === 'mixed' || contentVariations === 'rich') {
        // Ajouter parfois un sous-titre
        if (
          i === 2 ||
          (i === Math.floor(contentParagraphs * 0.7) && contentParagraphs > 4)
        ) {
          elements.push(
            <div
              key={`h2-${i}`}
              className="skeleton-subtitle skeleton-animate"
            ></div>,
          );
        }

        // Ajouter parfois une image dans le contenu
        if (
          (i === 3 || i === Math.floor(contentParagraphs * 0.6)) &&
          contentVariations === 'rich'
        ) {
          elements.push(
            <div
              key={`img-${i}`}
              className="skeleton-content-image skeleton-animate"
            >
              <div className="skeleton-image-placeholder"></div>
            </div>,
          );
        }

        // Ajouter parfois une blockquote
        if (
          i === Math.floor(contentParagraphs / 2) &&
          contentVariations === 'rich'
        ) {
          elements.push(
            <div
              key={`quote-${i}`}
              className="skeleton-blockquote skeleton-animate"
            >
              <div className="skeleton-quote-line skeleton-animate"></div>
              <div className="skeleton-quote-line skeleton-animate short"></div>
            </div>,
          );
        }

        // Ajouter parfois une liste
        if (
          i === Math.floor(contentParagraphs * 0.8) &&
          (contentVariations === 'mixed' || contentVariations === 'rich')
        ) {
          elements.push(
            <div key={`list-${i}`} className="skeleton-list">
              {[1, 2, 3].map((j) => (
                <div
                  key={j}
                  className="skeleton-list-item skeleton-animate"
                ></div>
              ))}
            </div>,
          );
        }
      }
    }

    return elements;
  };

  return (
    <article className="single-post-skeleton">
      <div className="skeleton-post">
        {/* Article Header */}
        <div className="skeleton-article-header">
          {/* Titre principal */}
          <div
            className={`skeleton-main-title skeleton-animate title-${titleLength}`}
          ></div>

          {/* Image d'en-tête */}
          {showHeaderImage && (
            <div className="skeleton-header-image skeleton-animate">
              <div className="skeleton-image-overlay"></div>
              <div className="skeleton-image-pattern"></div>
              <div className="skeleton-image-focal-point"></div>
            </div>
          )}
        </div>

        {/* Article Content */}
        <div className="skeleton-article-content">
          {generateContentElements()}
        </div>

        {/* Article Meta */}
        {showArticleMeta && (
          <div className="skeleton-article-meta">
            {/* Date de publication */}
            <div className="skeleton-publish-date skeleton-animate"></div>

            {/* Temps de lecture */}
            {showReadingTime && (
              <div className="skeleton-reading-time skeleton-animate"></div>
            )}
          </div>
        )}

        {/* Related Articles */}
        {showRelatedArticles && (
          <div className="skeleton-related-articles">
            {/* Titre de section */}
            <div className="skeleton-related-title skeleton-animate"></div>

            {/* Grille d'articles liés */}
            <div className="skeleton-related-grid">
              {Array.from({ length: relatedArticlesCount }, (_, index) => (
                <div key={index} className="skeleton-related-card">
                  {/* Image de l'article lié */}
                  <div className="skeleton-related-image skeleton-animate">
                    <div className="skeleton-related-image-pattern"></div>
                  </div>

                  {/* Contenu de l'article lié */}
                  <div className="skeleton-related-content">
                    <div className="skeleton-related-card-title skeleton-animate"></div>
                    <div className="skeleton-related-date skeleton-animate"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </article>
  );
};

export default SinglePostSkeleton;
