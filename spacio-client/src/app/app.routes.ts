import { Routes } from '@angular/router';
import { StudioComponent } from './features/studio/studio.component';

export const routes: Routes = [
  { path: '', redirectTo: '/studio', pathMatch: 'full' },
  { path: 'studio', component: StudioComponent },
  // { path: 'home', component: HomeComponent } // placeholder for Home Dashboard page
];
