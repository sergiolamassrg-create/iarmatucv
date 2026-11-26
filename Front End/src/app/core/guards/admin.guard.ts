import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService); const router = inject(Router);
  return auth.waitForSession().pipe(map(user => user?.isAdmin === true ? true : router.createUrlTree([user ? '/panel' : '/acceso'])));
};
