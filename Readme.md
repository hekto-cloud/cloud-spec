# CloudSpec

CloudSpec is a testing framework for cloud infrastructure projects, simplifying integration tests for AWS CDKIt provides an easy-to-use interface for deploying and testing cloud resources.

## Packages

- [@cloudspec/aws-cdk](./packages/@cloudspec/aws-cdk/): Testing framework for AWS CDK applications
- [@cloudspec/aws-matcher](./packages/@cloudspec/aws-matcher/): Custom assertion library for testing AWS resources

## Features

- Simple setup and execution of integration tests for the AWS CDK
- Custom matchers for AWS resources
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

## Contributing

We welcome contributions!

## License

This project is licensed under the Apache 2.0 License - see the [LICENSE](LICENSE) file for details.
