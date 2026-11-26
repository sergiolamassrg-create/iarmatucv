import { Injectable, signal } from '@angular/core';
@Injectable()
export class CurriculumWorkspace {
  readonly dirty = signal(false);
  readonly saving = signal(false);
  confirmLeave(): boolean {
    if (this.saving()) return false;
    if (this.dirty() && !window.confirm('Tenés cambios sin guardar en este CV. ¿Querés descartarlos y salir?')) return false;
    this.dirty.set(false);
    return true;
  }
  reset(): void { this.dirty.set(false); this.saving.set(false); }
}

