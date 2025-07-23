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
          <motion.h2 variants={textVariants}>Crois en toi,</motion.h2>
          <motion.h1 variants={textVariants}>Commence ton histoire</motion.h1>
          <motion.div className="buttonGroup" variants={textVariants}>
            <motion.a href="/templates" className="primaryButton">
              Découvrir nos boutiques
            </motion.a>
            <motion.a href="/presentation" className="secondaryButton">
              What&apos;s Benew
            </motion.a>
          </motion.div>
          <motion.img
            src="/scroll.png"
            alt="Défiler vers le bas"
            title="Défiler vers le bas"
            variants={textVariants}
            animate="scrollButton"
          />
        </motion.div>
      </div>
      <motion.div
        className="slidingTextContainer"
        variants={sliderVariants}
        initial="initial"
        animate="animate"
      >
        BENEW
      </motion.div>
      <div className="imageContainer">
        <Image
          src="/hero.png"
          alt="Ordinateur avec des etoiles et du dollar"
          width={500}
          height={500}
          className="heroImage"
          priority
        />
      </div>
    </div>
  );
}

export default Hero;
