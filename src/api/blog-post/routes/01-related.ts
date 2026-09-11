export default {
  routes: [{
    method: 'GET',
    path: '/blog-posts/:documentId/related',
    handler: 'blog-post.related',
    config: { auth: { scope: ['api::blog-post.blog-post.find'] } },
  }],
};
