import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { HeaderComponent } from './shared/header/header.component';
import { FooterComponent } from './shared/footer/footer.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, HeaderComponent, FooterComponent],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <a class="skip-link" href="#contenido">Saltar al contenido</a>
    @if (!isDashboard()) { <app-header /> }
    <main id="contenido" tabindex="-1"><router-outlet /></main>
    @if (!isDashboard()) { <app-footer /> }
  `
})
export class AppComponent {
  private readonly router = inject(Router);
  readonly isDashboard = toSignal(this.router.events.pipe(
    filter((event): event is NavigationEnd => event instanceof NavigationEnd),
    map(event => event.urlAfterRedirects.split(/[?#]/, 1)[0].replace(/\/+$/, '').match(/^\/panel(?:\/|$)/) !== null)
  ), { initialValue: this.router.url.split(/[?#]/, 1)[0].replace(/\/+$/, '').match(/^\/panel(?:\/|$)/) !== null });
}
