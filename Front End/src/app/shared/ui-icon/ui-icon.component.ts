import { Component, Input, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-icon',
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"
      stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
      @switch (name) {
        @case ('sun') { <circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/> }
        @case ('moon') { <path d="M20.9 13.1A9 9 0 0 1 10.9 3.1a9 9 0 1 0 10 10Z"/> }
        @case ('chat') { <path d="M20 11.5a8 8 0 0 1-8 8 8.5 8.5 0 0 1-3.8-.9L4 20l1.4-4.2A8 8 0 1 1 20 11.5Z"/><path d="M8 10h8m-8 4h5"/> }
        @case ('spark') { <path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z"/><path d="m20 2 .6 1.4L22 4l-1.4.6L20 6l-.6-1.4L18 4l1.4-.6L20 2Z"/> }
        @case ('file') { <path d="M6 3h8l4 4v14H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="M14 3v5h4M8 12h6m-6 4h6"/> }
        @case ('check') { <path d="m5 12 4 4L19 6"/> }
        @case ('arrow') { <path d="M4 12h16m-6-6 6 6-6 6"/> }
        @case ('chevron') { <path d="m9 5 7 7-7 7"/> }
        @case ('eye') { <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/> }
        @case ('play') { <path d="m9 5 10 7-10 7V5Z"/> }
        @case ('close') { <path d="m6 6 12 12M6 18 18 6"/> }
      }
    </svg>
  `
})
export class UiIconComponent {
  @Input() name = 'spark';
}
