import { createHash } from 'crypto';
import { randomUUID } from 'crypto';

export function jobId(source: string, externalId: string): string {
  return createHash('sha256').update(`${source}:${externalId}`).digest('hex').slice(0, 32);
}

export function uuid(): string {
  return randomUUID();
}
