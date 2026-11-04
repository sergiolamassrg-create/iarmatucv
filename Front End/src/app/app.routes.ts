import { Routes } from '@angular/router';
import { HomeComponent } from './features/home/home.component';
import { AccessComponent } from './features/access/access.component';
import { StatusComponent } from './features/status/status.component';
import { NotFoundComponent } from './features/not-found/not-found.component';

export const routes: Routes = [
  { path: '', component: HomeComponent, title: 'iArmatuCV — Tu próximo paso empieza acá' },
  { path: 'acceso', component: AccessComponent, title: 'Acceso — iArmatuCV' },
  { path: 'estado', component: StatusComponent, title: 'Estado de la aplicación — iArmatuCV' },
  { path: '**', component: NotFoundComponent, title: 'Página no encontrada — iArmatuCV' }
];
