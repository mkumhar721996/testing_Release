/** Object Storage for receipt files (ADR-0019). */
export abstract class ReceiptStorage {
  abstract put(key: string, body: Buffer, contentType: string): Promise<void>;
  abstract remove(key: string): Promise<void>;
}
