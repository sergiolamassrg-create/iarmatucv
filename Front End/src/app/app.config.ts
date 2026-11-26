import { ApplicationConfig, inject, provideAppInitializer, provideZoneChangeDetection } from '@angular/core';
import { AuthService } from './core/services/auth.service';
import { provideHttpClient, withInterceptors, withXhr } from '@angular/common/http';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideHttpClient(withXhr(), withInterceptors([authInterceptor])),
    provideAppInitializer(() => inject(AuthService).waitForSession()),
    provideRouter(routes, withInMemoryScrolling({
      scrollPositionRestoration: 'enabled', anchorScrolling: 'enabled'
    }))
  ]
};
