import { cloudSpec } from '@cloudspec/aws-cdk';
import { describe, expect } from 'vitest';
import { Stack } from 'aws-cdk-lib';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { StateMachine, Pass, StateMachineType } from 'aws-cdk-lib/aws-stepfunctions';
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
    await expect(bucketName).not.toHaveKey({ key })
    await expect(bucketName).toCreateObject({ key, body: 'hello' });
    await expect(bucketName).toHaveKey({ key });
    await expect(bucketName).toMatchS3ObjectSnapshot({ key });
  });
})

describe('Step Function Tests', () => {
  cloud.setup((stack: Stack, setOutputs) => {
    const simpleSfn = new StateMachine(stack, 'SimpleStateMachine', {
      definition: new Pass(stack, 'HelloWorldPass', {
        result: { value: { hello: 'world' } },
      }),
    });

    setOutputs({
      stateMachineArn: simpleSfn.stateMachineArn,
    });
  });

  cloud.test('state machine should return hello world', async (outputs) => {
    const { stateMachineArn } = outputs;

    await expect(stateMachineArn)
      .toCompleteStepFunctionsExecution({ result: {
        hello: 'world'
      }});
  });
});

describe('Express Step Function Tests', () => {
  cloud.setup((stack: Stack, setOutputs) => {
    const expressSfn = new StateMachine(stack, 'ExpressStateMachine', {
      stateMachineType: StateMachineType.EXPRESS,
      definition: new Pass(stack, 'ExpressHelloWorldPass', {
        result: { value: { hello: 'express world' } },
      }),
    });

    setOutputs({
      expressStateMachineArn: expressSfn.stateMachineArn,
    });
  });

  cloud.test('express state machine should return hello express world', async (outputs) => {
    const { expressStateMachineArn } = outputs;

    await expect(expressStateMachineArn)
      .toCompleteStepFunctionsExecution({ result: {
        hello: 'express world'
      }});
  });
});