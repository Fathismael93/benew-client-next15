import './parallax-skeleton.scss';

const ParallaxSkeleton = ({ titleWidth = 'medium', showPlanet = true }) => {
  return (
    <div className="parallax-skeleton">
      {/* Skeleton titre */}
      <div
        className={`skeleton-title skeleton-title-${titleWidth} skeleton-animate`}
      ></div>

      {/* Skeleton montagnes */}
      <div className="skeleton-mountains skeleton-animate"></div>

      {/* Skeleton planète (optionnelle) */}
      {showPlanet && <div className="skeleton-planets skeleton-animate"></div>}

      {/* Skeleton étoiles */}
      <div className="skeleton-stars skeleton-animate"></div>
    </div>
  );
};

export default ParallaxSkeleton;
