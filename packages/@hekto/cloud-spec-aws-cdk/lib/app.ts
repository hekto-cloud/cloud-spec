#!/usr/bin/env node
import 'source-map-support/register'
import * as cdk from 'aws-cdk-lib'
import { Construct } from 'constructs'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { createHash } from 'crypto'

class TestStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props)
  }
}
export type Outputs = Record<string, any>

export interface CreateTestAppProps {
  name?: string
  outdir?: string
  creator?: (app: cdk.Stack, outputs: (outputs: Outputs) => Outputs) => void
}

export interface TestAppConfig {
  stackName: string
  outDir: string
  testDir: string
  stack: TestStack,
  outputs: Outputs
}

export const createTestApp = (props: CreateTestAppProps): TestAppConfig => {
  const testPath = expect.getState().testPath

  if (!testPath) {
    throw new Error('Jest test path not found')
  }

  // create tmp dir
  const outdir = props.outdir || fs.mkdtempSync(path.join(os.tmpdir(), 'cdk-test-app-'))
  const digest = createHash('sha256').update(testPath).digest('hex').substr(0, 8)
  const defaultName = `TestStack-${process.env.GITHUB_REF_NAME || process.env.USER}-${digest}`

  const { name = defaultName, creator } = props

  // replace all non-alphanumeric characters with '-'
  const stackName = name.replace(/[^a-zA-Z0-9]/g, '-')

  const app = new cdk.App({ outdir })
  const stack = new TestStack(app, stackName, {})
  stack.tags.setTag('Test', 'true')
  stack.tags.setTag('TestPath', testPath)

  let stackOutputs: Outputs = {}

  const outputsHandler = (outputs: Outputs) => {
    for (const [key, value] of Object.entries(outputs)) {
      new cdk.CfnOutput(stack, key, { value })
    }

    stackOutputs = outputs;

    return outputs
  }

  creator?.(stack, outputsHandler)
  app.synth()
  return {
    outDir: outdir,
    stackName,
    testDir: path.dirname(testPath),
    outputs: stackOutputs,
    stack
  }
}
