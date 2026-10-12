import { useField, useForm, type InputProps } from '@strapi/strapi/admin';
import { Field, NumberInput } from '@strapi/design-system';

type Card = Record<string, unknown>;

export const ProductListingPositionInput = (props: InputProps & { attribute?: { min?: number } }) => {
  const { name } = props;
  const field = useField<number>(name);
  const cards = useForm('ProductListingPositionInput', state => state.values.listingCards as Card[] | undefined);
  const match = name.match(/^listingCards\.(\d+)\.(desktopPosition|mobilePosition)$/);
  let error = field.error;

  if (match && Array.isArray(cards)) {
    const index = Number(match[1]);
    const key = match[2];
    const value = field.value;
    if (value !== undefined && cards.some((card, cardIndex) =>
      cardIndex !== index && Number(card?.[key]) === Number(value) && card?.[key] !== undefined && card?.[key] !== null
    )) {
      error = `Position ${value} already exists.`;
    }
  }

  return (
    <Field.Root name={name} error={error} hint={props.hint} required={props.required}>
      <Field.Label action={props.labelAction}>{props.label}</Field.Label>
      <NumberInput
        name={name}
        value={field.value}
        onValueChange={(value) => field.onChange(name, value)}
        disabled={props.disabled}
        placeholder={props.placeholder}
        min={props.attribute?.min}
      />
      <Field.Error />
      <Field.Hint />
    </Field.Root>
  );
};
