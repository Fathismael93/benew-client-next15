import './skeletonsStyles/qualities-skeleton.scss';

const QualitiesSkeleton = () => {
  return (
    <>
      {/* BLOC 1 : SKELETON TITRE */}
      <div className="services-title-block">
        <div className="skeleton-section-title skeleton-animate">
          {/* Skeleton du trait de soulignement */}
          <div className="skeleton-title-underline skeleton-animate"></div>
        </div>
      </div>

      {/* BLOC 2 : SKELETON CARTES */}
      <div className="services-cards-block">
        <div className="service-card-container">
          {/* Skeleton de la carte active */}
          <div className="skeleton-service-card active skeleton-animate">
            {/* Skeleton de l'icône */}
            <div className="skeleton-service-icon skeleton-animate"></div>

            {/* Skeleton du label (2 lignes) */}
            <div className="skeleton-service-label">
              <div className="skeleton-label-line-1 skeleton-animate"></div>
              <div className="skeleton-label-line-2 skeleton-animate"></div>
            </div>
          </div>
        </div>
      </div>

      {/* BLOC 3 : SKELETON DOTS */}
      <div className="services-dots-block">
        <div className="slider-dots">
          <div className="skeleton-dot active skeleton-animate"></div>
          <div className="skeleton-dot skeleton-animate"></div>
          <div className="skeleton-dot skeleton-animate"></div>
          <div className="skeleton-dot skeleton-animate"></div>
        </div>
      </div>
    </>
  );
};

export default QualitiesSkeleton;
