import { Component, ChangeDetectionStrategy } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { UiIconComponent } from '../ui-icon/ui-icon.component';
import { AuthService } from '../../core/services/auth.service';
import { ThemeService } from '../../core/services/theme.service';

@Component({
  selector: 'app-header',
  imports: [RouterLink, RouterLinkActive, UiIconComponent],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './header.component.html',
  styleUrl: './header.component.css'
})
export class HeaderComponent {
  get darkMode(): boolean { return this.theme.darkMode; }
  readonly sectionMatch = {
    paths: 'exact', queryParams: 'ignored', matrixParams: 'ignored', fragment: 'exact'
  } as const;

  constructor(private readonly router: Router, readonly auth: AuthService, private readonly theme: ThemeService) {}

  get isAccessPage(): boolean {
    return this.router.url.split(/[?#]/, 1)[0] === '/acceso';
  }

  toggleTheme(): void {
    this.theme.toggle();
  }
}
