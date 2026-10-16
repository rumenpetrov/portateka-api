import type { JwtPayload } from "../utils/jwt";

export interface AppVariables {
  user: JwtPayload;
}

export interface AppEnv {
  Bindings: CloudflareBindings;
  Variables: AppVariables;
}
