'use client';

import './styles/index.scss';
import dynamic from 'next/dynamic';
import { useRef, useState, useCallback, memo } from 'react';
import { motion } from 'framer-motion';
import {
  MdMail,
  MdPhone,
  MdWhatsapp,
  MdKeyboardArrowDown,
} from 'react-icons/md';

import ParallaxSkeleton from '../layouts/parallax/ParallaxSkeleton';
// Import dynamique des composants
const Parallax = dynamic(() => import('components/layouts/parallax'), {
  loading: () => <ParallaxSkeleton />,
  ssr: true,
});

import FormContainer from './formContainer';
import { trackEvent } from '@/utils/analytics';
import PageTracker from '../analytics/PageTracker';

// Composant d'en-tête de contact mémorisé
const ContactHeader = memo(({ isCollapsed, onToggle }) => (
  <div className="collapsible-header" onClick={onToggle}>
    <h2>Coordonnées</h2>
    <MdKeyboardArrowDown
      className={`toggle-icon ${!isCollapsed ? 'open' : ''}`}
    />
  </div>
));

ContactHeader.displayName = 'ContactHeader';

// Composant d'élément de contact mémorisé
const ContactItem = memo(({ icon: Icon, text, variants }) => (
  <motion.div className="item" variants={variants}>
    <div className="icon">
      <Icon />
    </div>
    <p>{text}</p>
  </motion.div>
));

ContactItem.displayName = 'ContactItem';

// Composant des informations de contact mémorisé
const ContactInfo = memo(({ isCollapsed, variants }) => (
  <div className={`collapsible-content ${!isCollapsed ? 'open' : ''}`}>
    <div className="content-wrapper">
      {/* Titre principal - Desktop uniquement */}
      <motion.h1 variants={variants}>Coordonnées</motion.h1>

      <ContactItem icon={MdPhone} text="77.86.00.64" variants={variants} />

      <ContactItem icon={MdWhatsapp} text="77.86.00.64" variants={variants} />

      <ContactItem icon={MdMail} text="benew@gmail.com" variants={variants} />
    </div>
  </div>
));

ContactInfo.displayName = 'ContactInfo';

// Animations simplifiées
const variants = {
  initial: {
    y: 500,
    opacity: 0,
  },
  animate: {
    y: 0,
    opacity: 1,
    transition: {
      duration: 0.5,
      staggerChildren: 0.1,
    },
  },
};

// Composant principal simplifié
const Contact = () => {
  const ref = useRef();
  const [isCollapsed, setIsCollapsed] = useState(true);

  // Handler pour le toggle optimisé
  const handleToggle = useCallback(() => {
    trackEvent('contact_info_toggle', {
      event_category: 'contact',
      event_label: isCollapsed ? 'expand' : 'collapse',
      action: isCollapsed ? 'expand' : 'collapse',
    });

    setIsCollapsed((prev) => !prev);
  }, [isCollapsed]);

  return (
    <div>
      <PageTracker
        pageName="contact"
        pageType="conversion"
        sections={[
          'hero_parallax',
          'contact_form',
          'contact_info',
          'form_interactions',
        ]}
      />

      <section className="first">
        <Parallax bgColor="#0c0c1d" title="Contact" planets="/planets.png" />
      </section>

      <section className="others">
        <motion.div
          ref={ref}
          className="contact"
          variants={variants}
          initial="initial"
          whileInView="animate"
        >
          <motion.div className="textContainer" variants={variants}>
            <ContactHeader isCollapsed={isCollapsed} onToggle={handleToggle} />

            <ContactInfo isCollapsed={isCollapsed} variants={variants} />
          </motion.div>

          <FormContainer ref={ref} />
        </motion.div>
      </section>
    </div>
  );
};

export default Contact;
