import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map, take } from 'rxjs';
import { AuthService } from '../services/auth.service';

/** Esta guarda controla la navegación del navegador. El backend debe seguir validando la sesión. */
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.user) return true;
  return auth.waitForSession().pipe(
    take(1),
    map(user => user ? true : router.createUrlTree(['/acceso']))
  );
};
