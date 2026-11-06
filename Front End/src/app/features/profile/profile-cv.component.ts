import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { cvHref, type CvDocument, type CvTemplateKey } from '../../core/models/cv-document';
import { UiIconComponent } from '../../shared/ui-icon/ui-icon.component';

@Component({
  selector: 'app-profile-cv',
  imports: [NgTemplateOutlet, UiIconComponent],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './profile-cv.component.html',
  styleUrl: './profile-cv.component.css'
})
export class ProfileCvComponent {
  @Input({ required: true }) document!: CvDocument;
  @Input() template: CvTemplateKey = 'ats';
  readonly hrefFor = cvHref;
  get initials(): string {
    const parts = this.document.name.split(/\s+/).filter(Boolean);
    return (parts.length > 1 ? [parts[0], parts[parts.length - 1]] : parts).map(part => Array.from(part)[0]).join('').toLocaleUpperCase('es-AR');
  }
  get sideSections() { return this.document.sections.filter(section => ['habilidades', 'idiomas'].includes(section.key)); }
  get mainSections() { return this.template === 'moderna' ? this.document.sections.filter(section => !['habilidades', 'idiomas'].includes(section.key)) : this.document.sections; }
  get hasSidebar(): boolean { return this.template === 'moderna' && Boolean(this.document.contact.length || this.sideSections.length); }
  lineHref(line: string): string | null { return /^https?:\/\//i.test(line) ? cvHref(line) : null; }
  contactIcon(value: string): string {
    const href = cvHref(value);
    return href?.startsWith('mailto:') ? 'mail' : href?.startsWith('tel:') ? 'phone' : href ? 'link' : 'location';
  }
}
