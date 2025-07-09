'use client';

import { useRef, useEffect, useState } from 'react';
import {
  motion,
  useScroll,
  useTransform,
  useReducedMotion,
} from 'framer-motion';
import './parallax.scss';

// Configuration des variants selon le type
const parallaxConfig = {
  services: {
    textGradient:
      'linear-gradient(135deg, #f8f9fa 0%, #ff6b35 25%, #e91e63 50%, #ff6b35 75%, #f8f9fa 100%)',
    planetFilter:
      'drop-shadow(0 0 25px rgba(255, 107, 53, 0.4)) drop-shadow(0 0 50px rgba(255, 107, 53, 0.2))',
  },
  portfolio: {
    textGradient:
      'linear-gradient(135deg, #f8f9fa 0%, #673ab7 25%, #e91e63 50%, #673ab7 75%, #f8f9fa 100%)',
    planetFilter:
      'drop-shadow(0 0 25px rgba(103, 58, 183, 0.4)) drop-shadow(0 0 50px rgba(233, 30, 99, 0.3))',
  },
};

// Utilitaire pour détecter les performances de l'appareil
const getDevicePerformance = () => {
  // Simple heuristique basée sur les propriétés disponibles
  const isMobile =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent,
    );
  const hasLowMemory = navigator.deviceMemory && navigator.deviceMemory < 4;
  const hasSlowConnection =
    navigator.connection &&
    navigator.connection.effectiveType &&
    ['slow-2g', '2g', '3g'].includes(navigator.connection.effectiveType);

  return {
    isLowPerformance: isMobile || hasLowMemory || hasSlowConnection,
    reduceAnimations: hasLowMemory || hasSlowConnection,
  };
};

function Parallax({
  bgColor,
  title,
  planets,
  type = 'services',
  className = '',
  variant = 'default',
}) {
  const ref = useRef();
  const shouldReduceMotion = useReducedMotion();
  const [devicePerformance, setDevicePerformance] = useState({
    isLowPerformance: false,
    reduceAnimations: false,
  });

  // Détecter les performances de l'appareil
  useEffect(() => {
    setDevicePerformance(getDevicePerformance());
  }, []);

  // Configuration du scroll avec options conditionnelles
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end start'],
  });

  // Transformations adaptatives selon les performances
  const yText = useTransform(
    scrollYProgress,
    [0, 1],
    shouldReduceMotion || devicePerformance.reduceAnimations
      ? ['0%', '200%']
      : ['0%', '500%'],
  );

  const yBg = useTransform(
    scrollYProgress,
    [0, 1],
    shouldReduceMotion || devicePerformance.reduceAnimations
      ? ['0%', '50%']
      : ['0%', '100%'],
  );

  const xStars = useTransform(
    scrollYProgress,
    [0, 1],
    shouldReduceMotion || devicePerformance.reduceAnimations
      ? ['0%', '25%']
      : ['0%', '100%'],
  );

  // Rotation conditionnelle des planètes
  const planetsRotation = useTransform(
    scrollYProgress,
    [0, 1],
    shouldReduceMotion || devicePerformance.reduceAnimations ? [0, 5] : [0, 15],
  );

  // Configuration selon le type
  const config = parallaxConfig[type] || parallaxConfig.services;

  // Classes CSS conditionnelles
  const parallaxClasses = [
    'parallax',
    className,
    variant !== 'default' && variant,
    devicePerformance.isLowPerformance && 'low-performance',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={parallaxClasses}
      ref={ref}
      data-type={type}
      style={{
        background: bgColor,
      }}
      role="img"
      aria-label={`Section parallax: ${title}`}
    >
      {/* Titre principal avec animation conditionnelle */}
      <motion.h1
        style={{
          y: yText,
          background: config.textGradient,
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}
        initial={{ opacity: 0, scale: 0.8 }}
        whileInView={{
          opacity: 1,
          scale: 1,
          transition: {
            duration: shouldReduceMotion ? 0.3 : 0.8,
            ease: 'easeOut',
          },
        }}
        viewport={{ once: true, margin: '-100px' }}
      >
        {title}
      </motion.h1>

      {/* Montagnes avec animation conditionnelle */}
      <motion.div
        className="mountains"
        initial={{ opacity: 0 }}
        whileInView={{
          opacity: 0.9,
          transition: {
            duration: shouldReduceMotion ? 0.3 : 1.2,
            delay: shouldReduceMotion ? 0 : 0.2,
          },
        }}
        viewport={{ once: true }}
      />

      {/* Planètes avec transformations adaptatives */}
      <motion.div
        className="planets"
        style={{
          y: yBg,
          rotate: shouldReduceMotion ? 0 : planetsRotation,
          backgroundImage: `url(${planets})`,
          filter: config.planetFilter,
        }}
        initial={{ opacity: 0, scale: 0.8 }}
        whileInView={{
          opacity: 1,
          scale: 1,
          transition: {
            duration: shouldReduceMotion ? 0.3 : 1,
            delay: shouldReduceMotion ? 0 : 0.4,
          },
        }}
        viewport={{ once: true }}
      />

      {/* Étoiles avec animation conditionnelle */}
      <motion.div
        style={{
          x: shouldReduceMotion ? 0 : xStars,
        }}
        className="stars"
        initial={{ opacity: 0 }}
        whileInView={{
          opacity: devicePerformance.isLowPerformance ? 0.6 : 0.8,
          transition: {
            duration: shouldReduceMotion ? 0.3 : 1.5,
            delay: shouldReduceMotion ? 0 : 0.6,
          },
        }}
        viewport={{ once: true }}
      />

      {/* Overlay de performance pour les appareils lents */}
      {devicePerformance.isLowPerformance && (
        <div
          className="performance-overlay"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(10, 10, 18, 0.1)',
            zIndex: 10,
            pointerEvents: 'none',
          }}
        />
      )}
    </div>
  );
}

export default Parallax;
