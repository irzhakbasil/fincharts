import { HttpInterceptorFn, HttpHandlerFn, HttpRequest, HttpErrorResponse } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AppService } from '../app.service';

export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
) => {
  const router = inject(Router);
  const appService = inject(AppService);
  const token = localStorage.getItem('token');
  
  if (!token) {
    return next(req);
  }

  const authReq = req.clone({
    headers: req.headers.set('Authorization', `Bearer ${token}`)
  });

  return next(authReq).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 401) {
        // Clear stored token
        localStorage.removeItem('token');
        // in case token is expired, login again
        appService.login();

      }
      return throwError(() => error);
    })
  );
};