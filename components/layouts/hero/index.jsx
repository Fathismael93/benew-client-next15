'use client';

import Image from 'next/image';
import { motion } from 'framer-motion';
import './hero.scss';

const textVariants = {
  initial: {
    x: -500,
    opacity: 0,
  },
  animate: {
    x: 0,
    opacity: 1,
    transition: {
      duration: 1,
      staggerChildren: 0.1,
    },
  },
  scrollButton: {
    opacity: 0,
    y: 10,
    transition: {
      duration: 2,
      repeat: Infinity,
    },
  },
};

const sliderVariants = {
  initial: {
    x: 0,
  },
  animate: {
    x: '-30%',
    transition: {
      repeat: Infinity,
      repeatType: 'mirror',
      duration: 10,
    },
  },
};

// Variants pour l'image avec gestion du reduced motion
const imageVariants = {
  initial: {
    opacity: 0,
    scale: 0.8,
  },
  animate: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: 1.2,
      ease: 'easeOut',
    },
  },
};

function Hero() {
  return (
    <div className="hero">
      <div className="wrapper">
        <motion.div
          className="textContainer"
          variants={textVariants}
          initial="initial"
          animate="animate"
        >
          <motion.h2 variants={textVariants}>
            Un nouveau moyen de gagner de l&apos;argent
          </motion.h2>

          <motion.h1 variants={textVariants}>
            Super Boutique, Super Riche
          </motion.h1>

          <motion.div className="buttonGroup" variants={textVariants}>
            <motion.a
              href="/services"
              className="primaryButton"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 400, damping: 17 }}
            >
              <span>Découvrir nos services</span>
            </motion.a>

            <motion.a
              href="/contact"
              className="secondaryButton"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 400, damping: 17 }}
            >
              <span>Parlons de votre projet</span>
            </motion.a>
          </motion.div>

          <motion.img
            src="/scroll.png"
            alt="Défiler vers le bas"
            title="Défiler vers le bas"
            variants={textVariants}
            animate="scrollButton"
            className="scroll-indicator"
          />
        </motion.div>

        <motion.div
          className="imageContainer"
          variants={imageVariants}
          initial="initial"
          animate="animate"
        >
          <Image
            src="/hero.png"
            alt="Ordinateur avec des étoiles et du dollar - Illustration de services numériques"
            width={500}
            height={500}
            className="heroImage"
            priority
            sizes="(max-width: 640px) 75vw, (max-width: 1024px) 60vw, 45vw"
          />
        </motion.div>
      </div>

      <motion.div
        className="slidingTextContainer"
        variants={sliderVariants}
        initial="initial"
        animate="animate"
        aria-hidden="true"
      >
        BENEW
      </motion.div>
    </div>
  );
}

export default Hero;
