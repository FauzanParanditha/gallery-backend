import { connection } from "@/libs/queue";

export async function queuePing() {
  const started = Date.now();
  try {
    await connection.ping();
    const ms = Date.now() - started;
    return { ok: true as const, pingMs: ms };
  } catch (e: any) {
    return { ok: false as const, error: e?.message ?? String(e) };
  }
}
