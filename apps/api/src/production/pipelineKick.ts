/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Serial pipeline kick
 * Introduction: Starts the host oneshot after Submit accepts work. Never waits on the pipeline.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-08-21
 * Last modified: 2026-08-21
 */
import { spawn } from "node:child_process";

/**
 * Fire-and-forget. Submit must not wait for extract/fetch.
 * Set FLAHA_PIPELINE_KICK_CMD on the small host (systemctl start --no-block).
 */
export function kickSerialPipeline(): void {
  const command = process.env.FLAHA_PIPELINE_KICK_CMD?.trim();
  if (!command) return;
  try {
    const child = spawn(command, {
      shell: true,
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    });
    child.unref();
  } catch {
    // Submit already created the job. A missed kick is residual, not a failed submit.
  }
}
