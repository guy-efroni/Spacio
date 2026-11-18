import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-workspace-nav',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './workspace-nav.component.html',
  styleUrl: './workspace-nav.component.scss',
})
export class WorkspaceNavComponent {}
