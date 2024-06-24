# CloudSpec

CloudSpec is a testing framework for cloud infrastructure projects, simplifying integration tests for AWS CDK. It provides an easy-to-use interface for deploying and testing cloud resources.

## Packages

- [@cloudspec/aws-cdk](./packages/@cloudspec/aws-cdk/): Testing framework for AWS CDK applications
- [@cloudspec/aws-toolkit](./packages/@cloudspec/aws-toolkit/): Utility library for interacting with AWS services

## Features

- Simple setup and execution of integration tests for the AWS CDK
- Utility functions for interacting with AWS services (S3 and Step Functions)
- Automatic resource management and cleanup

## Example

Check out our [Bucket example](./test/aws-cdk/bucket/component.test.ts) to see CloudSpec in action.

## Getting Started

1. Install the required package for your infrastructure framework:

```bash
npm install @cloudspec/aws-cdk
```

2. Set up your test file using Vitest and CloudSpec:

```typescript
import { cloudSpec } from '@cloudspec/aws-cdk';
import { Stack } from 'aws-cdk-lib';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { describe, it } from 'vitest';

const cloud = cloudSpec();

describe('S3 Bucket Tests', () => {
  cloud.setup((stack: Stack, setOutputs) => {
    const bucket = new Bucket(stack, 'TestBucket');
    setOutputs({ bucketName: bucket.bucketName });
  });

  cloud.test('bucket should exist', async (outputs) => {
    // Add your test assertions here
  });
});
```

3. Run your tests using Vitest:

```bash
npx vitest
```

For more detailed information, please refer to the README files of individual packages.

## CloudSpec AWS Toolkit

CloudSpec AWS Toolkit is a utility library for interacting with AWS services, specifically S3 and Step Functions, in your Node.js applications.

### Features

- S3 operations:
  - Check if an object exists in a bucket
  - Create an object in a bucket
  - Get object content from a bucket
- Step Functions operations:
  - Generate console URL for executions
  - Execute standard and express state machines
  - Monitor execution status

### Installation

```bash
npm install @cloudspec/aws-toolkit
```

### Usage

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

### Configuration

Set the `AWS_REGION` environment variable or it will default to 'us-east-1'.

## Contributing

We welcome contributions!

## License

This project is licensed under the Apache 2.0 License - see the [LICENSE](LICENSE) file for details.
