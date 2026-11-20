import { ReceiptStorage } from '../receipt-storage';

export class InMemoryReceiptStorage extends ReceiptStorage {
  readonly objects = new Map<string, { body: Buffer; contentType: string }>();

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    this.objects.set(key, { body, contentType });
  }

  async remove(key: string): Promise<void> {
    this.objects.delete(key);
  }
}
