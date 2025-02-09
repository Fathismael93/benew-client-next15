import React from 'react';
import Link from 'next/link';
import styles from './pourquoi.module.scss';

const PourquoiPage = () => {
  return (
    <div>
      <section className="others">
        <Parallax bgColor="#0c0c1d" title="Présentation" planets="/sun.png" />
      </section>
      <section className={styles.container}>
        <nav className={styles.nav}>
          <Link href="/benew" className={styles.link}>
            <div className={styles.linkContent}>
              <span className={styles.linkText}>BENEW</span>
            </div>
          </Link>

          <Link href="/products" className={styles.link}>
            <div className={styles.linkContent}>
              <span className={styles.linkText}>Nos Produits</span>
            </div>
          </Link>

          <Link href="/team" className={styles.link}>
            <div className={styles.linkContent}>
              <span className={styles.linkText}>L'Équipe Benew</span>
            </div>
          </Link>
        </nav>
      </section>
    </div>
  );
};

export default PourquoiPage;
