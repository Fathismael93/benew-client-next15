import { motion, useScroll, useTransform } from 'framer-motion';
import React, { useRef } from 'react';
import { CldImage } from 'next-cloudinary';
import './single.scss';
import Link from 'next/link';

function ArticleItem({ article_id, article_title, article_image, created }) {
  const ref = useRef();

  const { scrollYProgress } = useScroll({
    target: ref,
  });

  const y = useTransform(scrollYProgress, [0, 1], [-300, 300]);

  return (
    <section className="others">
      <div className="container">
        <div className="wrapper">
          <CldImage
            ref={ref}
            priority
            src={article_image}
            alt="Article illustration"
            width={200}
            height={130}
            className="imageContainer"
            style={{ width: '100%', height: 'auto' }}
          />
          <motion.div className="textContainer" style={{ y }}>
            <h2>
              {article_title}
              <br />
              <em className="dateCreated">{`Publié le ${created}`}</em>
            </h2>
            <Link href={`blog/${article_id}`} passHref>
              <button type="button">Lire</button>
            </Link>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

export default ArticleItem;
