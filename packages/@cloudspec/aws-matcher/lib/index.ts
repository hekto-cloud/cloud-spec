import { expect } from 'vitest';
import { S3Client, HeadObjectCommand, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { SFNClient, StartExecutionCommand, DescribeExecutionCommand } from "@aws-sdk/client-sfn";
import * as diff from 'diff';
import { Upload } from "@aws-sdk/lib-storage";
import { Readable } from "stream";

// Update the type declaration
declare module 'vitest' {
  interface Assertion<T = any> {
    toHaveKey(properties: { key: string }): Promise<void>;
    toCreateObject(properties: { key: string, body: string | Buffer | Readable }): Promise<void>;
    toMatchS3ObjectSnapshot(properties: { key: string }): Promise<void>;
    toCompleteStepFunctionsExecution(payload: any, timeout?: number): Promise<void>;
  }
}

// Define a type for the matcher result
type MatcherResult = {
  pass: boolean;
  message: () => string;
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

function createColorfulDiff(actual: string, expected: string): string {
  const differences = diff.diffLines(expected, actual);
  let colorfulDiff = '';

  differences.forEach((part) => {
    // Green for additions, red for deletions
    // If the value is unchanged, it will be grey
    const color = part.added ? '\x1b[32m' : part.removed ? '\x1b[31m' : '\x1b[90m';
    const prefix = part.added ? '+' : part.removed ? '-' : ' ';
    const lines = part.value.split('\n').filter(line => line.trim() !== '');
    lines.forEach(line => {
      colorfulDiff += `${color}${prefix} ${line}\x1b[0m\n`;
    });
  });

  return colorfulDiff;
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
        // Extract the diff from the error message
        const actualContent = error.actual;
        const expectedContent = error.expected;

        // Create a colorful diff
        const colorfulDiff = createColorfulDiff(actualContent, expectedContent);

        return {
          message: () =>
            `Snapshot for ${key} in S3 bucket ${bucketName} did not match.\n\nDiff:\n${colorfulDiff}`,
          pass: false,
        };
      }
    } catch (error) {
      return {
        message: () => `failed to retrieve ${key} from S3 bucket ${bucketName}: ${error}`,
        pass: false,
      };
    }
  },

  async toCompleteStepFunctionsExecution(received: string, payload: any, timeout: number = 60000): Promise<MatcherResult & { result: any | null }> {
    const stateMachineArn = received;
    const startTime = Date.now();

    // Start the execution
    const startCommand = new StartExecutionCommand({
      stateMachineArn: stateMachineArn,
      input: JSON.stringify(payload)
    });

    let executionArn: string;
    try {
      const startResponse = await sfnClient.send(startCommand);
      executionArn = startResponse.executionArn!;
    } catch (error) {
      return {
        message: () => `Failed to start Step Functions execution: ${error}`,
        pass: false,
        result: null,
      };
    }

    console.log(`Step Functions execution URL: ${getStepFunctionsConsoleUrl(executionArn)}`);

    while (true) {
      const { status, output } = await sfnClient.send(new DescribeExecutionCommand({ executionArn }));

      if (status === 'SUCCEEDED') {
        return {
          message: () => `Step Functions execution completed successfully`,
          pass: true,
          result: JSON.parse(output || '{}'),
        };
      }

      if (['FAILED', 'TIMED_OUT', 'ABORTED'].includes(status!)) {
        return {
          message: () => `Step Functions execution failed with status: ${status}. View details at the URL printed above.`,
          pass: false,
          result: null,
        };
      }

      if (Date.now() - startTime > timeout) {
        return {
          message: () => `Step Functions execution timed out after ${timeout}ms. Current status: ${status}. View details at the URL printed above.`,
          pass: false,
          result: null,
        };
      }

      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  },
};

// Custom assertions
expect.extend(customMatchers);

export { customMatchers };
