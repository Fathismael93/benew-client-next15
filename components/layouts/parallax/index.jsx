'use client';

import { useRef, useEffect, useState } from 'react';
import './parallax.scss';
import { motion, useScroll, useTransform } from 'framer-motion';

function Parallax({ bgColor, title, planets }) {
  const ref = useRef();
  const [backgroundStyle, setBackgroundStyle] = useState({});
  const [planetsStyle, setPlanetsStyle] = useState({});

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end start'],
  });

  const yText = useTransform(scrollYProgress, [0, 1], ['0%', '500%']);
  const yBg = useTransform(scrollYProgress, [0, 1], ['0%', '100%']);

  // Mise à jour du style de background via useEffect
  useEffect(() => {
    setBackgroundStyle({
      background: bgColor,
    });
  }, [bgColor]);

  // Mise à jour du style des planets via useEffect
  useEffect(() => {
    if (planets) {
      setPlanetsStyle({
        backgroundImage: `url(${planets})`,
      });
    }
  }, [planets]);

  return (
    <div className="parallax" ref={ref} style={backgroundStyle}>
      <motion.h1 style={{ y: yText }}>{title}</motion.h1>
      <motion.div className="mountains" />
      <motion.div
        className="planets"
        style={{
          y: yBg,
          ...planetsStyle,
        }}
      />
      <motion.div style={{ x: yBg }} className="stars" />
    </div>
  );
}

export default Parallax;
