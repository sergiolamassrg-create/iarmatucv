import { ChangeDetectionStrategy, Component, DestroyRef, HostListener, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CurriculumsService } from '../../core/services/curriculums.service';
import { CurriculumWorkspace } from '../../core/services/curriculum-workspace.service';
import { ProfileService } from '../../core/services/profile.service';
import { AuthService } from '../../core/services/auth.service';
import { curriculumFromProfile, emptyCurriculum, profileForCurriculum, type Curriculum, type CvDraft } from '../../core/models/curriculum';
import { buildCvDocument, cvExportIssues, cvTemplates, defaultCvOptions, type CvTemplateKey } from '../../core/models/cv-document';
import { ProfileCvComponent } from '../profile/profile-cv.component';

const control = (value = '', max = 120, required = false) => new FormControl(value, {
  nonNullable: true, validators: [...(required ? [Validators.required] : []), Validators.maxLength(max)]
});
const experienceGroup = (item?: CvDraft['experiencias'][number]) => new FormGroup({
  empresa: control(item?.empresa), puesto: control(item?.puesto, 120, true), descripcion: control(item?.descripcion, 800),
  fechaInicio: control(item?.fechaInicio, 40), fechaFin: control(item?.fechaFin, 40),
  actual: new FormControl(item?.actual ?? false, { nonNullable: true })
});
const educationGroup = (item?: CvDraft['educacion'][number]) => new FormGroup({
  institucion: control(item?.institucion), titulo: control(item?.titulo, 160, true),
  fechaInicio: control(item?.fechaInicio, 40), fechaFin: control(item?.fechaFin, 40)
});
@Component({
  selector: 'app-curriculum-editor', standalone: true,
  imports: [RouterLink, ReactiveFormsModule, ProfileCvComponent], changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './curriculum-editor.component.html', styleUrl: './curriculum-editor.component.css'
})
export class CurriculumEditorComponent {
  private readonly service = inject(CurriculumsService);
  readonly workspace = inject(CurriculumWorkspace);
  readonly profile = inject(ProfileService);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly selected = signal<Curriculum | null>(null);
  readonly draft = signal<CvDraft>(emptyCurriculum());
  readonly loading = signal(false);
  readonly preview = signal(false);
  readonly error = signal('');
  readonly message = signal('');
  readonly templates = cvTemplates;
  readonly template = new FormControl<CvTemplateKey>('ats', { nonNullable: true });
  readonly experiences = new FormArray<ReturnType<typeof experienceGroup>>([]);
  readonly education = new FormArray<ReturnType<typeof educationGroup>>([]);
  readonly form = new FormGroup({
    titulo: control('', 120, true), tituloProfesional: control('', 120), resumen: control('', 1500), experiencias: this.experiences,
    educacion: this.education, habilidades: control('', 1300)
  });
  private id = '';
  private version = 0;
  private seedProfile = false;
  private seeded = false;
  private retry: { signature: string; requestId: string } | null = null;
  private previousTitle = '';

