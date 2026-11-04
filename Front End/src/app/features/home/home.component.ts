import { Component, ElementRef, OnDestroy, OnInit, ViewChild, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { CvTemplate } from '../../core/models/cv-template';
import { TemplatesService } from '../../core/services/templates.service';
import { CvPreviewComponent } from '../../shared/cv-preview/cv-preview.component';
import { UiIconComponent } from '../../shared/ui-icon/ui-icon.component';

@Component({
  selector: 'app-home',
  imports: [RouterLink, CvPreviewComponent, UiIconComponent],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './home.component.html'
})
export class HomeComponent implements OnInit, OnDestroy {
  @ViewChild('previewDialog') private previewDialog!: ElementRef<HTMLDialogElement>;

  templates: CvTemplate[] = [];
  selectedTemplate: CvTemplate | null = null;
  state: 'loading' | 'success' | 'error' = 'loading';
  private request?: Subscription;

  constructor(private readonly templatesService: TemplatesService) {}

  ngOnInit(): void {
    this.loadTemplates();
  }

  loadTemplates(): void {
    this.request?.unsubscribe();
    this.state = 'loading';
    this.templates = [];
    this.selectedTemplate = null;
    this.request = this.templatesService.getTemplates().subscribe({
      next: (response) => {
        if (!Array.isArray(response?.data)) {
          this.state = 'error';
          return;
        }
        this.templates = response.data;
        this.selectedTemplate = this.templates[0] ?? null;
        this.state = 'success';
      },
      error: () => { this.state = 'error'; }
    });
  }

  selectTemplate(template: CvTemplate): void {
    this.selectedTemplate = template;
  }

  openPreview(): void {
    if (!this.selectedTemplate) return;
    this.previewDialog.nativeElement.showModal();
    document.body.classList.add('dialog-open');
  }

  closePreview(): void {
    this.previewDialog.nativeElement.close();
  }

  onDialogClosed(): void {
    document.body.classList.remove('dialog-open');
  }

  closeOnBackdrop(event: MouseEvent): void {
    if (event.target === this.previewDialog.nativeElement) {
      const bounds = this.previewDialog.nativeElement.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right ||
          event.clientY < bounds.top || event.clientY > bounds.bottom) {
        this.closePreview();
      }
    }
  }

  changeTemplate(direction: number): void {
    if (!this.selectedTemplate || this.templates.length === 0) return;
    const current = this.templates.indexOf(this.selectedTemplate);
    this.selectedTemplate = this.templates[(current + direction + this.templates.length) % this.templates.length];
  }

  ngOnDestroy(): void {
    this.request?.unsubscribe();
    this.onDialogClosed();
  }
}
