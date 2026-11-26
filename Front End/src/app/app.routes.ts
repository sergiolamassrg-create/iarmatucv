import { Routes } from '@angular/router';
import { HomeComponent } from './features/home/home.component';
import { AccessComponent } from './features/access/access.component';
import { StatusComponent } from './features/status/status.component';
import { NotFoundComponent } from './features/not-found/not-found.component';
import { authGuard } from './core/guards/auth.guard';
import { adminGuard } from './core/guards/admin.guard';
import type { ProfileComponent } from './features/profile/profile.component';
import type { CurriculumEditorComponent } from './features/curriculums/curriculum-editor.component';

export const routes: Routes = [
  { path: '', component: HomeComponent, title: 'iArmatuCV — Tu próximo paso empieza acá' },
  { path: 'acceso', component: AccessComponent, title: 'Acceso — iArmatuCV' },
  { path: 'estado', component: StatusComponent, title: 'Estado de la aplicación — iArmatuCV' },
  { path: 'panel', canActivate: [authGuard], loadComponent: () => import('./features/dashboard/dashboard.component').then(module => module.DashboardComponent), title: 'Mi espacio — iArmatuCV', children: [
    { path: 'admin', canActivate: [authGuard, adminGuard], loadComponent: () => import('./features/admin/admin.component').then(module => module.AdminComponent), title: 'Administración — iArmatuCV' },
    { path: 'curriculums', canActivate: [authGuard], loadComponent: () => import('./features/curriculums/curriculums.component').then(module => module.CurriculumsComponent), title: 'Mis CV — iArmatuCV' },
    { path: 'curriculums/:id', canActivate: [authGuard], loadComponent: () => import('./features/curriculums/curriculum-editor.component').then(module => module.CurriculumEditorComponent),
      canDeactivate: [(component: CurriculumEditorComponent) => component.canLeave()], title: 'Editar CV — iArmatuCV' },
    { path: 'milo', canActivate: [authGuard], loadComponent: () => import('./features/milo/milo.component').then(module => module.MiloComponent), title: 'Milo — iArmatuCV' },
    { path: 'perfil', canActivate: [authGuard], loadComponent: () => import('./features/profile/profile.component').then(module => module.ProfileComponent),
      canDeactivate: [(component: ProfileComponent) => component.canLeave()], title: 'Mi perfil profesional — iArmatuCV' }
  ] },
  { path: '**', component: NotFoundComponent, title: 'Página no encontrada — iArmatuCV' }
];
