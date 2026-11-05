import { ChangeDetectionStrategy, Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule, NgForm } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';

type AccessMode = 'login' | 'register' | 'confirm' | 'recover' | 'reset';

@Component({
  selector: 'app-access',
  imports: [FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './access.component.html',
  styleUrl: './access.component.css'
})
export class AccessComponent {
  mode: AccessMode = 'login';
  email = '';
  password = '';
  confirmPassword = '';
  confirmationCode = '';
  showPassword = false;
  message = '';
  error = '';
  busy = false;
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);

  constructor(readonly auth: AuthService) {}

  changeMode(mode: AccessMode, form: NgForm): void {
    if (this.busy) return;
    this.mode = mode;
    this.message = '';
    this.error = '';
    this.resetFields(form);
  }

  async submit(form: NgForm): Promise<void> {
    if (this.busy) return;
    if (form.invalid || ((this.mode === 'register' || this.mode === 'reset') && this.password !== this.confirmPassword)) {
      form.form.markAllAsTouched();
      return;
    }
    this.busy = true;
    this.error = '';
    this.message = '';
    this.email = this.email.trim();
    try {
      switch (this.mode) {
        case 'login':
          await firstValueFrom(this.auth.login(this.email, this.password).pipe(takeUntilDestroyed(this.destroyRef)));
          if (!this.destroyRef.destroyed) await this.router.navigateByUrl('/panel');
          break;
        case 'register': {
          const response = await firstValueFrom(this.auth.register(this.email, this.password).pipe(takeUntilDestroyed(this.destroyRef)));
          this.mode = response.data.confirmed ? 'login' : 'confirm';
          this.message = response.data.confirmed ? 'Cuenta creada. Ya podés iniciar sesión.' : 'Revisá tu correo e ingresá el código para confirmar tu cuenta.';
          break;
        }
        case 'confirm': {
          const response = await firstValueFrom(this.auth.confirm(this.email, this.confirmationCode).pipe(takeUntilDestroyed(this.destroyRef)));
          this.mode = 'login';
          this.message = response.data.message;
          break;
        }
        case 'recover': {
          const response = await firstValueFrom(this.auth.recover(this.email).pipe(takeUntilDestroyed(this.destroyRef)));
          this.mode = 'reset';
          this.message = response.data.message;
          break;
        }
        case 'reset': {
          const response = await firstValueFrom(this.auth.reset(this.email, this.confirmationCode, this.password).pipe(takeUntilDestroyed(this.destroyRef)));
          this.mode = 'login';
          this.message = response.data.message;
          break;
        }
      }
    } catch (error) {
      if (this.destroyRef.destroyed) return;
      if (this.auth.errorCode(error) === 'CUENTA_SIN_CONFIRMAR') this.mode = 'confirm';
      if (this.auth.errorCode(error) === 'RECUPERACION_REQUERIDA') this.mode = 'recover';
      this.error = this.auth.errorMessage(error);
    } finally {
      this.busy = false;
      if (!this.destroyRef.destroyed) this.resetFields(form);
    }
  }

  async resendCode(form: NgForm): Promise<void> {
    if (this.busy) return;
    const emailField = form.controls['email'];
    if (!emailField?.valid) { emailField?.markAsTouched(); return; }
    this.busy = true;
    this.error = '';
    this.message = '';
    try {
      const response = await firstValueFrom(this.auth.resend(this.email.trim()).pipe(takeUntilDestroyed(this.destroyRef)));
      this.message = response.data.message;
    } catch (error) {
      if (!this.destroyRef.destroyed) this.error = this.auth.errorMessage(error);
    } finally { this.busy = false; }
  }

  async logout(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.error = '';
    this.message = '';
    try {
      const response = await firstValueFrom(this.auth.logout().pipe(takeUntilDestroyed(this.destroyRef)));
      this.mode = 'login';
      this.email = '';
      this.message = response.data.message;
    } catch (error) {
      if (!this.destroyRef.destroyed) this.error = this.auth.errorMessage(error);
    } finally { this.busy = false; }
  }

  private resetFields(form: NgForm): void {
    this.password = '';
    this.confirmPassword = '';
    this.confirmationCode = '';
    this.showPassword = false;
    form.resetForm({ email: this.email });
  }
}
