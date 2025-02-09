import React from 'react';
import Link from 'next/link';
import './pourquoi.scss';
import Parallax from '@/components/parallax';

const PourquoiPage = () => {
  return (
    <div>
      <section className="others">
        <Parallax bgColor="#0c0c1d" title="Présentation" planets="/sun.png" />
      </section>
      <section className="others">
        <nav className="nav">
          <Link href="/benew" className="link">
            <div className="linkContent">
              <span className="linkText">BENEW</span>
            </div>
          </Link>

          <Link href="/products" className="link">
            <div className="linkContent">
              <span className="linkText">Nos Produits</span>
            </div>
          </Link>

          <Link href="/team" className="link">
            <div className="linkContent">
              <span className="linkText">L'Équipe Benew</span>
            </div>
          </Link>
        </nav>
      </section>
    </div>
  );
};

export default PourquoiPage;
