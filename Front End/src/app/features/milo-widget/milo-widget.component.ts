import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, HostListener, ViewChild, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable } from 'rxjs';
import { RouterLink } from '@angular/router';
import { MiloAgentService, type Conversation, type CvDraft } from './milo-agent.service';
import { MiloCvComponent } from './milo-cv.component';

@Component({
  selector: 'app-milo-widget', standalone: true,
  imports: [ReactiveFormsModule, MiloCvComponent, RouterLink], providers: [MiloAgentService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './milo-widget.component.html', styleUrl: './milo-widget.component.css'
})
export class MiloWidgetComponent {
  private readonly service = inject(MiloAgentService);
  private readonly destroyRef = inject(DestroyRef);
  readonly opened = signal(false);
  readonly expanded = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly conversation = signal<Conversation | null>(null);
  readonly library = signal(false);
  readonly selected = signal<CvDraft | null>(null);
  readonly message = new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(1500)] });
  readonly form = new FormGroup({ message: this.message });
  readonly approval = new FormControl(false, { nonNullable: true, validators: [Validators.requiredTrue] });
  private retry: { text: string; id: string } | null = null;
  @ViewChild('messageInput') private messageInput?: ElementRef<HTMLTextAreaElement>;
  @ViewChild('messages') private messages?: ElementRef<HTMLElement>;
  @ViewChild('launcher') private launcher?: ElementRef<HTMLButtonElement>;

  @HostListener('window:iarmatucv-abrir-milo')
  open(): void {
    this.opened.set(true);
    if (!this.conversation()) this.load();
    this.focus();
  }
  minimize(): void { this.opened.set(false); this.launcher?.nativeElement.focus(); }
  toggleExpanded(): void {
    const list = this.messages?.nativeElement;
    const wasAtBottom = !list || list.scrollHeight - list.scrollTop - list.clientHeight < 32;
    this.expanded.update(value => !value);
    requestAnimationFrame(() => {
      if (!this.destroyRef.destroyed && wasAtBottom && this.messages) {
        this.messages.nativeElement.scrollTop = this.messages.nativeElement.scrollHeight;
      }
    });
  }
  escape(event: Event): void {
    event.stopPropagation();
    if (this.expanded()) this.toggleExpanded();
    else this.minimize();
  }
  close(): void {
    this.minimize();
    this.expanded.set(false);
    if (!this.busy()) { this.conversation.set(null); this.selected.set(null); this.library.set(false); }
  }
  private focus(): void {
    requestAnimationFrame(() => {
      if (this.destroyRef.destroyed) return;
      this.messageInput?.nativeElement.focus();
      if (this.messages) this.messages.nativeElement.scrollTop = this.messages.nativeElement.scrollHeight;
    });
  }
  private run(request: Observable<{ data: Conversation }>, after?: () => void): void {
    if (this.busy()) return;
    this.busy.set(true); this.error.set(''); this.approval.setValue(false);
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: response => {
        this.conversation.set(response.data);
        this.busy.set(false);
        after?.();
        this.focus();
      },
      error: error => {
        this.busy.set(false);
        if (error instanceof HttpErrorResponse && error.status === 401) {
          this.conversation.set(null); this.selected.set(null);
          this.error.set('Tu sesión venció. Volvé a ingresar para continuar.');
        } else {
          const message = error instanceof HttpErrorResponse ? error.error?.error?.mensaje : null;
          this.error.set(typeof message === 'string' ? message : 'No pudimos conectar con Milo. Podés reintentar.');
        }
      }
    });
  }
  load(): void { this.run(this.service.history()); }
  toggleLibrary(): void {
    this.library.update(value => !value); this.selected.set(null);
    if (this.library()) this.load();
  }
  send(): void {
    const value = this.message.value.trim();
    if (!value || this.message.invalid || this.busy() || !this.conversation()) return;
    if (!this.retry || this.retry.text !== value) this.retry = { text: value, id: crypto.randomUUID() };
    this.run(this.service.send(value, this.retry.id), () => { this.message.setValue(''); this.retry = null; });
  }
  quick(value: string): void { this.message.setValue(value); this.send(); }
  newConversation(): void {
    this.run(this.service.newConversation(), () => { this.message.setValue(''); this.retry = null; this.selected.set(null); this.library.set(false); });
  }
  confirm(): void {
    const proposal = this.conversation()?.propuesta;
    if (proposal && this.approval.valid) this.run(this.service.confirm(proposal.id), () => { this.selected.set(null); this.library.set(true); });
  }
  cancel(): void {
    const proposal = this.conversation()?.propuesta ?? this.conversation()?.propuestaPerfil;
    if (proposal) this.run(this.service.cancel(proposal.id));
  }
  confirmProfile(): void {
    const proposal = this.conversation()?.propuestaPerfil;
    if (proposal && this.approval.valid) this.run(this.service.confirmProfile(proposal.id), () => {
      window.dispatchEvent(new Event('iarmatucv-perfil-actualizado'));
    });
  }
  profileField(field: string): string {
    return ({ 'datosPersonales.nombre': 'Nombre', 'datosPersonales.apellido': 'Apellido',
      'datosPersonales.nombreProfesional': 'Nombre profesional', 'perfilProfesional.titulo': 'Título profesional',
      'perfilProfesional.resumen': 'Resumen profesional' } as Record<string, string>)[field] ?? field;
  }
  viewCv(id: string): void {
    if (this.busy()) return;
    this.busy.set(true); this.error.set('');
    this.service.cv(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: response => { this.selected.set(response.data.datos); this.busy.set(false); },
      error: () => { this.error.set('No pudimos consultar ese CV. Reintentá.'); this.busy.set(false); }
    });
  }
  editCv(id: string): void { this.quick('Quiero mejorar mi CV con id ' + id + '. Consultalo y preguntame qué quiero cambiar antes de preparar una propuesta.'); }
}

