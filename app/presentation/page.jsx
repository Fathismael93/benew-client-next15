import React from 'react';
// import { motion, useScroll, useTransform } from 'framer-motion';
import './presentation.scss';
import Parallax from '@/components/layouts/parallax';

function Presentation() {
  // const ref = useRef();

  // const { scrollYProgress } = useScroll({
  //   target: ref,
  //   offset: ['start start', 'end start'],
  // });

  // const yBg = useTransform(scrollYProgress, [0, 1], ['0%', '100%']);

  return (
    <div>
      <section className="others">
        <Parallax bgColor="#0c0c1d" title="Présentation" planets="/sun.png" />
      </section>
      <section className="others">
        {/* <div
          className="planets"
          style={{
            // y: yBg,
            backgroundImage: `url(/planets.png)`,
          }}
        /> */}
        <div /*style={{ x: yBg }}*/ className="stars" />
        <div className="banner">
          <div className="slider" style={{ '--quantity': 10 }}>
            <div className="item" style={{ '--position': 1 }}>
              <img src="/images/dragon_1.jpg" alt="" />
            </div>
            <div className="item" style={{ '--position': 2 }}>
              <img src="/images/dragon_2.jpg" alt="" />
            </div>
            <div className="item" style={{ '--position': 3 }}>
              <img src="/images/dragon_3.jpg" alt="" />
            </div>
            <div className="item" style={{ '--position': 4 }}>
              <img src="/images/dragon_4.jpg" alt="" />
            </div>
            <div className="item" style={{ '--position': 5 }}>
              <img src="/images/dragon_5.jpg" alt="" />
            </div>
            <div className="item" style={{ '--position': 6 }}>
              <img src="/images/dragon_6.jpg" alt="" />
            </div>
            <div className="item" style={{ '--position': 7 }}>
              <img src="/images/dragon_7.jpg" alt="" />
            </div>
            <div className="item" style={{ '--position': 8 }}>
              <img src="/images/dragon_8.jpg" alt="" />
            </div>
            <div className="item" style={{ '--position': 9 }}>
              <img src="/images/dragon_9.jpg" alt="" />
            </div>
            <div className="item" style={{ '--position': 10 }}>
              <img src="/images/dragon_10.jpg" alt="" />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default Presentation;
