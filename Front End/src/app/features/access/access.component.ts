import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, ViewChild, inject } from '@angular/core';
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
  registrationStep: 'profile' | 'credentials' = 'profile';
  name = '';
  familyName = '';
  nickname = '';
  @ViewChild('registrationTitle') private registrationTitle?: ElementRef<HTMLElement>;
  email = '';
  password = '';
  confirmPassword = '';
  confirmationCode = '';
  showPassword = false;
  message = '';
  error = '';
  busy = false;
  private readonly destroyRef = inject(DestroyRef);

  constructor(readonly auth: AuthService, private readonly router: Router) {
    this.message = this.auth.takeLogoutNotice();
  }

  changeMode(mode: AccessMode, form: NgForm): void {
    if (this.busy) return;
    this.mode = mode;
    this.registrationStep = 'profile';
    this.name = '';
    this.familyName = '';
    this.nickname = '';
    this.message = '';
    this.error = '';
    this.resetFields(form);
  }

  async submit(form: NgForm): Promise<void> {
    if (this.busy) return;
    const needsConfirmation = this.mode === 'reset' || (this.mode === 'register' && this.registrationStep === 'credentials');
    if (form.invalid || (needsConfirmation && this.password !== this.confirmPassword)) {
      form.form.markAllAsTouched();
      return;
    }
    if (this.mode === 'register' && this.registrationStep === 'profile') {
      this.changeRegistrationStep('credentials', form);
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
          this.resetFields(form);
          if (!this.destroyRef.destroyed) await this.router.navigateByUrl('/panel', { replaceUrl: true });
          break;
        case 'register': {
          const response = await firstValueFrom(this.auth.register(this.email, this.password, {
            name: this.name.trim(), familyName: this.familyName.trim(), nickname: this.nickname.trim()
          }).pipe(takeUntilDestroyed(this.destroyRef)));
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
      if (this.mode === 'register' && this.auth.errorCode(error) === 'DATOS_DE_CUENTA_INCOMPLETOS') this.registrationStep = 'profile';
      this.error = this.auth.errorMessage(error);
    } finally {
      this.busy = false;
      this.resetFields(form);
    }
  }

  changeRegistrationStep(step: 'profile' | 'credentials', form: NgForm): void {
    if (this.busy) return;
    this.registrationStep = step;
    this.error = '';
    this.message = '';
    this.resetFields(form);
    requestAnimationFrame(() => {
      if (!this.destroyRef.destroyed) this.registrationTitle?.nativeElement.focus();
    });
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
      await firstValueFrom(this.auth.logout().pipe(takeUntilDestroyed(this.destroyRef)));
      this.mode = 'login';
      this.email = '';
      this.message = this.auth.takeLogoutNotice();
    } catch (error) {
      if (!this.destroyRef.destroyed) this.error = this.auth.errorMessage(error);
    } finally { this.busy = false; }
  }

  private resetFields(form: NgForm): void {
    this.password = '';
    this.confirmPassword = '';
    this.confirmationCode = '';
    this.showPassword = false;
    form.resetForm({
      email: this.email, name: this.name, familyName: this.familyName, nickname: this.nickname,
      password: '', confirmPassword: '', confirmationCode: ''
    });
  }
}
