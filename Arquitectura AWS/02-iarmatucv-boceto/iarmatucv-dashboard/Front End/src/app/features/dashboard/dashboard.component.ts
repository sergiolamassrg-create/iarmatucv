import { ChangeDetectionStrategy, Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { UiIconComponent } from '../../shared/ui-icon/ui-icon.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink, UiIconComponent],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  menuOpen = false;
  darkMode = false;
  loggingOut = false;
  logoutError = '';

  constructor() {
    try {
      this.darkMode = localStorage.getItem('iarmatucv-tema') === 'oscuro';
    } catch {
      this.darkMode = document.documentElement.classList.contains('dark-mode');
    }
    this.applyTheme();
  }

  get displayName(): string {
    const username = this.auth.user?.username?.trim();
    const email = this.auth.user?.email?.split('@')[0]?.trim();
    const value = username && !username.includes('@') && !/^[0-9a-f-]{32,}$/i.test(username)
      ? username : (email || 'bienvenido');
    return value.replace(/[._-]+/g, ' ').split(/\s+/)[0] || 'bienvenido';
  }

  get initials(): string {
    return this.displayName.slice(0, 1).toLocaleUpperCase('es-AR');
  }

  toggleMenu(): void { this.menuOpen = !this.menuOpen; }
  closeMenu(): void { this.menuOpen = false; }

  toggleTheme(): void {
    this.darkMode = !this.darkMode;
    this.applyTheme();
    try {
      localStorage.setItem('iarmatucv-tema', this.darkMode ? 'oscuro' : 'claro');
    } catch { /* El tema funciona aun si el navegador bloquea el almacenamiento. */ }
  }

  async logout(): Promise<void> {
    if (this.loggingOut) return;
    this.loggingOut = true;
    this.logoutError = '';
    try {
      await firstValueFrom(this.auth.logout().pipe(takeUntilDestroyed(this.destroyRef)));
      if (!this.destroyRef.destroyed) await this.router.navigateByUrl('/acceso');
    } catch (error) {
      if (!this.destroyRef.destroyed) this.logoutError = this.auth.errorMessage(error);
    } finally {
      this.loggingOut = false;
    }
  }

  private applyTheme(): void {
    document.documentElement.classList.toggle('dark-mode', this.darkMode);
    document.querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', this.darkMode ? '#10162e' : '#ffffff');
  }
}
