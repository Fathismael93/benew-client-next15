'use client';

import { useRef } from 'react';
import { motion } from 'framer-motion';
import { MdMail, MdPhone, MdWhatsapp } from 'react-icons/md';
import Parallax from '@/components/layouts/parallax';
// import './contact.scss';
import FormContainer from './formContainer';

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

const Contact = () => {
  const ref = useRef();

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
        >
          <motion.div className="textContainer" variants={variants}>
            <motion.h1 variants={variants}>Coordonnées</motion.h1>
            <motion.div className="item" variants={variants}>
              <div className="icon">
                <MdPhone />
              </div>
              <p>77.86.00.64</p>
            </motion.div>
            <motion.div className="item" variants={variants}>
              <div className="icon">
                <MdWhatsapp />
              </div>
              <p>77.86.00.64</p>
            </motion.div>
            <motion.div className="item" variants={variants}>
              <div className="icon">
                <MdMail />
              </div>
              <p>benew@gmail.com</p>
            </motion.div>
          </motion.div>
          <FormContainer ref={ref} />
        </motion.div>
      </section>
    </div>
  );
};

export default Contact;
