import { useField, type InputProps } from '@strapi/strapi/admin';
import { Box, Field, Typography } from '@strapi/design-system';

/** The submission relation tracks appointments; only actual product details are displayed. */
export const AffectedAppointmentProducts = (props: InputProps) => {
  const previous = useField<Record<string, any>>('previousData').value;
  const updated = useField<Record<string, any>>('newData').value;
  const data = updated ?? previous ?? {};
  const products = (Array.isArray(data.products) ? data.products : [data])
    .filter((product: any) => product && (product.productName?.trim() || product.productId?.trim()));
  if (!products.length) return null;

  return (
    <Field.Root name={props.name}>
      <Field.Label>Affected products ({products.length})</Field.Label>
      <Box background="neutral0" borderColor="neutral150" hasRadius padding={4}>
        {products.map((product: any, index: number) => (
          <Box key={product.documentId ?? index} paddingTop={index ? 3 : 0}>
            <Typography>{[product.productName, product.productId].filter(Boolean).join(' · ')}</Typography>
          </Box>
        ))}
      </Box>
    </Field.Root>
  );
};
