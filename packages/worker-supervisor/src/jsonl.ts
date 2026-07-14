/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Bounded JSONL Decoder
 * Introduction:
 * Decodes worker stdout into bounded single-line JSON protocol messages.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-15
 * Last modified: 2026-07-15
 */

import { WorkerProtocolError } from "./errors.js";

export class JsonlDecoder {
  private pending = Buffer.alloc(0);
  constructor(private readonly maximumLineBytes: number) {}
  push(chunk: Buffer): unknown[] {
    this.pending = Buffer.concat([this.pending, chunk]);
    if (this.pending.length > this.maximumLineBytes && !this.pending.includes(10)) throw new WorkerProtocolError("Worker stdout line exceeded its byte limit.");
    const values: unknown[] = [];
    let newline: number;
    while ((newline = this.pending.indexOf(10)) >= 0) {
      const line = this.pending.subarray(0, newline); this.pending = this.pending.subarray(newline + 1);
      if (line.length > this.maximumLineBytes) throw new WorkerProtocolError("Worker stdout line exceeded its byte limit.");
      if (!line.length) throw new WorkerProtocolError("Worker emitted an empty protocol line.");
      try { values.push(JSON.parse(line.toString("utf8"))); }
      catch { throw new WorkerProtocolError("Worker emitted malformed JSON."); }
    }
    return values;
  }
  finish(): void { if (this.pending.length) throw new WorkerProtocolError("Worker stdout ended with an incomplete JSONL line."); }
}
