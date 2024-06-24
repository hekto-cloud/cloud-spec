# CloudSpec AWS Toolkit

CloudSpec AWS Toolkit is a utility library for interacting with AWS services, specifically S3 and Step Functions, in your Node.js applications.

## Features

- S3 operations:
  - Check if an object exists in a bucket
  - Create an object in a bucket
  - Get object content from a bucket
- Step Functions operations:
  - Generate console URL for executions
  - Execute standard and express state machines
  - Monitor execution status

## Installation

```bash
npm install @cloudspec/aws-toolkit
```

## Usage

```typescript
import { s3, stepFunctions } from '@cloudspec/aws-toolkit';

// S3 operations
const objectExists = await s3.objectExists({ bucketName: 'my-bucket', key: 'my-object' });
const objectCreated = await s3.createObject({ bucketName: 'my-bucket', key: 'my-object', body: 'Hello, World!' });
const content = await s3.getObjectContent({ bucketName: 'my-bucket', key: 'my-object' });

// Step Functions operations
const consoleUrl = stepFunctions.getConsoleUrl({ executionArn: 'arn:aws:states:...' });
const result = await stepFunctions.execute({
  stateMachineArn: 'arn:aws:states:...',
  input: { key: 'value' },
  timeout: 60000
});
```

## Configuration

Set the `AWS_REGION` environment variable or it will default to 'us-east-1'.

## License

MIT