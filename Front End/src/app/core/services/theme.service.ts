import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  darkMode = false;

  constructor() {
    try { this.darkMode = localStorage.getItem('iarmatucv-tema') === 'oscuro'; }
    catch { this.darkMode = document.documentElement.classList.contains('dark-mode'); }
    this.applyTheme();
  }

  toggle(): void {
    this.darkMode = !this.darkMode;
    this.applyTheme();
    try { localStorage.setItem('iarmatucv-tema', this.darkMode ? 'oscuro' : 'claro'); }
    catch {}
  }

  private applyTheme(): void {
    document.documentElement.classList.toggle('dark-mode', this.darkMode);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', this.darkMode ? '#10162e' : '#ffffff');
  }
}
