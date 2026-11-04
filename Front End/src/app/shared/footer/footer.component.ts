import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-footer',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <footer class="site-footer container">
      <a class="brand brand-small" routerLink="/">iArmatu<span class="brand-cv">CV</span></a>
      <span>Tu historia merece un buen comienzo.</span>
      <a routerLink="/estado">Estado de la aplicación</a>
    </footer>
  `
})
export class FooterComponent {}
