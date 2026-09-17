import { useField, type InputProps } from '@strapi/strapi/admin';
import { Box, Field, Typography } from '@strapi/design-system';

type Change = {
  previousData?: { requestedDate?: string | null; selectedTimeSlot?: string | null };
  newData?: { requestedDate?: string | null; selectedTimeSlot?: string | null };
  productId?: string | null;
  changedAt?: string;
};

const scheduleText = (data: Change['previousData']) =>
  `${data?.requestedDate || 'No date'} · ${data?.selectedTimeSlot || 'No time slot'}`;

export const RescheduleTracker = (props: InputProps) => {
  const field = useField<Change[]>(props.name);
  const history = Array.isArray(field.value) ? field.value : [];
  const cell = { padding: '12px 16px', textAlign: 'left' as const, verticalAlign: 'top', borderBottom: '1px solid #dcdce4' };
  return (
    <Field.Root name={props.name}>
      <Field.Label>Reschedule tracker</Field.Label>
      <Box background="neutral0" borderColor="neutral150" hasRadius style={{ overflowX: 'auto' }}>
        {history.length === 0 ? (
          <Box padding={4}><Typography textColor="neutral600">No rescheduling changes yet.</Typography></Box>
        ) : (
          <table aria-label="Reschedule history" style={{ width: '100%', borderCollapse: 'collapse', minWidth: 650 }}>
            <thead><tr>
              {['Changed at', 'Previous data', 'Updated data', 'Product ID'].map((heading) => (
                <th key={heading} scope="col" style={cell}><Typography fontWeight="bold">{heading}</Typography></th>
              ))}
            </tr></thead>
            <tbody>
              {[...history].reverse().map((change, index) => (
                <tr key={`${change.changedAt}-${index}`}>
                  <td style={cell}><Typography>{change.changedAt && !Number.isNaN(Date.parse(change.changedAt)) ? new Date(change.changedAt).toLocaleString() : '—'}</Typography></td>
                  <td style={cell}><Typography>{scheduleText(change.previousData)}</Typography></td>
                  <td style={cell}><Typography>{scheduleText(change.newData)}</Typography></td>
                  <td style={cell}><Typography>{change.productId || '—'}</Typography></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Box>
    </Field.Root>
  );
};
