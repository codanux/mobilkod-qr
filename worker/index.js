import { onRequest } from "../functions/_middleware.js";

export default {
  fetch(request, env) {
    return onRequest({ request, next: () => env.ASSETS.fetch(request) });
  },
};
