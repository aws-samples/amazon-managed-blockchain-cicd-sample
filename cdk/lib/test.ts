
// import * as cdk from '@aws-cdk/core';
// import * as CodeBuild from '@aws-cdk/aws-codebuild'
// import * as s3 from '@aws-cdk/aws-s3'
// import * as CodePipeline from '@aws-cdk/aws-codepipeline'
// import * as CodePipelineAction from '@aws-cdk/aws-codepipeline-actions'
// import * as ec2 from '@aws-cdk/aws-ec2'
// import * as lambda from '@aws-cdk/aws-lambda'

// export interface PipelineProps extends cdk.StackProps {
//   chaincodeName: string
//   key: string
// }

// export class Pipeline extends cdk.Stack {
//   constructor(scope: cdk.App, id: string, props: PipelineProps) {
//     super(scope, id, props)
//    const outputSources = new CodePipeline.Artifact()
//     const bucketKey = 'chaincode.zip'

    
//     const bucket = new s3.Bucket(this, 'bucket', { versioned: true
//     });
    

//     // const vpc = ec2.Vpc.fromVpcAttributes(this, 'vpc', {
//     //   vpcId: 'vpc-58574a3e',
//     //   availabilityZones: ['us-east-1'],
//     //   privateSubnetIds: ['subnet-778c2b3f', 'subnet-655c0600', 'subnet-3041d53c']
//     // });

//     // const lambdaFn = new lambda.Function(this, 'ChaincodeDeploy', {
//     //   //code: new lambda.AssetCode('././lambda'),
//     //   code: new lambda.S3Code(bucket, 'lambda.zip'),
//     //   handler: 'index.handler',
//     //   runtime: lambda.Runtime.NODEJS_8_10,
//     //   vpc: vpc,
//     //   environment: {
//     //     CHAINCODENAME: props.chaincodeName,
//     //     KEY: props.key,
//     //     BUCKET: bucket.bucketName
//     //   }
//     // // AWS CodeBuild artifacts
 
//     //});

//     // AWS CodePipeline pipeline
//     const pipeline = new CodePipeline.Pipeline(this, 'pipeline', {
//       pipelineName: 'Fabric CICD',
//       restartExecutionOnUpdate: true,
//     })

//     pipeline.addStage({
//       stageName: 'Source',
//       actions: [
//         new CodePipelineAction.S3SourceAction({
//           actionName: "test",
//           bucket: bucket,
//           bucketKey: bucketKey,
//           output: outputSources,
//         }),
//       ],
//     })

//     pipeline.addStage({
//       stageName: 'Build',
//       actions: [
//         // AWS CodePipeline action to run CodeBuild project
//         new CodePipelineAction.CodeBuildAction({
//           actionName: 'Website',
//           project: new CodeBuild.PipelineProject(this, 'pipeline', {
//             projectName: 'chaincode',
//           }),
//           input: outputSources,
//         }),
//       ],
//     })

//     // pipeline.addStage({
//     //   stageName: 'Deploy',
//     //   actions: [
//     //     // AWS CodePipeline action to deploy CRA website to S3
//     //     new CodePipelineAction.S3DeployAction({
        
//     //     }),
//     //   ],
//     // })

//   }
// }