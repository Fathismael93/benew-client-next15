import React from 'react';
import './products-presentation.scss';
import Parallax from '@/components/layouts/parallax';

const ProductsPresentation = () => {
  return (
    <div>
      <section className="others">
        <Parallax bgColor="#0c0c1d" title="Les produits" planets="/sun.png" />
      </section>
      <section className="others">
        <div className="contentContainer">
          <div
            className="titleBlock"
            style={{ backgroundImage: 'url(/ideation.jpg)' }}
          >
            <h1 className="title">Nos Produits</h1>
          </div>
          <div className="textBlock">
            <p className="text">
              Nos produits ont été imaginés et conçus avec le souci de répondre
              à plusieurs problèmatiques liées à l'entreprenariat. Ils sont à
              jour sur toutes les nomres internationales régissant le monde du
              web et sont adaptés au monde du commerce djiboutien. De plus, ils
              sont financièrement accessible, ce qui est très rare dans notre
              pays.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default ProductsPresentation;
