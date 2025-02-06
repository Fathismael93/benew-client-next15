import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import './details.scss';
import DetailsModal from '../detailsModal';
import NoContent from '../noContent';

function Details() {
  const [presentations, setPresentations] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');

  useEffect(() => {
    async function getPresentations() {
      await axios
        .get('/api/presentation')
        .then((response) => setPresentations(response.data.data.rows))
        .catch((error) => console.log(error));
    }

    getPresentations();
  }, []);

  const handleIsOpen = () => {
    setText(text);
    setTitle(title);
    setIsOpen(true);
  };

  return (
    <div className="wrapper">
      {isOpen && (
        <DetailsModal setIsOpen={setIsOpen} title={title} text={text} />
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
          Dans ces cartes, nous avons inclus quelques détails concernant Benew,
          sa vision et ses raisons
          <br />
          Cliquez sur une carte pour voir son contenu.
        </motion.p>
      </motion.div>
      <motion.div
        className="cards-container-details"
        initial={{ opacity: 0, scale: 0.5 }}
        whileInView={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
      >
        {presentations?.length > 0 ? (
          presentations?.map((presentation) => (
            <motion.div
              key={presentation.presentation_id}
              className="card-details"
              onClick={() =>
                handleIsOpen(
                  presentation.presentation_text,
                  presentation.presentation_title,
                )
              }
              initial={{ opacity: 0, scale: 0.5 }}
              whileInView={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
            >
              <motion.h4
                initial={{ opacity: 0, scale: 0.5 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
              >
                {presentation.presentation_name}
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

export default Details;
