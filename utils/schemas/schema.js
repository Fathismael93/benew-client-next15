import * as yup from 'yup';

/**
 * Schema de validation pour l'ID d'un article (UUID)
 */
export const articleIdSchema = yup.object().shape({
  id: yup
    .string()
    .required('Article ID is required')
    .matches(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      'Invalid article ID format (must be a valid UUID)',
    )
    .test('is-valid-uuid', 'Article ID must be a valid UUID', (value) => {
      if (!value) return false;

      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

      if (!uuidRegex.test(value)) {
        return false;
      }

      const emptyUUIDs = [
        '00000000-0000-0000-0000-000000000000',
        'ffffffff-ffff-ffff-ffff-ffffffffffff',
      ];

      return !emptyUUIDs.includes(value.toLowerCase());
    })
    .transform((value) => value?.toLowerCase().trim()),
});

/**
 * Schema de validation pour l'ID d'un template (pour les opérations CRUD)
 * Valide les UUID générés par PostgreSQL
 */
export const templateIdSchema = yup.object().shape({
  id: yup
    .string()
    .required('Template ID is required')
    .matches(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      'Invalid template ID format (must be a valid UUID)',
    )
    .test('is-valid-uuid', 'Template ID must be a valid UUID', (value) => {
      if (!value) return false;

      // Vérifier le format UUID plus strictement
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

      if (!uuidRegex.test(value)) {
        return false;
      }

      // Vérifier que ce n'est pas un UUID vide ou par défaut
      const emptyUUIDs = [
        '00000000-0000-0000-0000-000000000000',
        'ffffffff-ffff-ffff-ffff-ffffffffffff',
      ];

      return !emptyUUIDs.includes(value.toLowerCase());
    })
    .transform((value) => value?.toLowerCase().trim()),
});
