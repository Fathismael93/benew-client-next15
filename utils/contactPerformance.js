// utils/contactPerformance.js
// Configuration des performances pour la page Contact

import { useCallback, useEffect, useState } from 'react';

/**
 * Configuration responsive adaptative pour la page Contact
 */
export const contactPerformanceConfig = {
  // Breakpoints Next.js compatible
  breakpoints: {
    xs: 320,
    sm: 375,
    md: 414,
    lg: 768,
    xl: 1024,
    xxl: 1280,
  },

  // Configuration des animations selon l'appareil
  animations: {
    mobile: {
      duration: 0.4,
      stagger: 0.08,
      reducedMotion: true,
    },
    tablet: {
      duration: 0.5,
      stagger: 0.1,
      reducedMotion: false,
    },
    desktop: {
      duration: 0.6,
      stagger: 0.12,
      reducedMotion: false,
    },
  },

  // Configuration des images selon la taille d'écran
  images: {
    social: {
      mobile: { width: 24, height: 24 },
      tablet: { width: 28, height: 28 },
      desktop: { width: 32, height: 32 },
    },
    phoneSvg: {
      mobile: { width: 300, height: 300 },
      tablet: { width: 400, height: 400 },
      desktop: { width: 450, height: 450 },
    },
  },

  // Configuration du formulaire
  form: {
    textareaRows: {
      mobile: 6,
      tablet: 7,
      desktop: 8,
    },
    validation: {
      debounceTime: 300, // ms
      showErrorsInstantly: true,
    },
  },

  // Configuration de l'accessibilité
  accessibility: {
    focusVisible: true,
    announceMessages: true,
    keyboardNavigation: true,
    screenReaderOptimized: true,
  },

  // Optimisations de performance
  performance: {
    lazyLoadImages: true,
    preloadCriticalAssets: true,
    optimizeAnimations: true,
    reduceMotionForSlowDevices: true,
  },
};

/**
 * Hook pour détecter les capacités de l'appareil
 */
export const useDeviceCapabilities = () => {
  const [capabilities, setCapabilities] = useState({
    supportsWebP: false,
    supportsAVIF: false,
    prefersReducedMotion: false,
    isSlowDevice: false,
    connectionSpeed: 'unknown',
  });

  useEffect(() => {
    // Détecter le support des formats d'image modernes
    const checkImageSupport = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 1;
      canvas.height = 1;

      return {
        supportsWebP:
          canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0,
        supportsAVIF:
          canvas.toDataURL('image/avif').indexOf('data:image/avif') === 0,
      };
    };

    // Détecter les préférences de mouvement réduit
    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;

    // Détecter la vitesse de connexion
    const connection =
      navigator.connection ||
      navigator.mozConnection ||
      navigator.webkitConnection;
    const connectionSpeed = connection ? connection.effectiveType : 'unknown';

    // Détecter si l'appareil est lent (estimation basée sur les cores CPU)
    const isSlowDevice = navigator.hardwareConcurrency
      ? navigator.hardwareConcurrency <= 2
      : false;

    const imageSupport = checkImageSupport();

    setCapabilities({
      ...imageSupport,
      prefersReducedMotion,
      isSlowDevice,
      connectionSpeed,
    });
  }, []);

  return capabilities;
};

/**
 * Hook pour la configuration responsive adaptative
 */
