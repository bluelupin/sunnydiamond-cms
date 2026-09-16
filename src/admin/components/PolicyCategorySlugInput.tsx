import { useEffect, useRef } from 'react';
import { InputRenderer, useField, type InputProps } from '@strapi/strapi/admin';
import slugify from '@sindresorhus/slugify';

export const PolicyCategorySlugInput = (props: InputProps) => {
  const { name, disabled } = props;
  const title = useField<string>(name.replace(/\.slug$/, '.title'));
  const slug = useField<string>(name);
  const previousTitle = useRef(title.value);

  useEffect(() => {
    const oldTitle = previousTitle.current;
    previousTitle.current = title.value;

    if (disabled || !title.value) return;

    // Keep saved and manually edited slugs stable. New generated slugs follow the title.
    const followsTitle = !slug.initialValue && oldTitle !== title.value &&
      slug.value === slugify(oldTitle || '');
    if (!slug.value || followsTitle) {
      const generated = slugify(title.value);
      if (generated !== slug.value) slug.onChange(name, generated);
    }
  }, [disabled, name, title.value, slug.value, slug.initialValue, slug.onChange]);

  return <InputRenderer {...props} type="string" options={undefined} />;
};
