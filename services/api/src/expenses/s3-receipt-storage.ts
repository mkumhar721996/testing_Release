import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ReceiptStorage } from './receipt-storage';

@Injectable()
export class S3ReceiptStorage extends ReceiptStorage {
  private readonly client: S3Client;

  constructor(private readonly config: ConfigService) {
    super();
    this.client = new S3Client({
      region: config.get<string>('AWS_REGION', 'us-east-1'),
    });
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket(),
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
  }

  async remove(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket(), Key: key }),
    );
  }

  private bucket(): string {
    const bucket = this.config.get<string>('RECEIPTS_BUCKET');
    if (!bucket) throw new Error('RECEIPTS_BUCKET is not set');
    return bucket;
  }
}
