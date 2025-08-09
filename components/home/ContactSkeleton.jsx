import './skeletonsStyles/contact-skeleton.scss';

const ContactSkeleton = () => {
  return (
    <div className="contact-skeleton-main-container">
      {/* BLOC GAUCHE - SKELETON TEXTE ET BOUTON */}
      <div className="skeleton-contact-text-block">
        {/* Skeleton du texte principal (3 lignes) */}
        <div className="skeleton-contact-text">
          <div className="skeleton-text-line-1 skeleton-animate"></div>
          <div className="skeleton-text-line-2 skeleton-animate"></div>
          <div className="skeleton-text-line-3 skeleton-animate"></div>
        </div>

        {/* Skeleton du bouton contact */}
        <div className="skeleton-contact-button skeleton-animate"></div>
      </div>

      {/* BLOC DROITE - SKELETON IMAGE LOGO */}
      <div className="skeleton-contact-image-block">
        <div className="skeleton-contact-logo-container">
          <div className="skeleton-contact-logo-image skeleton-animate"></div>
        </div>
      </div>
    </div>
  );
};

export default ContactSkeleton;
