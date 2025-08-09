import './skeletonsStyles/hero-skeleton.scss';

const HeroSkeleton = () => {
  return (
    <div className="hero-skeleton">
      <div className="wrapper">
        <div className="textContainer">
          {/* Skeleton du sous-titre */}
          <div className="skeleton-subtitle skeleton-animate"></div>

          {/* Skeleton du titre principal */}
          <div className="skeleton-title skeleton-animate"></div>

          {/* Skeleton des boutons */}
          <div className="buttonGroup">
            <div className="skeleton-button primary skeleton-animate"></div>
            <div className="skeleton-button secondary skeleton-animate"></div>
          </div>

          {/* Skeleton de l'icône scroll */}
          <div className="skeleton-scroll-icon skeleton-animate"></div>
        </div>
      </div>

      {/* Skeleton du texte animé "BENEW" */}
      <div className="skeleton-sliding-text skeleton-animate"></div>

      {/* Skeleton de l'image */}
      <div className="skeleton-image-container">
        <div className="skeleton-hero-image skeleton-animate"></div>
      </div>
    </div>
  );
};

export default HeroSkeleton;
