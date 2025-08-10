import './contact-skeleton.scss';

const ContactSkeleton = ({
  showParallax = true,
  showContactInfo = true,
  contactItemsCount = 3, // Nombre d'éléments de contact (téléphone, WhatsApp, email)
  isCollapsed = true, // État initial du collapsible sur mobile
  showFormContainer = false, // Exclu par défaut comme demandé
  titleLength = 'medium', // 'short', 'medium', 'long' pour "Contact" ou autres
}) => {
  return (
    <div className="contact-skeleton-wrapper">
      {/* Section Parallax */}
      {showParallax && (
        <section className="first">
          <div className="skeleton-parallax-section">
            {/* Skeleton du titre parallax */}
            <div
              className={`skeleton-parallax-title skeleton-animate title-${titleLength}`}
            ></div>

            {/* Skeleton de l'image planète */}
            <div className="skeleton-parallax-planet skeleton-animate"></div>

            {/* Skeleton des étoiles en arrière-plan */}
            <div className="skeleton-parallax-stars"></div>
          </div>
        </section>
      )}

      {/* Section Contact principale */}
      <section className="others">
        <div className="skeleton-contact">
          {/* Text Container */}
          {showContactInfo && (
            <div className="skeleton-text-container">
              {/* Header collapsible - Mobile/Tablette uniquement */}
              <div className="skeleton-collapsible-header">
                <div className="skeleton-header-title skeleton-animate"></div>
                <div className="skeleton-toggle-icon skeleton-animate"></div>
              </div>

              {/* Contenu collapsible */}
              <div
                className={`skeleton-collapsible-content ${!isCollapsed ? 'open' : ''}`}
              >
                <div className="skeleton-content-wrapper">
                  {/* Titre principal - Desktop uniquement */}
                  <div className="skeleton-main-title skeleton-animate"></div>

                  {/* Éléments de contact */}
                  <div className="skeleton-contact-items">
                    {Array.from({ length: contactItemsCount }, (_, index) => (
                      <div key={index} className="skeleton-contact-item">
                        <div className="skeleton-contact-icon skeleton-animate"></div>
                        <div className="skeleton-contact-text skeleton-animate"></div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Form Container Placeholder - Optionnel */}
          {showFormContainer && (
            <div className="skeleton-form-container">
              <div className="skeleton-form-placeholder skeleton-animate">
                <div className="skeleton-form-title skeleton-animate"></div>
                <div className="skeleton-form-fields">
                  <div className="skeleton-form-field skeleton-animate"></div>
                  <div className="skeleton-form-field skeleton-animate"></div>
                  <div className="skeleton-form-field large skeleton-animate"></div>
                  <div className="skeleton-form-button skeleton-animate"></div>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default ContactSkeleton;
