import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef, useCallback, memo } from 'react';
import { CldImage } from 'next-cloudinary';
import Link from 'next/link';
import './index.scss';

// Composant d'image mémorisé
const ArticleImage = memo(({ article_image, article_title, imageRef }) => (
  <CldImage
    ref={imageRef}
    priority
    src={article_image}
    alt={`Illustration de l'article: ${article_title}`}
    width={200}
    height={130}
    className="imageContainer"
    style={{ width: '100%', height: 'auto' }}
    loading="lazy"
    quality="auto"
    format="auto"
  />
));

ArticleImage.displayName = 'ArticleImage';

// Composant de contenu texte mémorisé
const ArticleTextContent = memo(
  ({ article_title, created, article_id, y, onClick }) => (
    <motion.div className="textContainer" style={{ y }}>
      <h2>
        {article_title}
        <br />
        <em className="dateCreated">{`Publié le ${created}`}</em>
      </h2>
      <Link href={`/blog/${article_id}`} passHref>
        <button
          type="button"
          onClick={onClick}
          aria-label={`Lire l'article: ${article_title}`}
        >
          Lire
        </button>
      </Link>
    </motion.div>
  ),
);

ArticleTextContent.displayName = 'ArticleTextContent';

// Composant principal optimisé
function ArticleItem({
  article_id,
  article_title,
  article_image,
  created,
  onClick,
}) {
  const ref = useRef();

  const { scrollYProgress } = useScroll({
    target: ref,
  });

  const y = useTransform(scrollYProgress, [0, 1], [-300, 300]);

  // Handler pour le clic optimisé
  const handleClick = useCallback(() => {
    if (onClick) {
      onClick({ article_id, article_title, article_image, created });
    }
  }, [onClick, article_id, article_title, article_image, created]);

  // Gestion de l'état vide
  if (!article_id || !article_title) {
    return null;
  }

  return (
    <section className="others">
      <div className="container">
        <div className="wrapper">
          <ArticleImage
            article_image={article_image}
            article_title={article_title}
            imageRef={ref}
          />
          <ArticleTextContent
            article_title={article_title}
            created={created}
            article_id={article_id}
            y={y}
            onClick={handleClick}
          />
        </div>
      </div>
    </section>
  );
}

export default memo(ArticleItem);
