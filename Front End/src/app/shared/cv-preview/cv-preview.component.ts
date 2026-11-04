import { Component, Input, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-cv-preview',
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './cv-preview.component.html'
})
export class CvPreviewComponent {
  @Input() variant = 'clasica';
  @Input() compact = true;
}
