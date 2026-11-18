import {
  Component,
  OnDestroy,
  Signal,
  WritableSignal,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { Router } from '@angular/router';
import {
  HtmlTag,
  IFurnitureBlueprint,
  KeyboardKey,
  StudioViewChild,
  ViewportToolMode,
} from '@spacio/shared-types';
import { AuthService } from '../../core/services/auth.service';
import { FloorplanService } from '../../core/services/floorplan.service';
import { FurnitureCatalogService } from '../../core/services/furniture-catalog.service';
import { PropertyInspectorComponent } from '../property-inspector/property-inspector.component';
import { ViewportComponent } from '../viewport/viewport.component';
import { WorkspaceNavComponent } from '../../shared/components/workspace-nav.component';

type TAuthMode = 'login' | 'register';

@Component({
  selector: 'app-studio',
  standalone: true,
  imports: [DecimalPipe, PropertyInspectorComponent, ViewportComponent, WorkspaceNavComponent],
  providers: [FloorplanService],
  templateUrl: './studio.component.html',
  styleUrl: './studio.component.scss',
})
export class StudioComponent implements OnDestroy {
  private readonly _floorplanService: FloorplanService = inject(FloorplanService);
  private readonly _catalog: FurnitureCatalogService = inject(FurnitureCatalogService);
  private readonly _auth: AuthService = inject(AuthService);
  private readonly _router: Router = inject(Router);
  protected readonly viewportComponent: Signal<ViewportComponent> = viewChild.required<ViewportComponent>(StudioViewChild.ViewportComponent);

  protected readonly isCatalogOpen: WritableSignal<boolean> = signal<boolean>(false);
  protected readonly isAuthOpen: WritableSignal<boolean> = signal<boolean>(false);
  protected readonly authMode: WritableSignal<TAuthMode> = signal<TAuthMode>('login');
  protected readonly authEmail: WritableSignal<string> = signal<string>('');
  protected readonly authPassword: WritableSignal<string> = signal<string>('');
  protected readonly authDisplayName: WritableSignal<string> = signal<string>('');
  protected readonly authMessage: WritableSignal<string> = signal<string>('');
  protected readonly isAuthenticating: WritableSignal<boolean> = signal<boolean>(false);

  protected readonly currentUser = this._auth.currentUser;
  protected readonly isAuthenticated = this._auth.isAuthenticated;
  protected readonly wallCount: Signal<number> = computed<number>(() => this._floorplanService.walls().length);
  protected readonly roomArea: Signal<number> = computed<number>(() => this._floorplanService.roomArea());
  protected readonly ViewportToolMode: typeof ViewportToolMode = ViewportToolMode;
  protected readonly furnitureCatalog: Signal<readonly IFurnitureBlueprint[]> = this._catalog.blueprints;
  protected readonly isCatalogLoading: Signal<boolean> = this._catalog.isLoading;
  protected readonly catalogError: Signal<string | null> = this._catalog.error;

  private readonly _onKeyDown: (event: KeyboardEvent) => void = (event: KeyboardEvent): void => this._handleKeyDown(event);

  public constructor() {
    window.addEventListener('keydown', this._onKeyDown);
  }

  public ngOnDestroy(): void {
    window.removeEventListener('keydown', this._onKeyDown);
  }

  protected _onResetRoom(): void {
    this.viewportComponent().onResetRoom();
  }

  protected readonly floorplanService: FloorplanService = this._floorplanService;

  protected onToggleCatalog(): void {
    this.isCatalogOpen.update((open: boolean): boolean => !open);
  }

  protected onToggleAuth(): void {
    this.isAuthOpen.update((open: boolean): boolean => !open);
    this.authMessage.set('');
  }

  protected onAuthModeChange(mode: TAuthMode): void {
    this.authMode.set(mode);
    this.authMessage.set('');
  }

  protected onAuthFieldChange(field: 'email' | 'password' | 'displayName', event: Event): void {
    const value: string = (event.target as HTMLInputElement).value;
    if (field === 'email') this.authEmail.set(value);
    else if (field === 'password') this.authPassword.set(value);
    else this.authDisplayName.set(value);
  }

  protected onSubmitAuth(): void {
    if (this.isAuthenticating()) return;
    this.isAuthenticating.set(true);
    this.authMessage.set('');
    const request =
      this.authMode() === 'login'
        ? this._auth.login({ email: this.authEmail(), password: this.authPassword() })
        : this._auth.register({
            email: this.authEmail(),
            password: this.authPassword(),
            displayName: this.authDisplayName(),
          });
    request.subscribe({
      next: (): void => {
        this.isAuthenticating.set(false);
        this.authMessage.set(this.authMode() === 'login' ? 'Signed in.' : 'Account created.');
        this.authPassword.set('');
      },
      error: (): void => {
        this.isAuthenticating.set(false);
        this.authMessage.set('Authentication failed. Check your details and API connection.');
      },
    });
  }

  protected onLogout(): void {
    this._auth.logout();
    this.authMessage.set('Signed out. Local pieces remain available.');
  }

  protected onSelectFurniture(blueprint: IFurnitureBlueprint): void {
    this.isCatalogOpen.set(false);
    this.viewportComponent().onStartFurniturePlacement(blueprint);
  }

  protected onOpenCraftRoom(): void {
    const selected = this._floorplanService
      .furniture()
      .find((item): boolean => item.instanceId === this._floorplanService.selectedFurnitureId());
    const queryParams: { edit?: string } = selected ? { edit: selected.blueprintId } : {};
    void this._router.navigate(['/craft'], { queryParams });
  }

  private _handleKeyDown(event: KeyboardEvent): void {
    if (this._isEditableTarget(event.target)) return;

    const key: string = event.key.toLowerCase();
    const isUndo: boolean = event.ctrlKey && !event.shiftKey && key === KeyboardKey.Undo;
    const isRedo: boolean = event.ctrlKey && (key === KeyboardKey.Redo || (event.shiftKey && key === KeyboardKey.Undo));

    if (isUndo) {
      event.preventDefault();
      this._floorplanService.undo();
      return;
    }
    if (isRedo) {
      event.preventDefault();
      this._floorplanService.redo();
    }
  }

  private _isEditableTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    const tagName: string = target.tagName;
    return tagName === HtmlTag.Input || tagName === HtmlTag.TextArea || tagName === HtmlTag.Select || target.isContentEditable;
  }
}
