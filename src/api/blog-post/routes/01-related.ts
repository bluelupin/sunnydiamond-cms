export default {
  routes: [{
    method: 'GET',
    path: '/blog-posts/:slug/related',
    handler: 'blog-post.related',
    config: { auth: { scope: ['api::blog-post.blog-post.find'] } },
  }],
};
