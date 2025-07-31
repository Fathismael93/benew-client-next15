'use client';

// import './contactHome.scss';
import Image from 'next/image';
import Link from 'next/link';

const ContactHome = () => {
  return (
    <div className="contact-main-container">
      {/* BLOC GAUCHE - TEXTE ET BOUTON */}
      <div className="contact-text-block">
        <p className="contact-text">
          Pour plus d&apos;informations, n&apos;hésitez pas à nous contacter !
          Nous serons ravis de vous en dire plus.
        </p>

        <Link href="/contact" className="contact-button">
          Contactez nous
        </Link>
      </div>

      {/* BLOC DROITE - IMAGE LOGO */}
      <div className="contact-image-block">
        <div className="contact-logo-container">
          <Image
            src="/benew_head_only_transparent_fixed.png"
            alt="BENEW"
            fill
            className="contact-logo-image"
            sizes="(max-width: 768px) 95vw, 45vw"
            priority={false}
          />
        </div>
      </div>
    </div>
  );
};

export default ContactHome;
