import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-access',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <section class="page-section container">
      <div class="info-card access-card">
        <span class="large-spark" aria-hidden="true">✦</span>
        <p class="section-kicker">ESTAMOS DANDO LOS PRIMEROS PASOS</p>
        <h1>Un lugar para tu próximo comienzo.</h1>
        <p>El registro y el inicio de sesión todavía no están disponibles. Te avisaremos acá cuando puedas crear tu cuenta y guardar tus currículums.</p>
        <p class="quiet-note">En esta etapa no solicitamos contraseñas ni guardamos información de tu CV.</p>
        <a class="btn btn-gradient" routerLink="/">Volver al inicio <span aria-hidden="true">→</span></a>
      </div>
    </section>
  `
})
export class AccessComponent {}
