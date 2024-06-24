import { S3Client, HeadObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { SFNClient, StartExecutionCommand, DescribeExecutionCommand, DescribeStateMachineCommand, StartSyncExecutionCommand } from "@aws-sdk/client-sfn";
import { Upload } from "@aws-sdk/lib-storage";
import { Readable } from "stream";

const region = process.env.AWS_REGION || 'us-east-1';
const sfnClient = new SFNClient({ region });
const s3Client = new S3Client({ region });

export const s3 = {
  objectExists: async ({ bucketName, key }: { bucketName: string; key: string }): Promise<boolean> => {
    const headCommand = new HeadObjectCommand({ Bucket: bucketName, Key: key });
    try {
      await s3Client.send(headCommand);
      return true;
    } catch (error) {
      console.error(`Error checking if object exists: ${error}`);
      return false;
    }
  },
  createObject: async ({ bucketName, key, body }: { bucketName: string; key: string; body: string | Buffer | Readable }): Promise<boolean> => {
    try {
      const upload = new Upload({
        client: s3Client,
        params: { Bucket: bucketName, Key: key, Body: body },
      });
      await upload.done();
      return true;
    } catch (error) {
      console.error(`Error creating object: ${error}`);
      return false;
    }
  },
  getObjectContent: async ({ bucketName, key }: { bucketName: string; key: string }): Promise<string | undefined> => {
    const getCommand = new GetObjectCommand({ Bucket: bucketName, Key: key });
    try {
      const response = await s3Client.send(getCommand);
      return await response.Body?.transformToString();
    } catch (error) {
      console.error(`Error getting object content: ${error}`);
      return undefined;
    }
  },
};

export const stepFunctions = {
  getConsoleUrl: ({ executionArn }: { executionArn: string }): string => {
    try {
      const [, , , region, accountId, executionType, ...rest] = executionArn.split(':');
      const baseUrl = `https://${region}.console.aws.amazon.com/states/home`;
      const params = new URLSearchParams({ region });

      if (executionType === 'express') {
        const startDate = Date.now();
        return `${baseUrl}?${params.toString()}#/express-executions/details/${executionArn}?startDate=${startDate}`;
      } else {
        return `${baseUrl}?${params.toString()}#/v2/executions/details/${executionArn}`;
      }
    } catch (error) {
      console.error('Error parsing execution ARN:', executionArn, error);
      return 'Unable to generate Step Functions console URL';
    }
  },

  execute: async ({ stateMachineArn, input, timeout = 60000 }: { stateMachineArn: string; input?: any; timeout?: number }): Promise<StepFunctionsExecutionResult> => {
    const startTime = Date.now();
    let isExpress: boolean;

    try {
      isExpress = await isExpressStateMachine({ stateMachineArn });
    } catch (error) {
      console.error(`Failed to describe Step Functions state machine: ${error}`);
      throw new Error(`Failed to describe Step Functions state machine: ${error}`);
    }

    return isExpress
      ? executeExpressStepFunctions({ stateMachineArn, input })
      : executeStandardStepFunctions({ stateMachineArn, timeout, startTime, input });
  },
};

async function isExpressStateMachine({ stateMachineArn }: { stateMachineArn: string }): Promise<boolean> {
  try {
    const describeStateMachineCommand = new DescribeStateMachineCommand({ stateMachineArn });
    const stateMachineDetails = await sfnClient.send(describeStateMachineCommand);
    return stateMachineDetails.type === 'EXPRESS';
  } catch (error) {
    console.error(`Error describing state machine: ${error}`);
    throw error;
  }
}

async function executeExpressStepFunctions({ stateMachineArn, input }: { stateMachineArn: string; input?: any }): Promise<StepFunctionsExecutionResult> {
  try {
    const startSyncCommand = new StartSyncExecutionCommand({
      stateMachineArn,
      input: input ? JSON.stringify(input) : undefined
    });
    const syncResponse = await sfnClient.send(startSyncCommand);
    console.log(`Step Functions execution URL: ${stepFunctions.getConsoleUrl({ executionArn: syncResponse.executionArn! })}`);

    return {
      status: syncResponse.status!,
      output: JSON.parse(syncResponse.output || '{}'),
      executionArn: syncResponse.executionArn!,
    };
  } catch (error) {
    console.error(`Error executing express Step Functions: ${error}`);
    throw error;
  }
}

async function executeStandardStepFunctions({ stateMachineArn, timeout, startTime, input }: { stateMachineArn: string; timeout: number; startTime: number; input?: any }): Promise<StepFunctionsExecutionResult> {
  try {
    const startCommand = new StartExecutionCommand({
      stateMachineArn,
      input: input ? JSON.stringify(input) : undefined
    });
    const startResponse = await sfnClient.send(startCommand);
    const executionArn = startResponse.executionArn!;
    console.log(`Step Functions execution URL: ${stepFunctions.getConsoleUrl({ executionArn })}`);

    while (true) {
      const { status, output } = await getExecutionStatus({ executionArn });

      if (['SUCCEEDED', 'FAILED', 'TIMED_OUT', 'ABORTED'].includes(status!)) {
        return {
          status: status!,
          output: JSON.parse(output || '{}'),
          executionArn,
        };
      }

      if (Date.now() - startTime > timeout) {
        return {
          status: 'TIMED_OUT',
          executionArn,
        };
      }

      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  } catch (error) {
    console.error(`Error executing standard Step Functions: ${error}`);
    throw error;
  }
}

async function getExecutionStatus({ executionArn }: { executionArn: string }): Promise<{ status: string, output: string | undefined }> {
  try {
    const { status, output } = await sfnClient.send(new DescribeExecutionCommand({ executionArn }));
    return { status: status!, output };
  } catch (error) {
    console.error(`Error getting execution status: ${error}`);
    throw error;
  }
}

export interface StepFunctionsExecutionResult {
  status: string;
  output?: any;
  executionArn: string;
}
