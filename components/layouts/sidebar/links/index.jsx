import { motion } from 'framer-motion';

const variants = {
  open: {
    transition: {
      staggerChildren: 0.1,
    },
  },
  closed: {
    transition: {
      staggerChildren: 0.05,
      staggerDirection: -1,
    },
  },
};

const itemVariants = {
  open: {
    y: 0,
    opacity: 1,
  },
  closed: {
    y: 50,
    opacity: 0,
  },
};

function Links() {
  const items = [
    {
      title: 'Accueil',
      path: '',
    },
    {
      title: 'Modèles',
      path: 'templates',
    },
    {
      title: 'Blog',
      path: 'blog',
    },
    {
      title: 'Présentation',
      path: 'presentation',
    },
    {
      title: 'Contact',
      path: 'contact',
    },
  ];

  return (
    <motion.div className="links" variants={variants}>
      {items.map((item) => (
        <motion.div
          key={item.title}
          className="link"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
        >
          <motion.a href={`/${item.path}`} variants={itemVariants}>
            {item.title}
          </motion.a>
        </motion.div>
      ))}
    </motion.div>
  );
}

export default Links;
