import { Routes } from '@angular/router';
import { StudioComponent } from './features/studio/studio.component';

export const routes: Routes = [
  { path: '', redirectTo: '/studio', pathMatch: 'full' },
  { path: 'studio', component: StudioComponent },
  {
    path: 'craft',
    loadComponent: (): Promise<typeof import('./features/craft-room/craft-room.component').CraftRoomComponent> =>
      import('./features/craft-room/craft-room.component').then((module) => module.CraftRoomComponent),
  },
];
