import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { JsonObject, JsonValue } from '../../core/models/professional-profile';

export interface ProfileField { key: string; label: string; type?: 'text' | 'email' | 'url' | 'textarea' | 'list' | 'checkbox'; }

@Component({
  selector: 'app-profile-fields',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div class="row">
      @for (field of fields; track field.key) {
        <div [class]="field.type === 'textarea' || field.type === 'list' ? 'col-12 field' : 'col-12 col-md-6 field'">
          @if (field.type === 'checkbox') {
            <label class="check" [for]="prefix + '-' + field.key">
              <input [id]="prefix + '-' + field.key" type="checkbox" [ngModel]="value(field) === true" [ngModelOptions]="standalone" (ngModelChange)="update(field, $event)" />
              {{ field.label }}
            </label>
          } @else {
            <label [for]="prefix + '-' + field.key">{{ field.label }}</label>
            @if (field.type === 'textarea' || field.type === 'list') {
              <textarea [id]="prefix + '-' + field.key" [ngModel]="text(field)" [ngModelOptions]="standalone" (ngModelChange)="update(field, $event)" [attr.aria-describedby]="field.type === 'list' ? prefix + '-' + field.key + '-help' : null" rows="3" maxlength="5000"></textarea>
              @if (field.type === 'list') { <small [id]="prefix + '-' + field.key + '-help'">Un elemento por línea.</small> }
            } @else {
              <input [id]="prefix + '-' + field.key" [type]="field.type || 'text'" [ngModel]="text(field)" [ngModelOptions]="standalone" (ngModelChange)="update(field, $event)" [maxlength]="field.type === 'email' ? 254 : 5000" />
            }
          }
        </div>
      }
    </div>
  `,
  styleUrl: './profile-fields.component.css'
})
export class ProfileFieldsComponent {
  @Input({ required: true }) model!: JsonObject;
  @Input({ required: true }) fields!: readonly ProfileField[];
  @Input({ required: true }) prefix!: string;
  @Output() changed = new EventEmitter<void>();
  readonly standalone = { standalone: true };

  value(field: ProfileField): JsonValue | undefined {
    let value: JsonValue | undefined = this.model;
    for (const key of field.key.split('.')) value = value && typeof value === 'object' && !Array.isArray(value) ? value[key] : undefined;
    return value;
  }

  text(field: ProfileField): string {
    const value = this.value(field);
    return Array.isArray(value) ? value.join('\n') : typeof value === 'string' ? value : '';
  }

  update(field: ProfileField, value: string | boolean): void {
    const path = field.key.split('.');
    const key = path.pop()!;
    let object = this.model;
    for (const part of path) {
      const child = object[part];
      if (!child || typeof child !== 'object' || Array.isArray(child)) object[part] = {};
      object = object[part] as JsonObject;
    }
    object[key] = field.type === 'list' ? String(value).split('\n').map(item => item.trim()).filter(Boolean) : value === '' ? null : value;
    this.changed.emit();
  }
}
