'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import { useInView, motion } from 'framer-motion';
import { MdMail, MdPhone, MdWhatsapp } from 'react-icons/md';
import Image from 'next/image';
import Parallax from '@/components/layouts/parallax';
import { sendContactEmail } from '@/actions/sendContactEmail';
import {
  useResponsiveConfig,
  useOptimizedForm,
  optimizeAnimationVariants,
  getOptimizedImageProps,
} from '@/utils/contactPerformance';
import './contact.scss';

// Variantes d'animation de base
const baseVariants = {
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

// Composant d'icône sociale optimisé
const SocialIcon = ({ src, alt, href, config }) => {
  const imageProps = getOptimizedImageProps('social', config);

  return (
    <motion.a
      href={href}
      title={alt}
      whileHover={config?.animations.reducedMotion ? {} : { scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
      transition={{ duration: 0.2 }}
    >
      <Image src={src} alt={alt} {...imageProps} className="social-icon" />
    </motion.a>
  );
};

// Composant de champ de formulaire optimisé
const FormField = ({
  type = 'text',
  name,
  placeholder,
  required,
  disabled,
  rows,
  validateField,
  fieldErrors,
  ariaLabel,
}) => {
  const handleChange = useCallback(
    (e) => {
      if (validateField) {
        validateField(name, e.target.value);
      }
    },
    [validateField, name],
  );

  const commonProps = {
    name,
    placeholder,
    required,
    disabled,
    onChange: handleChange,
    'aria-label': ariaLabel || placeholder,
    'aria-invalid': fieldErrors[name] ? 'true' : 'false',
    className: fieldErrors[name] ? 'field-error' : '',
  };

  if (type === 'textarea') {
    return <textarea {...commonProps} rows={rows} />;
  }

  return <input type={type} {...commonProps} />;
};

// Composant principal Contact optimisé
function Contact() {
  const ref = useRef();
  const formRef = useRef();
  const [error, setError] = useState(false);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  // Configuration responsive adaptative
  const config = useResponsiveConfig();

  // Formulaire optimisé avec validation
  const { validateField, fieldErrors, clearErrors } = useOptimizedForm(config);

  // Variants adaptatifs selon la configuration
  const variants = config
    ? optimizeAnimationVariants(baseVariants, config)
    : baseVariants;

  // Détection de la visibilité adaptative
  const isInView = useInView(ref, {
    margin: config?.deviceType === 'mobile' ? '-50px' : '-100px',
    once: true,
  });

  // Gestion optimisée de l'envoi du formulaire
  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();

      if (loading) return; // Éviter les soumissions multiples

      setLoading(true);
      setError(false);
      setSuccess(false);
      clearErrors();

      try {
        const formData = new FormData(formRef.current);
        const result = await sendContactEmail(formData);

        if (result.success) {
          setSuccess(true);
          formRef.current.reset();

          // Annonce pour les lecteurs d'écran
          if (config?.accessibility.announceMessages) {
            const announcement = document.createElement('div');
            announcement.setAttribute('aria-live', 'polite');
            announcement.setAttribute('aria-atomic', 'true');
            announcement.textContent = 'Message envoyé avec succès !';
            announcement.style.position = 'absolute';
            announcement.style.left = '-10000px';
            document.body.appendChild(announcement);

            setTimeout(() => {
              document.body.removeChild(announcement);
            }, 1000);
          }

          // Scroll vers le message de succès sur mobile
          if (config?.deviceType === 'mobile') {
            setTimeout(() => {
              const successElement = document.querySelector('.success-message');
              if (successElement) {
                successElement.scrollIntoView({
                  behavior: 'smooth',
                  block: 'center',
                });
              }
            }, 100);
          }
        } else {
          setError(true);
          console.error('Erreur:', result.error);
        }
      } catch (err) {
        setError(true);
        console.error("Erreur lors de l'envoi:", err);

        // Annonce d'erreur pour les lecteurs d'écran
        if (config?.accessibility.announceMessages) {
          const announcement = document.createElement('div');
          announcement.setAttribute('aria-live', 'assertive');
          announcement.setAttribute('aria-atomic', 'true');
          announcement.textContent = "Erreur lors de l'envoi du message";
          announcement.style.position = 'absolute';
          announcement.style.left = '-10000px';
          document.body.appendChild(announcement);

          setTimeout(() => {
            document.body.removeChild(announcement);
          }, 1000);
        }
      } finally {
        setLoading(false);
      }
    },
    [loading, config, clearErrors],
  );

  // Configuration des props d'images
  const phoneSvgProps = config
    ? getOptimizedImageProps('phoneSvg', config)
    : { width: 450, height: 450 };
  const textareaRows = config ? config.form.textareaRows[config.deviceType] : 8;

  // Rendu conditionnel pendant le chargement de la config
  if (!config) {
    return (
      <div>
        <section className="first">
          <Parallax bgColor="#0c0c1d" title="Contact" planets="/planets.png" />
        </section>
        <section className="others">
          <div
            className="contact"
            style={{ justifyContent: 'center', alignItems: 'center' }}
          >
            <div>Chargement...</div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div>
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
          viewport={{
            once: true,
            margin: config.deviceType === 'mobile' ? '-20%' : '-10%',
          }}
        >
          <motion.div className="textContainer" variants={variants}>
            {/* Titre conditionnel selon la taille d'écran */}
            {config.deviceType !== 'mobile' && (
              <motion.h1 variants={variants}>Coordonnées</motion.h1>
            )}

            {/* Informations de contact avec icônes responsive */}
            <motion.div className="item" variants={variants}>
              <div className="icon" aria-hidden="true">
                <MdPhone size={config.deviceType === 'mobile' ? 18 : 20} />
              </div>
              <p>
                <a href="tel:+25377860064" aria-label="Appeler le 77.86.00.64">
                  77.86.00.64
                </a>
              </p>
            </motion.div>

            <motion.div className="item" variants={variants}>
              <div className="icon" aria-hidden="true">
                <MdWhatsapp size={config.deviceType === 'mobile' ? 18 : 20} />
              </div>
              <p>
                <a
                  href="https://wa.me/25377860064"
                  aria-label="Contacter via WhatsApp"
                >
                  77.86.00.64
                </a>
              </p>
            </motion.div>

            <motion.div className="item" variants={variants}>
              <div className="icon" aria-hidden="true">
                <MdMail size={config.deviceType === 'mobile' ? 18 : 20} />
              </div>
              <p>
                <a
                  href="mailto:benew@gmail.com"
                  aria-label="Envoyer un email à benew@gmail.com"
                >
                  benew@gmail.com
                </a>
              </p>
            </motion.div>

            {/* Titre réseaux sociaux conditionnel */}
            {config.deviceType !== 'mobile' && (
              <motion.h2 variants={variants}>Comptes Sociaux</motion.h2>
            )}

            <motion.div
              className="social"
              variants={variants}
              role="list"
              aria-label="Liens vers les réseaux sociaux"
            >
              <SocialIcon
                src="/facebook.png"
                alt="Facebook"
                href="#"
                config={config}
              />
              <SocialIcon
                src="/instagram.png"
                alt="Instagram"
                href="#"
                config={config}
              />
              <SocialIcon
                src="/snapchat.png"
                alt="Snapchat"
                href="#"
                config={config}
              />
              <SocialIcon
                src="/twitter.png"
                alt="Twitter"
                href="#"
                config={config}
              />
            </motion.div>
          </motion.div>

          <div className="formContainer">
            {/* SVG du téléphone avec animation adaptative */}
            <motion.div
              className="phoneSvg"
              initial={{ opacity: 1 }}
              whileInView={{ opacity: 0 }}
              transition={{
                delay: config.deviceType === 'mobile' ? 2 : 3,
                duration: config.animations.reducedMotion ? 0.3 : 1,
              }}
              viewport={{ once: true }}
              aria-hidden="true"
            >
              <svg
                width={phoneSvgProps.width}
                height={phoneSvgProps.height}
                viewBox="0 0 32.666 32.666"
                role="img"
                aria-label="Icône de téléphone décorative"
              >
                <defs>
                  <linearGradient
                    id="phoneGradient"
                    x1="0%"
                    y1="0%"
                    x2="100%"
                    y2="100%"
                  >
                    <stop offset="0%" stopColor="#f6a037" />
                    <stop offset="50%" stopColor="#f266b0" />
                    <stop offset="100%" stopColor="#9e1f9d" />
                  </linearGradient>
                </defs>
                <motion.path
                  strokeWidth={0.2}
                  fill="none"
                  stroke="url(#phoneGradient)"
                  initial={{ pathLength: 0 }}
                  animate={
                    isInView && !config.animations.reducedMotion
                      ? { pathLength: 1 }
                      : {}
                  }
                  transition={{
                    duration: config.deviceType === 'mobile' ? 2.5 : 3,
                    ease: 'easeInOut',
                  }}
                  d="M28.189,16.504h-1.666c0-5.437-4.422-9.858-9.856-9.858l-0.001-1.664C23.021,4.979,28.189,10.149,28.189,16.504z M16.666,7.856L16.665,9.52c3.853,0,6.983,3.133,6.981,6.983l1.666-0.001C25.312,11.735,21.436,7.856,16.666,7.856z M16.333,0 C7.326,0,0,7.326,0,16.334c0,9.006,7.326,16.332,16.333,16.332c0.557,0,1.007-0.45,1.007-1.006c0-0.559-0.45-1.01-1.007-1.01 c-7.896,0-14.318-6.424-14.318-14.316c0-7.896,6.422-14.319,14.318-14.319c7.896,0,14.317,6.424,14.317,14.319 c0,3.299-1.756,6.568-4.269,7.954c-0.913,0.502-1.903,0.751-2.959,0.761c0.634-0.377,1.183-0.887,1.591-1.529 c0.08-0.121,0.186-0.228,0.238-0.359c0.328-0.789,0.357-1.684,0.555-2.518c0.243-1.064-4.658-3.143-5.084-1.814 c-0.154,0.492-0.39,2.048-0.699,2.458c-0.275,0.366-0.953,0.192-1.377-0.168c-1.117-0.952-2.364-2.351-3.458-3.457l0.002-0.001 c-0.028-0.029-0.062-0.061-0.092-0.092c-0.031-0.029-0.062-0.062-0.093-0.092v0.002c-1.106-1.096-2.506-2.34-3.457-3.459 c-0.36-0.424-0.534-1.102-0.168-1.377c0.41-0.311,1.966-0.543,2.458-0.699c1.326-0.424-0.75-5.328-1.816-5.084 c-0.832,0.195-1.727,0.227-2.516,0.553c-0.134,0.057-0.238,0.16-0.359,0.24c-2.799,1.774-3.16,6.082-0.428,9.292 c1.041,1.228,2.127,2.416,3.245,3.576l-0.006,0.004c0.031,0.031,0.063,0.06,0.095,0.09c0.03,0.031,0.059,0.062,0.088,0.095 l0.006-0.006c1.16,1.118,2.535,2.765,4.769,4.255c4.703,3.141,8.312,2.264,10.438,1.098c3.67-2.021,5.312-6.338,5.312-9.719 C32.666,7.326,25.339,0,16.333,0z"
                />
              </svg>
            </motion.div>

            {/* Formulaire avec animations adaptatives et accessibilité */}
            <motion.form
              ref={formRef}
              onSubmit={handleSubmit}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{
                delay: config.deviceType === 'mobile' ? 3 : 4,
                duration: config.animations.reducedMotion ? 0.3 : 1,
              }}
              viewport={{ once: true }}
              noValidate
              aria-label="Formulaire de contact"
            >
              <FormField
                type="text"
                name="name"
                placeholder="Nom complet"
                required
                disabled={loading}
                validateField={validateField}
                fieldErrors={fieldErrors}
                ariaLabel="Votre nom complet"
              />

              <FormField
                type="email"
                name="email"
                placeholder="Email"
                required
                disabled={loading}
                validateField={validateField}
                fieldErrors={fieldErrors}
                ariaLabel="Votre adresse email"
              />

              <FormField
                type="text"
                name="subject"
                placeholder="Sujet"
                required
                disabled={loading}
                validateField={validateField}
                fieldErrors={fieldErrors}
                ariaLabel="Sujet de votre message"
              />

              <FormField
                type="textarea"
                name="message"
                placeholder="Message"
                required
                disabled={loading}
                rows={textareaRows}
                validateField={validateField}
                fieldErrors={fieldErrors}
                ariaLabel="Votre message"
              />

              <motion.button
                type="submit"
                disabled={loading}
                whileHover={
                  config.animations.reducedMotion ? {} : { scale: 1.02 }
                }
                whileTap={{ scale: 0.98 }}
                transition={{ duration: 0.2 }}
                aria-describedby="submit-status"
              >
                {loading ? 'Envoi en cours...' : 'Envoyer'}
              </motion.button>

              {/* Messages d'état avec animations et accessibilité */}
              <div id="submit-status" aria-live="polite" aria-atomic="true">
                {error && (
                  <motion.div
                    className="error-message"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    role="alert"
                  >
                    Erreur lors de l&apos;envoi du message. Veuillez réessayer.
                  </motion.div>
                )}

                {success && (
                  <motion.div
                    className="success-message"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    role="status"
                  >
                    Message envoyé avec succès ! Nous vous répondrons bientôt.
                  </motion.div>
                )}
              </div>
            </motion.form>
          </div>
        </motion.div>
      </section>
    </div>
  );
}

export default Contact;
