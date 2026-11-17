import { HttpInterceptorFn } from '@angular/common/http';

import { isApiRequest } from '../api-request';

/** Session-Cookie nur an die eigene API, siehe `isApiRequest`. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!isApiRequest(req.url)) return next(req);
  return next(req.clone({ withCredentials: true }));
};
