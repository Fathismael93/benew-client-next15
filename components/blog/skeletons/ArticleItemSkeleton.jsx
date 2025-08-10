import './article-item-skeleton.scss';

const ArticleItemSkeleton = ({
  showImage = true,
  titleLength = 'medium', // 'short', 'medium', 'long'
  showDate = true,
  showButton = true,
  layout = 'responsive', // 'responsive', 'horizontal', 'vertical'
}) => {
  return (
    <section className="others">
      <div className="article-item-skeleton-container">
        <div
          className={`article-item-skeleton-wrapper ${layout === 'horizontal' ? 'horizontal' : layout === 'vertical' ? 'vertical' : ''}`}
        >
          {/* Image skeleton */}
          {showImage && (
            <div className="skeleton-article-image skeleton-animate">
              {/* Pattern d'overlay pour simuler une vraie image */}
              <div className="skeleton-image-overlay"></div>
              <div className="skeleton-image-pattern"></div>
            </div>
          )}

          {/* Text content skeleton */}
          <div className="skeleton-article-text">
            {/* Title skeleton avec longueurs variables */}
            <div className="skeleton-article-title-group">
              <div
                className={`skeleton-article-title skeleton-animate title-${titleLength}`}
              ></div>

              {/* Date skeleton */}
              {showDate && (
                <div className="skeleton-article-date skeleton-animate"></div>
              )}
            </div>

            {/* Button skeleton */}
            {showButton && (
              <div className="skeleton-article-button skeleton-animate">
                <div className="skeleton-button-icon skeleton-animate"></div>
                <div className="skeleton-button-text skeleton-animate"></div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default ArticleItemSkeleton;
