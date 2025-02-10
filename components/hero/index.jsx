'use client';

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
          <motion.h2 variants={textVariants}>
            Un nouveau moyen de gagner de l'argent
          </motion.h2>
          <motion.h1 variants={textVariants}>
            Super Boutique, Super Riche
          </motion.h1>
          <motion.div className="buttons" variants={textVariants}>
            <motion.button variants={textVariants}>Nos Produits</motion.button>
            <motion.button variants={textVariants}>Présentation</motion.button>
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
      <div className="rightSection">
        <div className="imageContainer">
          <Image
            src="/bright-bulb.png"
            alt="Ampoule brillante avec étoiles"
            width={500}
            height={500}
            className="heroImage"
            priority
          />
        </div>
      </div>
    </div>
  );
}

export default Hero;
