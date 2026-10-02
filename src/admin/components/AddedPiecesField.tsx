import { useField, type InputProps } from '@strapi/strapi/admin';
import { Box, Field, Typography } from '@strapi/design-system';

const text = (value: unknown) => typeof value === 'string' && value.trim() ? value : 'Not recorded';
const headings: Record<string, string> = {
  productName: 'Product', productId: 'Product ID', productPath: 'Product page', addedAt: 'Added on (IST)',
};
const heading = (key: string) => headings[key] ?? key
  .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
  .replace(/[_-]+/g, ' ')
  .replace(/^./, letter => letter.toUpperCase());
const displayValue = (value: unknown): string => {
  if (value === null || value === undefined || value === '') return 'Not recorded';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
};
const addedDate = (value: unknown) => {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) return 'Not recorded';
  return new Date(value).toLocaleString('en-GB', {
    timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

/** Read-only presentation of the stored customer-added products. */
export const AddedPiecesField = (props: InputProps) => {
  const field = useField<unknown>(props.name);
  const pieces = (Array.isArray(field.value) ? field.value : [])
    .filter((piece): piece is Record<string, unknown> => piece !== null && typeof piece === 'object' && !Array.isArray(piece));
  const keys = new Set(pieces.flatMap(piece => Object.keys(piece)));
  const columns = [
    ...Object.keys(headings).filter(key => keys.has(key)),
    ...[...keys].filter(key => !Object.prototype.hasOwnProperty.call(headings, key)),
  ];
  const cell = { padding: '12px 16px', textAlign: 'left' as const, verticalAlign: 'top', borderBottom: '1px solid #dcdce4' };
  return (
    <Field.Root name={props.name}>
      <Field.Label>Pieces added by the customer</Field.Label>
      <Box background="neutral0" borderColor="neutral150" hasRadius style={{ overflowX: 'auto' }}>
        {pieces.length === 0 ? (
          <Box padding={4}><Typography textColor="neutral600">No extra pieces have been added.</Typography></Box>
        ) : (
          <table aria-label="Pieces added by the customer" style={{ width: '100%', borderCollapse: 'collapse', minWidth: 650 }}>
            <thead><tr>
              {columns.map(key => (
                <th key={key} scope="col" style={cell}><Typography fontWeight="bold">{heading(key)}</Typography></th>
              ))}
            </tr></thead>
            <tbody>{pieces.map((piece, index) => (
              <tr key={`${text(piece.productId)}-${index}`}>
                {columns.map(key => (
                  <td key={key} style={{ ...cell, overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}>
                    <Typography>{key === 'addedAt' ? addedDate(piece[key]) : displayValue(piece[key])}</Typography>
                  </td>
                ))}
              </tr>
            ))}</tbody>
          </table>
        )}
      </Box>
    </Field.Root>
  );
};
