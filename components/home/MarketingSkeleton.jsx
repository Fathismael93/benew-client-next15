'use client';

import './skeletonsStyles/marketing-skeleton.scss';

const MarketingSkeleton = () => {
  return (
    <div className="marketing-skeleton">
      <div className="main-content">
        {/* Skeleton de l'image tirelire */}
        <div className="skeleton-profit-image skeleton-animate"></div>

        <div className="text-container">
          {/* Skeleton des deux titres */}
          <div className="skeleton-title-1 skeleton-animate"></div>
          <div className="skeleton-title-2 skeleton-animate"></div>

          {/* Skeleton du bouton "En savoir plus" */}
          <div className="skeleton-profit-button skeleton-animate"></div>
        </div>
      </div>
    </div>
  );
};

export default MarketingSkeleton;
