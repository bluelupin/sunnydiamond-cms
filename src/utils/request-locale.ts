const stringLocale = (value: unknown) => {
  if (typeof value !== 'string') return undefined;
  const locale = value.trim();
  return locale.length > 0 ? locale : undefined;
};

export const requestLocale = (ctx: any, input?: any) =>
  stringLocale(ctx.query?.locale) ?? stringLocale(input?.locale);
