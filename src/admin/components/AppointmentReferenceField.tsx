import { useEffect, useState } from 'react';
import { useFetchClient, useForm, type InputProps } from '@strapi/strapi/admin';
import { Field, TextInput } from '@strapi/design-system';

/** Display the same canonical ID as customer emails without copying group IDs into unique product fields. */
export const AppointmentReferenceField = (props: InputProps) => {
  const record = useForm('AppointmentReferenceField', state => state.initialValues);
  const { get } = useFetchClient();
  const homeTrial = ['try-at-home', 'try-at-home-form'].includes(record.formTag);
  const [group, setGroup] = useState<{ documentId: string; appointmentReference?: string } | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    setGroup(null);
    setError(false);
    setLoading(homeTrial && Boolean(record.documentId));
    if (homeTrial && record.documentId) {
      get(`/content-manager/relations/api::product-submission.product-submission/${encodeURIComponent(record.documentId)}/appointmentGroup`)
        .then(({ data }) => { if (active) setGroup(data.results?.[0] ?? null); })
        .catch(() => { if (active) setError(true); })
        .finally(() => { if (active) setLoading(false); });
    }
    return () => { active = false; };
  }, [get, homeTrial, record.documentId]);

  const appointment = homeTrial ? group ?? (!loading && !error ? record : null) : record;
  const isAppointment = homeTrial || ['product-store-visit', 'product-video-call'].includes(record.formTag);
  const reference = appointment?.appointmentReference || (isAppointment ? appointment?.documentId : '') || '';
  return <Field.Root name={props.name} error={error ? 'Unable to load the appointment reference. Reload to retry.' : undefined}>
    <Field.Label>Appointment reference</Field.Label>
    <TextInput name={props.name} aria-label="Appointment reference" value={reference}
      placeholder={loading ? 'Loading appointment reference...' : undefined} readOnly />
    <Field.Error />
  </Field.Root>;
};
