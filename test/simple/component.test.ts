import { cloudSpec } from '@cloudspec/aws-cdk';
import { describe, expect } from 'vitest';
import { Stack } from 'aws-cdk-lib';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { StateMachine, Pass, StateMachineType } from 'aws-cdk-lib/aws-stepfunctions';
import { s3, stepFunctions } from '@cloudspec/aws-toolkit';

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

    // Check that the object doesn't exist initially
    expect(await s3.objectExists({ bucketName, key })).toBe(false);

    // Create the object
    expect(await s3.createObject({ bucketName, key, body: 'hello' })).toBe(true);

    // Check that the object now exists
    expect(await s3.objectExists({ bucketName, key })).toBe(true);

    // Check the object content
    const content = await s3.getObjectContent({ bucketName, key });
    expect(content).toBe('hello');
  });
});

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

    const result = await stepFunctions.execute({ stateMachineArn });
    expect(result.status).toBe('SUCCEEDED');
    expect(result.output).toEqual({ hello: 'world' });
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

    const result = await stepFunctions.execute({ stateMachineArn: expressStateMachineArn });
    expect(result.status).toBe('SUCCEEDED');
    expect(result.output).toEqual({ hello: 'express world' });
  });
});