export default () => {
  return async (ctx, next) => {
    await next();

    if (ctx.path.startsWith('/admin') && ctx.response.type === 'text/html') {
      ctx.set('Cache-Control', 'no-store, no-cache, must-revalidate');
      ctx.set('Pragma', 'no-cache');
      ctx.set('Expires', '0');
    }
  };
};
