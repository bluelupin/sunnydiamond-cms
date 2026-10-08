export const PRODUCT_VARIANT_FIELDS = ['productSku', 'metalColour', 'metalPurity'] as const;

/** Optional for older clients; never infer a variant from the parent product ID. */
export function productVariantDetails(input: Record<string, unknown>) {
  const data: Partial<Record<typeof PRODUCT_VARIANT_FIELDS[number], string>> = {};
  for (const field of PRODUCT_VARIANT_FIELDS) {
    const value = input[field];
    if (value == null || value === '') continue;
    const maxLength = field === 'productSku' ? 64 : 100;
    if (typeof value !== 'string' || value.trim().length > maxLength || /[\u0000-\u001f\u007f]/.test(value)) {
      return { data, error: `${field} must be text without control characters and at most ${maxLength} characters.` };
    }
    if (value.trim()) data[field] = value.trim();
  }
  return { data, error: undefined };
}

export const productVariantSnapshot = (row: any) => ({
  productSku: row.productSku ?? null,
  metalColour: row.metalColour ?? null,
  metalPurity: row.metalPurity ?? null,
});

export const productVariantKey = (row: any): string => row.productSku || row.productId;
