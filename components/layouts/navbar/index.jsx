'use client';

import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { useEffect, useState, useCallback } from 'react';
import './navbar.scss';
import Sidebar from '../sidebar';

// Variants d'animation optimisés
const logoVariants = {
  initial: {
    opacity: 0,
    scale: 0.5,
    rotate: -10,
  },
  animate: {
    opacity: 1,
    scale: 1,
    rotate: 0,
    transition: {
      duration: 0.8,
      ease: [0.25, 0.46, 0.45, 0.94],
    },
  },
};

const socialVariants = {
  initial: {
    opacity: 0,
    x: 50,
  },
  animate: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.6,
      delay: 0.3,
      staggerChildren: 0.1,
    },
  },
};

const socialItemVariants = {
  initial: {
    opacity: 0,
    scale: 0.8,
    y: 20,
  },
  animate: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: 'easeOut',
    },
  },
};

// Configuration des réseaux sociaux
const socialLinks = [
  {
    name: 'Facebook',
    href: 'https://facebook.com/benew',
    icon: '/facebook.png',
    label: 'Suivez-nous sur Facebook',
  },
  {
    name: 'Instagram',
    href: 'https://instagram.com/benew',
    icon: '/instagram.png',
    label: 'Suivez-nous sur Instagram',
  },
  {
    name: 'Snapchat',
    href: 'https://snapchat.com/add/benew',
    icon: '/snapchat.png',
    label: 'Ajoutez-nous sur Snapchat',
  },
  {
    name: 'Twitter',
    href: 'https://twitter.com/benew',
    icon: '/twitter.png',
    label: 'Suivez-nous sur Twitter',
  },
];

function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  // Gestion du scroll optimisée avec useCallback
  const handleScroll = useCallback(() => {
    const currentScrollY = window.scrollY;

    // Navbar qui se cache/apparaît selon la direction du scroll
    if (currentScrollY > lastScrollY && currentScrollY > 100) {
      setIsVisible(false);
    } else {
      setIsVisible(true);
    }

    // Effet de glassmorphism renforcé au scroll
    setIsScrolled(currentScrollY > 50);
    setLastScrollY(currentScrollY);
  }, [lastScrollY]);

  useEffect(() => {
    let ticking = false;

    const scrollHandler = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          handleScroll();
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', scrollHandler, { passive: true });

    return () => {
      window.removeEventListener('scroll', scrollHandler);
    };
  }, [handleScroll]);

  return (
    <motion.div
      className={`navbar ${isScrolled ? 'scrolled' : ''}`}
      initial={{ y: -100 }}
      animate={{
        y: isVisible ? 0 : -100,
        transition: {
          duration: 0.3,
          ease: 'easeInOut',
        },
      }}
    >
      {/* Sidebar */}
      <Sidebar />

      <div className="wrapper">
        {/* Logo avec animation améliorée */}
        <motion.div
          variants={logoVariants}
          initial="initial"
          animate="animate"
          whileHover={{
            scale: 1.05,
            rotate: 2,
            transition: { duration: 0.2 },
          }}
          whileTap={{ scale: 0.95 }}
        >
          <Link href="/" aria-label="Retour à l'accueil - Benew">
            <Image
              priority
              src="/logo.png"
              height={48}
              width={60}
              alt="Logo Benew - Votre partenaire digital"
              className="h-10 w-auto"
              sizes="60px"
            />
          </Link>
        </motion.div>

        {/* Réseaux sociaux avec animations individuelles */}
        <motion.div
          className="social"
          variants={socialVariants}
          initial="initial"
          animate="animate"
        >
          {socialLinks.map((social) => (
            <motion.a
              key={social.name}
              href={social.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={social.label}
              variants={socialItemVariants}
              whileHover={{
                y: -4,
                scale: 1.1,
                transition: {
                  duration: 0.2,
                  ease: 'easeOut',
                },
              }}
              whileTap={{
                scale: 0.95,
                y: -2,
              }}
              whileFocus={{
                scale: 1.05,
                boxShadow: '0 0 0 3px rgba(255, 107, 53, 0.3)',
              }}
            >
              <img
                src={social.icon}
                alt={`${social.name} icon`}
                loading="lazy"
                width="18"
                height="18"
              />
            </motion.a>
          ))}
        </motion.div>
      </div>
    </motion.div>
  );
}

export default Navbar;
