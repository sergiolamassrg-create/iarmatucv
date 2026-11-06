import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, HostListener, ViewChild, effect, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { ProfileService } from '../../core/services/profile.service';
import { ListSection, ProfessionalProfile, profileDraft } from '../../core/models/professional-profile';
import { ProfileFieldsComponent } from './profile-fields.component';
import { pendingFields, personalFields, privacyFields, professionalFields, repeatSections } from './profile-form.config';
import { buildCvDocument, cvExportIssues, cvTemplates, defaultCvOptions, orderedCvSections, profileProgress } from '../../core/models/cv-document';
import { ProfileCvComponent } from './profile-cv.component';

@Component({
  selector: 'app-professional-profile',
  imports: [RouterLink, FormsModule, ProfileFieldsComponent, ProfileCvComponent],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.css'
})
export class ProfileComponent {
  readonly store = inject(ProfileService);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  @ViewChild('profileForm') private form?: ElementRef<HTMLFormElement>;
  readonly personalFields = personalFields;
  readonly professionalFields = professionalFields;
  readonly privacyFields = privacyFields;
  readonly pendingFields = pendingFields;
  readonly sections = repeatSections;
  readonly steps = ['Datos personales', 'Perfil profesional', 'Experiencia', 'Educación', 'Habilidades', 'Idiomas y más'];
  step = inject(ActivatedRoute).snapshot.queryParamMap.get('vista') === 'cv' ? 6 : 0;
  draft = profileDraft();
  creating = false;
  error = '';
  message = '';
  private loaded?: ProfessionalProfile;
  readonly cvTemplates = cvTemplates;
  readonly standalone = { standalone: true };
  cvOptions = defaultCvOptions(this.draft);
  cvOptionsTouched = false;
  exportError = '';

  constructor() {
    effect(() => {
      const state = this.store.state();
      if (state.status === 'ready' && state.profile && state.profile !== this.loaded) {
        this.loaded = state.profile;
        this.draft = profileDraft(state.profile);
        if (!this.cvOptionsTouched) this.cvOptions = defaultCvOptions(this.draft);
        this.creating = false;
      }
    });
  }

  markDirty(): void { this.store.dirty = true; this.message = ''; this.error = ''; }

  sectionStep(section: ListSection): number {
    return section === 'experiencias' ? 2 : section === 'educacion' ? 3 : section === 'habilidades' ? 4 : 5;
  }

  selectStep(step: number): void {
    if (this.store.saving || step < 0 || step > this.steps.length) return;
    this.step = step;
    requestAnimationFrame(() => {
      if (this.destroyRef.destroyed) return;
      this.form?.nativeElement.querySelector<HTMLElement>(`section[data-step="${step}"] h2`)?.focus();
    });
  }

  get fullName(): string {
    const personal = this.draft.datosPersonales;
    return [personal['nombre'], personal['apellido']].filter(value => typeof value === 'string' && value.trim()).join(' ');
  }

  get avatar(): string { return this.fullName.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toLocaleUpperCase('es-AR') || '—'; }

  get cvDocument() { return buildCvDocument(this.draft, this.cvOptions); }
  get cvSections() { return orderedCvSections(this.cvOptions); }
  get exportIssues() { return cvExportIssues(this.draft); }
  get progress() { return profileProgress(this.draft); }

  moveCvSection(index: number, offset: number): void {
    const order = this.cvSections.map(section => section.key);
    const target = index + offset;
    if (target < 0 || target >= order.length) return;
    [order[index], order[target]] = [order[target], order[index]];
    this.cvOptions.order = order;
    this.cvOptionsTouched = true;
  }

  generatePdf(): void {
    this.exportError = '';
    if (this.store.saving || !this.form || this.exportIssues.length) {
      this.exportError = this.exportIssues.join(' ') || 'Esperá a que termine el guardado.';
      return;
    }
    if (!this.validateForm()) return;
    this.beforePrint();
    window.print();
  }

  @HostListener('window:beforeprint')
  beforePrint(): void {
    if (this.step === 6 && !this.exportIssues.length && this.form) {
      document.body.classList.add('profile-printing');
      document.documentElement.classList.add('profile-printing');
    }
  }

  @HostListener('window:afterprint')
  afterPrint(): void {
    document.body.classList.remove('profile-printing');
    document.documentElement.classList.remove('profile-printing');
  }

  ngOnDestroy(): void { this.afterPrint(); }

  add(section: ListSection): void {
    if (this.draft[section].length >= 100) return;
    this.draft[section].push({ id: crypto.randomUUID() });
    this.markDirty();
  }

  remove(section: ListSection, index: number): void {
    if (!window.confirm('¿Quitar este elemento? Se eliminará del perfil cuando guardes los cambios.')) return;
    this.draft[section].splice(index, 1);
    this.markDirty();
  }

  reset(): void {
    if (!this.store.confirmLeave()) return;
    this.draft = profileDraft(this.loaded);
    this.cvOptions = defaultCvOptions(this.draft);
    this.cvOptionsTouched = false;
    this.store.dirty = false;
    this.error = '';
    this.message = '';
  }

  retry(): void { if (this.store.confirmLeave()) this.store.load(); }

  save(event: Event): void {
    event.preventDefault();
    if (this.store.saving || !this.form) return;
    if (!this.validateForm()) return;
    this.store.saving = true;
    this.error = '';
    this.message = '';
    this.store.save(structuredClone(this.draft)).pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.store.saving = false)).subscribe({
      next: () => this.message = 'Tu perfil se guardó correctamente.',
      error: error => { this.store.handleError(error); this.error = this.auth.errorMessage(error); }
    });
  }

  private validateForm(): boolean {
    if (!this.form) return false;
    const form = this.form.nativeElement;
    if (!form.checkValidity()) {
      const invalid = form.querySelector<HTMLInputElement | HTMLTextAreaElement>('input:invalid, textarea:invalid');
      const section = invalid?.closest<HTMLElement>('[data-step]');
      this.selectStep(Number(section?.dataset['step'] ?? 0));
      requestAnimationFrame(() => invalid?.reportValidity());
      return false;
    }
    return true;
  }

  canLeave(): boolean {
    if (this.store.saving || !this.store.confirmLeave()) return false;
    this.store.dirty = false;
    return true;
  }

  @HostListener('window:beforeunload', ['$event'])
  beforeUnload(event: BeforeUnloadEvent): void {
    if (this.store.dirty || this.store.saving) { event.preventDefault(); event.returnValue = ''; }
  }
}