export const useResponsiveConfig = () => {
  const [config, setConfig] = useState(null);
  const capabilities = useDeviceCapabilities();

  useEffect(() => {
    const updateConfig = () => {
      const width = window.innerWidth;
      let deviceType = 'mobile';

      if (width >= contactPerformanceConfig.breakpoints.xl) {
        deviceType = 'desktop';
      } else if (width >= contactPerformanceConfig.breakpoints.lg) {
        deviceType = 'tablet';
      }

      // Adapter la configuration selon les capacités de l'appareil
      const adaptedConfig = {
        deviceType,
        animations: {
          ...contactPerformanceConfig.animations[deviceType],
          // Réduire les animations sur les appareils lents ou si préféré
          reducedMotion:
            capabilities.prefersReducedMotion || capabilities.isSlowDevice,
        },
        images: contactPerformanceConfig.images,
        form: contactPerformanceConfig.form,
        accessibility: contactPerformanceConfig.accessibility,
        performance: {
          ...contactPerformanceConfig.performance,
          // Optimisations basées sur la connexion
          lazyLoadImages:
            capabilities.connectionSpeed === 'slow-2g' ||
            capabilities.connectionSpeed === '2g',
        },
      };

      setConfig(adaptedConfig);
    };

    updateConfig();
    window.addEventListener('resize', updateConfig);

    return () => window.removeEventListener('resize', updateConfig);
  }, [capabilities]);

  return config;
};

/**
 * Optimiseur d'animations pour les performances
 */
export const optimizeAnimationVariants = (baseVariants, config) => {
  if (!config) return baseVariants;

  return {
    ...baseVariants,
    animate: {
      ...baseVariants.animate,
      transition: {
        ...baseVariants.animate.transition,
        duration: config.animations.reducedMotion
          ? 0.1
          : config.animations.duration,
        staggerChildren: config.animations.reducedMotion
          ? 0.02
          : config.animations.stagger,
      },
    },
  };
};

/**
 * Générateur de props d'image optimisées
 */
export const getOptimizedImageProps = (imageType, config) => {
  if (!config) return {};

  const deviceType = config.deviceType;
  const imageConfig = config.images[imageType];

  if (!imageConfig) return {};

  return {
    width: imageConfig[deviceType].width,
    height: imageConfig[deviceType].height,
    priority: imageType === 'social', // Les icônes sociales sont prioritaires
    placeholder: 'blur',
    blurDataURL:
      'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=',
    sizes: `(max-width: ${config.breakpoints?.md || 414}px) ${imageConfig.mobile.width}px, (max-width: ${config.breakpoints?.lg || 768}px) ${imageConfig.tablet.width}px, ${imageConfig.desktop.width}px`,
  };
};

/**
 * Validateur de formulaire optimisé
 */
export class OptimizedFormValidator {
  constructor(config) {
    this.config = config;
    this.debounceTimers = new Map();
  }

  // Validation avec debounce pour éviter trop d'appels
  validateFieldWithDebounce(fieldName, value, callback) {
    if (this.debounceTimers.has(fieldName)) {
      clearTimeout(this.debounceTimers.get(fieldName));
    }

    const timer = setTimeout(() => {
      const isValid = this.validateField(fieldName, value);
      callback(isValid);
    }, this.config.form.validation.debounceTime);

    this.debounceTimers.set(fieldName, timer);
  }

  validateField(fieldName, value) {
    switch (fieldName) {
      case 'name':
        return value.trim().length >= 2;
      case 'email':
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
      case 'subject':
        return value.trim().length >= 3;
      case 'message':
        return value.trim().length >= 10;
      default:
        return true;
    }
  }

  // Nettoyage des timers
  cleanup() {
    this.debounceTimers.forEach((timer) => clearTimeout(timer));
    this.debounceTimers.clear();
  }
}

/**
 * Hook pour l'optimisation des performances du formulaire
 */
export const useOptimizedForm = (config) => {
  const [validator] = useState(() => new OptimizedFormValidator(config));
  const [fieldErrors, setFieldErrors] = useState({});

  const validateField = useCallback(
    (fieldName, value) => {
      if (!config?.form.validation.showErrorsInstantly) return;

      validator.validateFieldWithDebounce(fieldName, value, (isValid) => {
        setFieldErrors((prev) => ({
          ...prev,
          [fieldName]: !isValid,
        }));
      });
    },
    [validator, config],
  );

  useEffect(() => {
    return () => validator.cleanup();
  }, [validator]);

  return {
    validateField,
    fieldErrors,
    clearErrors: () => setFieldErrors({}),
  };
};

export default contactPerformanceConfig;
