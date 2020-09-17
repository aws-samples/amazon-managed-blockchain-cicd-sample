
import * as cdk from '@aws-cdk/core';
import * as CodeBuild from '@aws-cdk/aws-codebuild'
import * as s3 from '@aws-cdk/aws-s3'
import * as CodePipeline from '@aws-cdk/aws-codepipeline'
import * as CodeCommit from '@aws-cdk/aws-codecommit'
import * as CodePipelineAction from '@aws-cdk/aws-codepipeline-actions'
import * as ec2 from '@aws-cdk/aws-ec2'
import * as lambda from '@aws-cdk/aws-lambda'
import * as iam from '@aws-cdk/aws-iam'

import { Duration } from '@aws-cdk/core';

export interface PipelineProps extends cdk.StackProps {
  vpcid: string
  chaincodeName: string
  CA_ENDPOINT: string
  PEER_ENDPOINT: string
  ORDERER_ENDPOINT: string
  CHANNEL_NAME: string
  MSP: string
  MEMBERNAME: string
}

export class Pipeline extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props: PipelineProps) {
    super(scope, id, props)

    // AWS CodePipeline pipeline
    const pipeline = new CodePipeline.Pipeline(this, 'Pipeline', {
      pipelineName: 'AMB-Fabric-CICD',
      restartExecutionOnUpdate: true,
    })


    // AWS CodeBuild artifacts
    const buildSource = new CodePipeline.Artifact()
    const zippedSource = new CodePipeline.Artifact()

    //the repo where we will commit our chaincode
    const repo = new CodeCommit.Repository(this, 'Repository', {
      repositoryName: 'ChaincodeSource',
    })

    // the VPC that we will import from a parameter and use to deploy our Lambda in
    const vpc = ec2.Vpc.fromLookup(this, 'ExternalVpc', {
      vpcId: props.vpcid,
    });

    // private subnets for the lambda
    new cdk.CfnOutput(this, 'PrivateSubnets', { value: 'ids:' + vpc.privateSubnets.map(s => s.subnetId).join(',') });

    // Route table IDs
    new cdk.CfnOutput(this, 'PublicRouteTables', { value: 'ids: ' + vpc.publicSubnets.map(s => s.routeTable.routeTableId).join(', ') });



    const lambdaRole = new iam.Role(this, 'LambdaRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
    });


    //  the IAM policies required to allow our Lambda function to run in a VPC
    // these are required to be wildcard policies
    lambdaRole.addToPolicy(new iam.PolicyStatement({
      resources: ['*'],
      actions: [  
        'ec2:CreateNetworkInterface',
        'ec2:DescribeNetworkInterfaces', 'ec2:DeleteNetworkInterface', 
        'ec2:DescribeVpcs', 'ec2:DescribeSubnets',
        'ec2:DescribeSecurityGroups', 'secretsmanager:CreateSecret']
    }));

    // this is the name of the secret used to store the current version of chaincode
    // it is concatenated from the names of the member, channel, and chaincode
    const secretName = props.MEMBERNAME + props.CHANNEL_NAME + props.chaincodeName

    // policies for secrets manager, scoped to only the secrets created by this stack
    lambdaRole.addToPolicy(new iam.PolicyStatement({
      resources: [`arn:aws:secretsmanager:us-east-1:${this.account}:secret:${secretName}*`, "arn:aws:secretsmanager:us-east-1:*:secret:dev/fabricOrgs/*"],
      actions: ['secretsmanager:GetSecretValue', 'secretsmanager:PutSecretValue']
    }));

    // // permissions for Lambda write logs to cloudwatch logs
    // lambdaRole.addToPolicy(new iam.PolicyStatement({
    //   resources: ['*'],
    //   actions: ['logs:CreateLogGroup', 'logs:PutLogEvents', 'logs:CreateLogStream', 'logs:DescribeLogStreams']
    // }));

    const lambdaLogsManagedPolicy = iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole")
    lambdaRole.addManagedPolicy(lambdaLogsManagedPolicy);

    const vpcLogsManagedPolicy = iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaVPCAccessExecutionRole")
    lambdaRole.addManagedPolicy(vpcLogsManagedPolicy);

  
    // permissions for Lambda to write success/fail to CodePipeline
    let policy = new iam.Policy(this, "CodePipelinePolicy", {})
    lambdaRole.attachInlinePolicy(policy)
    policy.addStatements(new iam.PolicyStatement({resources: [pipeline.pipelineArn],
    actions: ['codepipeline:PutJobSuccessResult', 'codepipeline:PutJobFailureResult']}));

    // Our custom lambda function that will install Chaincode
    const lambdaFn = new lambda.Function(this, 'ChaincodeInstall', {
      code: lambda.Code.fromAsset('../lambda'),
      handler: 'index.handler',
      runtime: lambda.Runtime.NODEJS_10_X,
      role: lambdaRole,
      timeout: Duration.seconds(20),
      vpc: vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE, onePerAz: true },
      environment: {
        CHAINCODE_NAME: props.chaincodeName,
        CA_ENDPOINT: props.CA_ENDPOINT,
        PEER_ENDPOINT: props.PEER_ENDPOINT,
        ORDERER_ENDPOINT: props.ORDERER_ENDPOINT,
        CHANNEL_NAME: props.CHANNEL_NAME,
        MSP: props.MSP,
        MEMBERNAME: props.MEMBERNAME,
        GOPATH: '/tmp/go/'
      }
    });


    //the three stages of our CodePipeline Pipeline
    pipeline.addStage({
      stageName: 'Source',
      actions: [
        //codecommit as source
        new CodePipelineAction.CodeCommitSourceAction({
          actionName: 'CodeCommit',
          repository: repo,
          output: buildSource,
        }),
      ],
    })

    pipeline.addStage({
      stageName: 'Build',
      actions: [
        //codebuild to run tests
        new CodePipelineAction.CodeBuildAction({
          actionName: 'ChaincodeTest',
          project: new CodeBuild.PipelineProject(this, 'InstallChaincode', {
            projectName: 'AMB-CICD',
          }),
          input: buildSource,
          outputs: [zippedSource]
        }),
      ],
    })

    pipeline.addStage({
      stageName: 'Deploy',
      actions: [
        // lambda to install
        new CodePipelineAction.LambdaInvokeAction({
          actionName: "deploy",
          lambda: lambdaFn,
          inputs: [zippedSource],
        }),
      ],
    })

  }
}
