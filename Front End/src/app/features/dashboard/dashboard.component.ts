import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, HostListener, OnDestroy, ViewChild, inject } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { ThemeService } from '../../core/services/theme.service';
import { UiIconComponent } from '../../shared/ui-icon/ui-icon.component';

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, NgTemplateOutlet, UiIconComponent],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent implements OnDestroy {
  readonly auth = inject(AuthService);
  readonly theme = inject(ThemeService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  @ViewChild('mobileMenu') private mobileMenu!: ElementRef<HTMLDialogElement>;
  @ViewChild('menuButton') private menuButton!: ElementRef<HTMLButtonElement>;
  menuOpen = false;
  loggingOut = false;
  logoutError = '';

  get displayName(): string {
    return this.auth.user?.nickname?.trim() ?? '';
  }

  get initials(): string { return Array.from(this.displayName || 'Mi cuenta')[0].toLocaleUpperCase('es-AR'); }
  get greeting(): string { return this.displayName ? `¡Hola, ${this.displayName}!` : '¡Qué bueno verte!'; }

  openMenu(): void {
    if (this.mobileMenu.nativeElement.open) return;
    this.mobileMenu.nativeElement.showModal();
    this.menuOpen = true;
    document.body.classList.add('dialog-open');
  }

  closeMenu(): void { this.mobileMenu.nativeElement.close(); }

  onMenuClosed(): void {
    this.menuOpen = false;
    document.body.classList.remove('dialog-open');
    if (!this.destroyRef.destroyed && window.innerWidth <= 760) this.menuButton.nativeElement.focus();
  }

  closeOnBackdrop(event: MouseEvent): void {
    if (event.target !== this.mobileMenu.nativeElement) return;
    const bounds = this.mobileMenu.nativeElement.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) this.closeMenu();
  }

  @HostListener('window:resize')
  onResize(): void {
    if (window.innerWidth > 760 && this.menuOpen) this.closeMenu();
  }

  async logout(): Promise<void> {
    if (this.loggingOut) return;
    this.loggingOut = true;
    this.logoutError = '';
    try {
      await firstValueFrom(this.auth.logout().pipe(takeUntilDestroyed(this.destroyRef)));
      if (!this.destroyRef.destroyed) await this.router.navigateByUrl('/acceso', { replaceUrl: true });
    } catch (error) {
      if (!this.destroyRef.destroyed) this.logoutError = this.auth.errorMessage(error);
    } finally { this.loggingOut = false; }
  }

  ngOnDestroy(): void {
    if (this.menuOpen) {
      document.body.classList.remove('dialog-open');
      this.mobileMenu.nativeElement.close();
    }
  }
}
