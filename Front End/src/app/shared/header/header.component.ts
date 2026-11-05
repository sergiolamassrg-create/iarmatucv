import { Component, ChangeDetectionStrategy } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { UiIconComponent } from '../ui-icon/ui-icon.component';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-header',
  imports: [RouterLink, RouterLinkActive, UiIconComponent],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './header.component.html',
  styleUrl: './header.component.css'
})
export class HeaderComponent {
  darkMode = false;
  readonly sectionMatch = {
    paths: 'exact', queryParams: 'ignored', matrixParams: 'ignored', fragment: 'exact'
  } as const;

  constructor(private readonly router: Router, readonly auth: AuthService) {
    try {
      this.darkMode = localStorage.getItem('iarmatucv-tema') === 'oscuro';
    } catch {
    }
    this.applyTheme();
  }

  get isAccessPage(): boolean {
    return this.router.url.split(/[?#]/, 1)[0] === '/acceso';
  }

  toggleTheme(): void {
    this.darkMode = !this.darkMode;
    this.applyTheme();
    try {
      localStorage.setItem('iarmatucv-tema', this.darkMode ? 'oscuro' : 'claro');
    } catch {
    }
  }

  private applyTheme(): void {
    document.documentElement.classList.toggle('dark-mode', this.darkMode);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', this.darkMode ? '#10162e' : '#ffffff');
  }
}
