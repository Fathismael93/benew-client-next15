import React, { useState } from 'react';
import { motion } from 'framer-motion';
import './reasons.scss';
import ReasonsModal from '../reasonsModal';
import NoContent from '../noContent';
import { itemsReasons } from '@/utils/data';

function Reasons() {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [reasons, setReasons] = useState();

  const handleIsOpen = () => {
    setReasons(reasons);
    setTitle(title);
    setIsOpen(true);
  };

  return (
    <div className="wrapper">
      {isOpen && (
        <ReasonsModal setIsOpen={setIsOpen} title={title} reasons={reasons} />
      )}
      <motion.div
        className="description"
        initial={{ opacity: 0, scale: 0.5 }}
        whileInView={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
      >
        <motion.p
          initial={{ opacity: 0, scale: 0.5 }}
          whileInView={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          Dans ces cartes, nous vous donnons suffisamment d&apos;arguments pour
          investir sur une boutique nouvelle génération.
        </motion.p>
      </motion.div>
      <motion.div
        className="cards-container-reasons"
        initial={{ opacity: 0, scale: 0.5 }}
        whileInView={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
      >
        {itemsReasons.length > 0 ? (
          itemsReasons.map((item) => (
            <motion.div
              key={item.id}
              className="card-reasons"
              onClick={() => handleIsOpen(item.reasons, item.title)}
              initial={{ opacity: 0, scale: 0.5 }}
              whileInView={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
            >
              <motion.h4
                initial={{ opacity: 0, scale: 0.5 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
              >
                {item.name}
              </motion.h4>
            </motion.div>
          ))
        ) : (
          <NoContent />
        )}
      </motion.div>
    </div>
  );
}

export default Reasons;
