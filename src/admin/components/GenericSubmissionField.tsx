import { InputRenderer, useForm, type InputProps } from '@strapi/strapi/admin';

/** Keep normal inputs for other forms and for creation; lock saved contact submissions. */
export const GenericSubmissionField = (props: InputProps & { attribute: { type: string } }) => {
  const readonly = useForm('GenericSubmissionField', state => state.initialValues.formTag === 'reach-out-to-us');
  return <InputRenderer {...props} type={props.attribute.type as any}
    disabled={props.disabled || readonly} />;
};
