import { cloudSpec } from '@cloudspec/aws-cdk';
import { describe, expect } from 'vitest';
import { Stack } from 'aws-cdk-lib';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import '@cloudspec/aws-matcher';

const cloud = cloudSpec();

describe('S3 Bucket Tests', () => {
  cloud.setup((stack: Stack, setOutputs) => {
    const bucket = new Bucket(stack, 'TestBucket');
    setOutputs({
      bucketName: bucket.bucketName,
    });
  });

  cloud.test('bucket should exist', async (outputs) => {
    const { bucketName } = outputs;
    const key = `test-object-${Date.now()}`;
    const object = { bucketName, key };
    await expect(object).not.toExistInS3();
    await expect({ ...object, content: 'hello' }).toPutObjectInS3();
    await expect(object).toExistInS3();
  });
})
