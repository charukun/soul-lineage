const TARGET = 'https://wayfinder-gallery.c-okamoto.workers.dev/';

export default {
  async fetch(request) {
    const source = new URL(request.url);
    const target = new URL(TARGET);
    target.search = source.search;
    target.hash = source.hash;
    return Response.redirect(target.href, 308);
  },
};
