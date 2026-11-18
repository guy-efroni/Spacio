import { IUserProfile } from './user-profile.interface';

export interface IAuthResponse {
  accessToken: string;
  user: IUserProfile;
}

export interface ILoginRequest {
  email: string;
  password: string;
}

export interface IRegisterRequest extends ILoginRequest {
  displayName: string;
}
