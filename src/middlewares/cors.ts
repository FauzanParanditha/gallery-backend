import { ENV } from "@/config/env";
import cors from "cors";
export const corsMw = cors({ origin: ENV.CORS_ORIGIN, credentials: true });
