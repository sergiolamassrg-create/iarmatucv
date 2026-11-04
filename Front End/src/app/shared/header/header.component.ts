import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { UiIconComponent } from '../ui-icon/ui-icon.component';

@Component({
  selector: 'app-header',
  imports: [RouterLink, RouterLinkActive, UiIconComponent],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './header.component.html'
})
export class HeaderComponent {
  darkMode = false;
  readonly sectionMatch = {
    paths: 'exact', queryParams: 'ignored', matrixParams: 'ignored', fragment: 'exact'
  } as const;

  constructor() {
    try {
      this.darkMode = localStorage.getItem('iarmatucv-tema') === 'oscuro';
    } catch {
    }
    this.applyTheme();
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
