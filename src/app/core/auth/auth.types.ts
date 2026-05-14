export interface LoginPayload {
  email: string;
  password: string;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BetterAuthLoginResponse {
  redirect: boolean;
  token: string;
  user: AuthUser;
}
