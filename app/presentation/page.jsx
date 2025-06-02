import React from 'react';
import './presentation.scss';
import Parallax from '@/components/layouts/parallax';

function Presentation() {
  return (
    <div>
      <section className="others">
        <Parallax bgColor="#0c0c1d" title="Présentation" planets="/sun.png" />
      </section>
      <section className="others">
        <div
          className="planets"
          style={{
            backgroundImage: `url(/planets.png)`,
          }}
        />
        <div className="stars" />
        <div className="banner">
          <div className="slider" style={{ '--quantity': 3 }}>
            <div className="item" style={{ '--position': 1 }}>
              <h4>Présentation</h4>
              <img src="/images/the_announcer.png" alt="" />
            </div>
            <div className="item" style={{ '--position': 2 }}>
              <h4>Le produit</h4>
              <img src="/images/the_product.png" alt="" />
            </div>
            <div className="item" style={{ '--position': 3 }}>
              <h4>Fondateur</h4>
              <img src="/images/maitre_kaio.png" alt="" />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default Presentation;
