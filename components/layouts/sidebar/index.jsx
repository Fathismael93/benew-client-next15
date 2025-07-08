import { useState } from 'react';
import { motion } from 'framer-motion';
import Links from './links';
import './sidebar.scss';
import ToggleButton from './toggleButton';

const variants = {
  open: {
    clipPath: 'circle(1200px at 50px 50px)',
    transition: {
      type: 'spring',
      stiffness: 20,
      restDelta: 2,
    },
  },
  closed: {
    clipPath: 'circle(30px at 50px 50px)',
    transition: {
      delay: 0.5,
      type: 'spring',
      stiffness: 400,
      damping: 40,
    },
  },
};

function Sidebar() {
  const [open, setOpen] = useState(false);

  return (
    <motion.div
      className="sidebar"
      animate={open ? 'open' : 'closed'}
      data-state={open ? 'open' : 'closed'} // ✅ Pour le CSS
    >
      <motion.div className="bg" variants={variants}>
        <Links />
      </motion.div>
      <ToggleButton setOpen={setOpen} isOpen={open} />
    </motion.div>
  );
}

export default Sidebar;
