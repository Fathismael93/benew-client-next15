import * as yup from 'yup';

const articleIDSchema = yup.object().shape({
  id: yup.number().positive("This article id doesn't exist"),
});

export default articleIDSchema;
