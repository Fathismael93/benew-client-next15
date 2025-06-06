'use client';

import React, { useRef } from 'react';
import './parallax.scss';
import { motion, useScroll, useTransform } from 'framer-motion';

function Parallax({ bgColor, title, planets }) {
  const ref = useRef();

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end start'],
  });

  const yText = useTransform(scrollYProgress, [0, 1], ['0%', '500%']);
  const yBg = useTransform(scrollYProgress, [0, 1], ['0%', '100%']);

  return (
    <div
      className="parallax"
      ref={ref}
      style={{
        background: bgColor,
        /* type === "services"
              ? "linear-gradient(180deg, #111132, #0c0c1d)"
              : "linear-gradient(180deg, #111132, #505064)", */
      }}
    >
      <motion.h1 style={{ y: yText }}>
        {title /* type === "services" ? "What We Do?" : "What We Did?" */}
      </motion.h1>
      <motion.div className="mountains" />
      <motion.div
        className="planets"
        style={{
          y: yBg,
          backgroundImage: `url(${
            planets /*
              type === "services" ? "/planets.png" : "/sun.png"
            */
          })`,
        }}
      />
      <motion.div style={{ x: yBg }} className="stars" />
    </div>
  );
}

export default Parallax;
