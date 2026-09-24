import type { PublicUser } from "@surplus/shared";

declare global {
  namespace Express {
    interface Request {
      authUser?: PublicUser;
      authSessionTokenHash?: string;
    }
  }
}

export {};
