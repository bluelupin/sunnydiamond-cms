import { errors } from '@strapi/utils';
import { normalizeBlogTag } from '../../../../utils/blog-tags';

const normalizeLabel = (event: any) => {
  const { data } = event.params;
  // The key is derived exclusively from the label, never from caller input.
  delete data.normalizedLabel;
  if (data.label === undefined) return;
  if (typeof data.label !== 'string' || !data.label.trim()) {
    throw new errors.ValidationError('A blog tag must have a non-empty label.');
  }
  const normalized = normalizeBlogTag(data.label);
  data.label = normalized.label;
  data.normalizedLabel = normalized.key;
};

export default { beforeCreate: normalizeLabel, beforeUpdate: normalizeLabel };
