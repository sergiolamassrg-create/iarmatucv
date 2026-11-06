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
        @case ('menu') { <path d="M4 6h16M4 12h16M4 18h16"/> }
        @case ('user') { <circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/> }
        @case ('logout') { <path d="M9 4H4v16h5m4-13 5 5-5 5m-5-5h10"/> }
        @case ('grid') { <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/> }
        @case ('mail') { <rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 6 9 7 9-7"/> }
        @case ('phone') { <path d="m7 3 3 5-3 3a14 14 0 0 0 6 6l3-3 5 3-2 4C10 22 2 14 3 5l4-2Z"/> }
        @case ('link') { <path d="m10 14 4-4m-6 5-2 2a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m4 2 2-2a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0" transform="translate(1 0)"/> }
        @case ('location') { <path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 0 1 14 0Z"/><circle cx="12" cy="10" r="2"/> }
      }
    </svg>
  `
})
export class UiIconComponent {
  @Input() name = 'spark';
}
