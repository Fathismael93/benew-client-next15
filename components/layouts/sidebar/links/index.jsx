'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

// Variants d'animation pour le conteneur
const containerVariants = {
  open: {
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
  closed: {
    transition: {
      staggerChildren: 0.05,
      staggerDirection: -1,
    },
  },
};

// Variants d'animation pour chaque lien
const itemVariants = {
  open: {
    y: 0,
    opacity: 1,
    transition: {
      duration: 0.5,
      ease: [0.25, 0.46, 0.45, 0.94],
    },
  },
  closed: {
    y: 50,
    opacity: 0,
    transition: {
      duration: 0.3,
      ease: 'easeInOut',
    },
  },
};

// Configuration des liens de navigation
const navigationItems = [
  {
    title: 'Accueil',
    path: '/',
    description: "Retour à la page d'accueil",
    icon: '🏠',
  },
  {
    title: 'Modèles',
    path: '/templates',
    description: 'Découvrir nos templates',
    icon: '🎨',
  },
  {
    title: 'Blog',
    path: '/blog',
    description: 'Articles et actualités',
    icon: '📝',
  },
  {
    title: 'Présentation',
    path: '/presentation',
    description: 'À propos de nous',
    icon: '👥',
  },
  {
    title: 'Contact',
    path: '/contact',
    description: 'Nous contacter',
    icon: '📞',
  },
];

function Links({ onNavigate }) {
  const pathname = usePathname();

  const handleLinkClick = () => {
    // Callback pour fermer la sidebar
    if (onNavigate) {
      onNavigate();
    }
  };

  return (
    <motion.div className="links" variants={containerVariants}>
      {navigationItems.map((item, index) => {
        const isActive = pathname === item.path;

        return (
          <motion.div
            key={item.path}
            className={`link ${isActive ? 'active' : ''}`}
            variants={itemVariants}
            whileHover={{
              scale: 1.02,
              x: 8,
              transition: { duration: 0.2 },
            }}
            whileTap={{
              scale: 0.98,
              x: 4,
              transition: { duration: 0.1 },
            }}
            style={{ '--index': index }} // Pour les animations CSS personnalisées
          >
            <Link
              href={item.path}
              onClick={() => handleLinkClick(item.path)}
              aria-label={item.description}
              aria-current={isActive ? 'page' : undefined}
            >
              <motion.span
                className="link-content"
                initial={{ x: -10, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{
                  delay: index * 0.1 + 0.3,
                  duration: 0.4,
                }}
              >
                {/* Icône décorative (optionnelle) */}
                <span className="link-icon" aria-hidden="true">
                  {item.icon}
                </span>

                {/* Texte du lien */}
                <span className="link-text">{item.title}</span>

                {/* Indicateur d'état actif */}
                {isActive && (
                  <motion.span
                    className="active-indicator"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{
                      type: 'spring',
                      stiffness: 300,
                      damping: 20,
                    }}
                    aria-hidden="true"
                  />
                )}
              </motion.span>
            </Link>
          </motion.div>
        );
      })}

      {/* Élément décoratif en bas */}
      <motion.div
        className="sidebar-footer"
        variants={itemVariants}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8, duration: 0.5 }}
      >
        <span className="footer-text">Benew Digital</span>
        <span className="footer-version">v2.0</span>
      </motion.div>
    </motion.div>
  );
}

export default Links;
