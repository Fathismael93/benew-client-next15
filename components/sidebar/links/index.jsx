import { motion } from 'framer-motion';
import {
  MdHome,
  MdList,
  MdMenuBook,
  MdPerson,
  MdPhone,
  MdQuestionMark,
} from 'react-icons/md';

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
      icon: <MdHome />,
    },
    {
      title: 'Pourquoi',
      path: 'pourquoi',
      icon: <MdQuestionMark />,
    },
    {
      title: 'Produits',
      path: 'products',
      icon: <MdList />,
    },
    {
      title: 'Blog',
      path: 'blog',
      icon: <MdMenuBook />,
    },
    {
      title: 'Présentation',
      path: 'presentation',
      icon: <MdPerson />,
    },
    {
      title: 'Contact',
      path: 'contact',
      icon: <MdPhone />,
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
            <motion.span className="icon">{item.icon}</motion.span>
            {item.title}
          </motion.a>
        </motion.div>
      ))}
    </motion.div>
  );
}

export default Links;
