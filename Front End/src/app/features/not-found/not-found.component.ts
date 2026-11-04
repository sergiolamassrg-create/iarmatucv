import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <section class="page-section container"><div class="info-card">
      <p class="section-kicker">404</p><h1>No encontramos esa página.</h1>
      <p>Podés volver al inicio y seguir conociendo iArmatuCV.</p>
      <a class="btn btn-gradient" routerLink="/">Volver al inicio</a>
    </div></section>
  `
})
export class NotFoundComponent {}
