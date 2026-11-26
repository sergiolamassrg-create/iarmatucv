import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { CvDraft } from './milo-agent.service';
@Component({
  selector: 'app-milo-cv', standalone: true, changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p><strong>Nombre interno (no se imprime):</strong> {{ data().titulo }}</p>
    <p><strong>Diseño:</strong> {{ data().plantilla === 'moderna' ? 'Profesional Moderna' : 'ATS Clásica' }}. Podés cambiarlo en Mis CV.</p>
    @if (data().tituloProfesional) { <h4>{{ data().tituloProfesional }}</h4> }
    @if (data().resumen) { <p>{{ data().resumen }}</p> }
    <h5>Experiencia</h5>
    @for (item of data().experiencias; track $index) {
      <p><strong>{{ item.puesto }}</strong> · {{ item.empresa }}</p>
      @if (item.fechaInicio || item.fechaFin || item.actual) { <p>{{ item.fechaInicio }} — {{ item.actual ? 'Actualidad' : item.fechaFin }}</p> }
      <p>{{ item.descripcion }}</p>
    } @empty { <p>Sin experiencia cargada.</p> }
    <h5>Educación</h5>
    @for (item of data().educacion; track $index) { <p>{{ item.titulo }} · {{ item.institucion }}</p>
      @if (item.fechaInicio || item.fechaFin) { <p>{{ item.fechaInicio }} — {{ item.fechaFin }}</p> }
    }
    @empty { <p>Sin estudios cargados.</p> }
    <h5>Habilidades</h5><p>{{ data().habilidades.join(' · ') || 'Sin habilidades cargadas.' }}</p>
  `,
  styles: ['h4,h5 { margin: .8rem 0 .4rem; } p { white-space: pre-wrap; overflow-wrap: anywhere; margin: .3rem 0; }']
})
export class MiloCvComponent { readonly data = input.required<CvDraft>(); }

