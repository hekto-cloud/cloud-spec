import { expect } from 'vitest';
import { S3Client, HeadObjectCommand, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { SFNClient, StartExecutionCommand, DescribeExecutionCommand } from "@aws-sdk/client-sfn";
import { Upload } from "@aws-sdk/lib-storage";
import { Readable } from "stream";

// Update the type declaration
declare module 'vitest' {
  interface Assertion<T = any> {
    toHaveKey(properties: { key: string }): Promise<void>;
    toCreateObject(properties: { key: string, body: string | Buffer | Readable }): Promise<void>;
    toMatchS3ObjectSnapshot(properties: { key: string }): Promise<void>;
    toCompleteStepFunctionsExecution(properties?: { input?: any, timeout?: number, result?: any }): Promise<{ pass: boolean; message: () => string; actual?: any; expected?: any }>;
  }
}

// Update the MatcherResult type
type MatcherResult = {
  pass: boolean;
  message: () => string;
  actual?: any;
  expected?: any;
};

const region = process.env.AWS_REGION || 'us-east-1';
const sfnClient = new SFNClient({ region });
const s3Client = new S3Client({ region });

function getStepFunctionsConsoleUrl(executionArn: string): string {
  try {
    const [, , , region] = executionArn.split(':');
    const baseUrl = `https://${region}.console.aws.amazon.com/states/home`;
    const params = new URLSearchParams({ region });
    return `${baseUrl}?${params.toString()}#/v2/executions/details/${executionArn}`;
  } catch (error) {
    console.error('Error parsing execution ARN:', executionArn, error);
    return 'Unable to generate Step Functions console URL';
  }
}

// Custom matchers
const customMatchers = {
  async toHaveKey(received: string, properties: { key: string }): Promise<MatcherResult> {
    const { key } = properties;
    const bucketName = received;
    const headCommand = new HeadObjectCommand({ Bucket: bucketName, Key: key });
    try {
      await s3Client.send(headCommand);
      return {
        message: () => `expected ${key} to exist in S3 bucket ${bucketName}`,
        pass: true,
      };
    } catch (error) {
      return {
        message: () => `expected ${key} to exist in S3 bucket ${bucketName}`,
        pass: false,
      };
    }
  },

  async toCreateObject(received: string, properties: { key: string, body: string | Buffer | Readable }): Promise<MatcherResult> {
    const { key, body } = properties;
    const bucketName = received;
    const s3Client = new S3Client({});

    try {
      const upload = new Upload({
        client: s3Client,
        params: {
          Bucket: bucketName,
          Key: key,
          Body: body,
        },
      });

      await upload.done();

      return {
        pass: true,
        message: () => `Successfully created object with key ${key} in bucket ${bucketName}`,
      };
    } catch (error) {
      return {
        pass: false,
        message: () => `Failed to create object with key ${key} in bucket ${bucketName}: ${error}`,
      };
    }
  },

  async toMatchS3ObjectSnapshot(received: string, properties: { key: string }): Promise<MatcherResult> {
    const { key } = properties;
    const bucketName = received;
    const getCommand = new GetObjectCommand({ Bucket: bucketName, Key: key });
    try {
      const response = await s3Client.send(getCommand);
      const content = await response.Body?.transformToString();

      if (content === undefined) {
        return {
          message: () => `failed to retrieve content from ${key} in S3 bucket ${bucketName}`,
          pass: false,
        };
      }

      // Use Vitest's expect().toMatchSnapshot() for comparison
      try {
        expect(content).toMatchSnapshot();
        return {
          message: () => `expected ${key} content to match snapshot in S3 bucket ${bucketName}`,
          pass: true,
        };
      } catch (error: any) {
        return {
          message: () => `Snapshot for ${key} in S3 bucket ${bucketName} did not match.`,
          pass: false,
          actual: content,
          expected: error.expected,
        };
      }
    } catch (error) {
      return {
        message: () => `failed to retrieve ${key} from S3 bucket ${bucketName}: ${error}`,
        pass: false,
      };
    }
  },

  async toCompleteStepFunctionsExecution(received: string, properties?: { input?: any, timeout?: number, result?: any }): Promise<{ pass: boolean; message: () => string; actual?: any; expected?: any }> {
    const stateMachineArn = received;
    const { input, timeout = 60000, result: expectedResult } = properties || {};
    const startTime = Date.now();

    // Start the execution
    const startCommand = new StartExecutionCommand({
      stateMachineArn: stateMachineArn,
      input: input ? JSON.stringify(input) : undefined
    });

    let executionArn: string;
    try {
      const startResponse = await sfnClient.send(startCommand);
      executionArn = startResponse.executionArn!;
    } catch (error) {
      return {
        message: () => `Failed to start Step Functions execution: ${error}`,
        pass: false,
      };
    }

    console.log(`Step Functions execution URL: ${getStepFunctionsConsoleUrl(executionArn)}`);

    while (true) {
      const { status, output } = await sfnClient.send(new DescribeExecutionCommand({ executionArn }));

      if (status === 'SUCCEEDED') {
        const actualResult = JSON.parse(output || '{}');

        if (expectedResult !== undefined) {
          const pass = JSON.stringify(actualResult) === JSON.stringify(expectedResult);
          return {
            message: () => pass
              ? `Step Functions execution completed successfully and result matches expected`
              : `Step Functions execution completed successfully but result does not match expected`,
            pass,
            actual: actualResult,
            expected: expectedResult,
          };
        }

        return {
          message: () => `Step Functions execution completed successfully`,
          pass: true,
        };
      }

      if (['FAILED', 'TIMED_OUT', 'ABORTED'].includes(status!)) {
        return {
          message: () => `Step Functions execution failed with status: ${status}. View details at the URL printed above.`,
          pass: false,
        };
      }

      if (Date.now() - startTime > timeout) {
        return {
          message: () => `Step Functions execution timed out after ${timeout}ms. Current status: ${status}. View details at the URL printed above.`,
          pass: false,
        };
      }

      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  },
};

// Custom assertions
expect.extend(customMatchers);

export { customMatchers };
