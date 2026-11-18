import { Injectable, Signal, WritableSignal, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import {
  IAuthResponse,
  ILoginRequest,
  IRegisterRequest,
  IUserProfile,
} from '@spacio/shared-types';

const AUTH_ENDPOINT: string = '/api/auth';
const TOKEN_STORAGE_KEY: string = 'spacio.auth.token';
const USER_STORAGE_KEY: string = 'spacio.auth.user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly _http: HttpClient = inject(HttpClient);
  private readonly _currentUser: WritableSignal<IUserProfile | null>;
  private readonly _token: WritableSignal<string | null>;

  public readonly currentUser: Signal<IUserProfile | null>;
  public readonly isAuthenticated: Signal<boolean>;

  public constructor() {
    const storedToken: string | null = this._readStorage(TOKEN_STORAGE_KEY);
    const storedUser: IUserProfile | null = this._readJson<IUserProfile>(USER_STORAGE_KEY);
    this._token = signal<string | null>(storedToken);
    this._currentUser = signal<IUserProfile | null>(storedUser);
    this.currentUser = this._currentUser.asReadonly();
    this.isAuthenticated = computed<boolean>(
      (): boolean => this._token() !== null && this._currentUser() !== null
    );
  }

  public login(request: ILoginRequest): Observable<IUserProfile> {
    return this._http.post<IAuthResponse>(`${AUTH_ENDPOINT}/login`, request).pipe(
      map((response: IAuthResponse): IUserProfile => {
        this._applySession(response);
        return response.user;
      })
    );
  }

  public register(request: IRegisterRequest): Observable<IUserProfile> {
    return this._http.post<IAuthResponse>(`${AUTH_ENDPOINT}/register`, request).pipe(
      map((response: IAuthResponse): IUserProfile => {
        this._applySession(response);
        return response.user;
      })
    );
  }

  public logout(): void {
    this._token.set(null);
    this._currentUser.set(null);
    this._removeStorage(TOKEN_STORAGE_KEY);
    this._removeStorage(USER_STORAGE_KEY);
  }

  public getToken(): string | null {
    return this._token();
  }

  public authorizationHeaders(): HttpHeaders {
    const token: string | null = this._token();
    return token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : new HttpHeaders();
  }

  private _applySession(response: IAuthResponse): void {
    this._token.set(response.accessToken);
    this._currentUser.set(response.user);
    this._writeStorage(TOKEN_STORAGE_KEY, response.accessToken);
    this._writeJson(USER_STORAGE_KEY, response.user);
  }

  private _readStorage(key: string): string | null {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(key);
  }

  private _writeStorage(key: string, value: string): void {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(key, value);
  }

  private _removeStorage(key: string): void {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(key);
  }

  private _readJson<T>(key: string): T | null {
    const raw: string | null = this._readStorage(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  private _writeJson<T>(key: string, value: T): void {
    this._writeStorage(key, JSON.stringify(value));
  }
}
