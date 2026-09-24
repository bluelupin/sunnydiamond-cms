import { useForm, type InputProps } from '@strapi/strapi/admin';
import { Field, TextInput } from '@strapi/design-system';

/** Read the persisted email reference without depending on relation labels or permissions. */
export const AppointmentReferenceField = (props: InputProps) => {
  const record = useForm('AppointmentReferenceField', state => state.initialValues);
  return <Field.Root name={props.name}>
    <Field.Label>Appointment reference</Field.Label>
    <TextInput name={props.name} aria-label="Appointment reference" value={record.appointmentReference || ''} readOnly />
  </Field.Root>;
};
