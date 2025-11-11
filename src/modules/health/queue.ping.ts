import { IMAGE_QUEUE_NAME, connection } from "@/libs/queue";
import { Queue } from "bullmq";

export async function queuePing() {
  const q = new Queue(IMAGE_QUEUE_NAME, { ...connection });
  const started = Date.now();
  try {
    const client = await q.client; // pastikan koneksi sudah siap
    const pong = await client.ping();
    const ms = Date.now() - started;
    await q.close();
    return { ok: true as const, pingMs: ms, pong };
  } catch (e: any) {
    await q.close().catch(() => {});
    return { ok: false as const, error: String(e) };
  }
}
