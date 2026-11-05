import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

type AccessMode = 'login' | 'register' | 'confirm' | 'recover';

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

  changeMode(mode: AccessMode): void {
    this.mode = mode;
    this.message = '';
    this.password = '';
    this.confirmPassword = '';
    this.confirmationCode = '';
  }

  submit(): void {
    // Etapa visual: no se simulan cuentas ni se envían credenciales a ningún servicio.
    // Habilitar el envío únicamente cuando Cognito esté configurado y conectado.
    this.message = 'La interfaz está lista. La autenticación se habilitará al configurar Amazon Cognito.';
  }
}
