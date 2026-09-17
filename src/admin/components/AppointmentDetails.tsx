import { useField, type InputProps } from '@strapi/strapi/admin';
import { Box, Field, Typography } from '@strapi/design-system';

const statuses: Record<string, string> = {
  New: 'Requested', Contacted: 'Customer contacted', Scheduled: 'Scheduled',
  Visited: 'Completed', Closed: 'Closed', Cancelled: 'Cancelled',
};
const dateText = (value: unknown) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'Not recorded';
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? 'Not recorded' : date.toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  });
};

/** Display stored audit values without editing or rewriting the JSON. */
export const AppointmentDetails = (props: InputProps) => {
  const field = useField<Record<string, any>>(props.name);
  const data = field.value && typeof field.value === 'object' && !Array.isArray(field.value) ? field.value : {};
  const rows = [
    ['Date', dateText(data.requestedDate)],
    ['Time', data.selectedTimeSlot || 'Not recorded'],
    ['Status', statuses[data.workflowStatus] || data.workflowStatus || 'Not recorded'],
    ['Address', [data.addressLine1, data.addressLine2, data.city, data.pincode].filter(Boolean).join(', ') || 'Not recorded'],
  ];
  const products = Array.isArray(data.products) ? data.products : [];
  return (
    <Field.Root name={props.name}>
      <Field.Label>{props.name === 'previousData' ? 'Previous appointment' : 'Updated appointment'}</Field.Label>
      <Box background="neutral0" borderColor="neutral150" hasRadius padding={4}>
        <dl style={{ margin: 0 }}>
          {rows.map(([label, value]) => (
            <div key={label} style={{ display: 'grid', gridTemplateColumns: '90px 1fr', gap: 12, marginBottom: 12 }}>
              <dt><Typography fontWeight="bold">{label}</Typography></dt>
              <dd style={{ margin: 0 }}><Typography>{value}</Typography></dd>
            </div>
          ))}
        </dl>
        {products.length > 0 && <>
          <Typography fontWeight="bold">Affected products</Typography>
          <ul style={{ marginBottom: 0, paddingLeft: 20 }}>
            {products.map((product: any, index: number) => <li key={product.documentId || index}>
              <Typography>{product.productName || 'Product'}{product.productId ? ` (ID: ${product.productId})` : ''}</Typography>
            </li>)}
          </ul>
        </>}
      </Box>
    </Field.Root>
  );
};
