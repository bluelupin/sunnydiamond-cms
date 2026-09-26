import { useEffect, useRef } from 'react';
import { useField, type InputProps } from '@strapi/strapi/admin';
import { Field, TextInput } from '@strapi/design-system';
import { ArrowClockwise } from '@strapi/icons';
import slugify from '@sindresorhus/slugify';

export const PolicySlugInput = (props: InputProps) => {
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

  return (
    <Field.Root name={name} error={slug.error} hint={props.hint} required={props.required}>
      <Field.Label action={props.labelAction}>{props.label}</Field.Label>
      <TextInput
        name={name}
        value={slug.value ?? ''}
        onChange={slug.onChange}
        disabled={disabled}
        placeholder={props.placeholder}
        endAction={!disabled && (
          <Field.Action
            label="Regenerate"
            onClick={() => slug.onChange(name, slugify(title.value || ''))}
            disabled={!title.value?.trim()}
          >
            <ArrowClockwise width="1.6rem" height="1.6rem" fill="neutral400" />
          </Field.Action>
        )}
      />
      <Field.Error />
      <Field.Hint />
    </Field.Root>
  );
};