  constructor() {
    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.draft.set(this.formDraft());
      this.workspace.dirty.set(this.form.dirty);
      this.message.set('');
    });
    this.template.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.markDirty());
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => this.load(params.get('id') ?? 'nuevo'));
    effect(() => {
      const state = this.profile.state();
      if (this.seedProfile && !this.seeded && this.id === 'nuevo' && state.status === 'ready' && state.profile) {
        this.apply(curriculumFromProfile(state.profile)); this.seeded = true; this.markDirty();
      }
    });
  }
  private load(id: string): void {
    this.afterPrint(); this.workspace.reset(); this.id = id; this.retry = null;
    this.preview.set(this.route.snapshot.queryParamMap.get('vista') === 'cv');
    this.error.set(''); this.message.set(''); this.selected.set(null);
    this.seedProfile = id === 'nuevo' && this.route.snapshot.queryParamMap.get('base') === 'perfil';
    this.seeded = false;
    const version = ++this.version;
    if (id === 'nuevo') {
      this.loading.set(false); this.apply(emptyCurriculum());
      const state = this.profile.state();
      if (this.seedProfile && state.status === 'ready' && state.profile) {
        this.apply(curriculumFromProfile(state.profile)); this.seeded = true; this.markDirty();
      }
      return;
    }
    this.loading.set(true);
    this.service.get(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: response => {
        if (version !== this.version) return;
        this.selected.set(response.data); this.apply(response.data.datos); this.loading.set(false);
      },
      error: error => { if (version === this.version) { this.loading.set(false); this.error.set(this.auth.errorMessage(error)); } }
    });
  }
  reload(): void { if (this.workspace.confirmLeave()) this.load(this.id); }
  private formDraft(): CvDraft {
    const raw = this.form.getRawValue();
    return { ...raw, plantilla: this.template.value, habilidades: raw.habilidades.split('\n').map(item => item.trim()).filter(Boolean) };
  }
  private apply(data: CvDraft): void {
    this.template.setValue(data.plantilla ?? 'ats', { emitEvent: false });
    this.experiences.clear({ emitEvent: false });
    this.education.clear({ emitEvent: false });
    for (const item of data.experiencias) this.experiences.push(experienceGroup(item), { emitEvent: false });
    for (const item of data.educacion) this.education.push(educationGroup(item), { emitEvent: false });
    this.form.patchValue({ titulo: data.titulo, tituloProfesional: data.tituloProfesional ?? '', resumen: data.resumen, habilidades: data.habilidades.join('\n') }, { emitEvent: false });
    this.form.markAsPristine(); this.workspace.dirty.set(false); this.draft.set(structuredClone(data));
  }
  markDirty(): void { this.form.markAsDirty(); this.workspace.dirty.set(true); this.draft.set(this.formDraft()); }
  addExperience(): void { if (this.experiences.length < 12) { this.experiences.push(experienceGroup()); this.markDirty(); } }
  addEducation(): void { if (this.education.length < 12) { this.education.push(educationGroup()); this.markDirty(); } }
  removeExperience(index: number): void { this.experiences.removeAt(index); this.markDirty(); }
  removeEducation(index: number): void { this.education.removeAt(index); this.markDirty(); }
  get cvProfile() {
    const state = this.profile.state();
    return state.profile ? profileForCurriculum(state.profile, this.draft()) : null;
  }
  get document() {
    const profile = this.cvProfile;
    if (!profile) return null;
    const options = defaultCvOptions(profile); options.template = this.template.value;
    return buildCvDocument(profile, options);
  }
  get exportIssues(): string[] {
    const state = this.profile.state();
    return state.profile ? cvExportIssues(state.profile) : ['Completá y guardá tus datos personales en Mi perfil para exportar.'];
  }
  get canExport(): boolean {
    return !!this.selected() && !this.loading() && !this.workspace.saving() && !this.workspace.dirty() &&
      this.form.valid && this.exportIssues.length === 0 && !!this.document;
  }
  save(): void {
    if (this.workspace.saving() || this.loading()) return;
    this.error.set(''); this.form.markAllAsTouched();
    if (this.form.invalid || this.formDraft().habilidades.length > 12) {
      this.error.set('Completá el título, los campos obligatorios y usá hasta 12 habilidades, una por línea.'); return;
    }
    const datos = this.formDraft();
    const signature = JSON.stringify(datos);
    if (!this.retry || this.retry.signature !== signature) this.retry = { signature, requestId: crypto.randomUUID() };
    const existing = this.selected();
    const request = existing ? this.service.update(existing, datos, this.retry.requestId) : this.service.create(datos, this.retry.requestId);
    this.workspace.saving.set(true);
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: response => {
        this.workspace.saving.set(false); this.selected.set(response.data); this.apply(response.data.datos); this.retry = null;
        this.message.set('Se guardaron el contenido y la plantilla de este CV. Tus otras versiones y el perfil común no cambiaron.');
        if (this.id === 'nuevo') void this.router.navigate(['/panel/curriculums', response.data.id], { replaceUrl: true });
      },
      error: error => { this.workspace.saving.set(false); this.error.set(this.auth.errorMessage(error)); }
    });
  }
  generatePdf(): void {
    if (!this.canExport) return;
    this.preview.set(true);
    requestAnimationFrame(() => { if (!this.destroyRef.destroyed && this.canExport) { this.beforePrint(); window.print(); } });
  }
  @HostListener('window:beforeprint')
  beforePrint(): void {
    if (!this.preview() || !this.canExport) return;
    document.body.classList.add('profile-printing', 'curriculum-printing');
    document.documentElement.classList.add('profile-printing');
    if (!this.previousTitle) this.previousTitle = document.title;
    document.title = (this.document?.name ?? '') + ' - ' + this.draft().titulo;
  }
  @HostListener('window:afterprint')
  afterPrint(): void {
    document.body.classList.remove('profile-printing', 'curriculum-printing');
    document.documentElement.classList.remove('profile-printing');
    if (this.previousTitle) { document.title = this.previousTitle; this.previousTitle = ''; }
  }
  canLeave(): boolean { return this.workspace.confirmLeave(); }
  @HostListener('window:beforeunload', ['$event'])
  beforeUnload(event: BeforeUnloadEvent): void {
    if (this.workspace.dirty() || this.workspace.saving()) { event.preventDefault(); event.returnValue = ''; }
  }
  ngOnDestroy(): void { this.afterPrint(); this.workspace.reset(); }
}

