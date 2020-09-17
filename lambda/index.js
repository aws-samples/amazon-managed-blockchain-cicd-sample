/*
# Copyright 2020 Amazon.com, Inc. or its affiliates. All Rights Reserved.
# 
# Licensed under the Apache License, Version 2.0 (the "License").
# You may not use this file except in compliance with the License.
# A copy of the License is located at
# 
#     http://www.apache.org/licenses/LICENSE-2.0
# 
# or in the "license" file accompanying this file. This file is distributed 
# on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either 
# express or implied. See the License for the specific language governing 
# permissions and limitations under the License.
#
*/


'use strict';

const setupFabricClient = require("./setupFabricClient");
const fs = require('fs');
const logger = require("./logging").getLogger("lambdaFunction");
const AWS = require('aws-sdk');
const config = require("./config");
const secretsmanager = new AWS.SecretsManager({ region: "us-east-1" });
const unzipper = require('unzipper');

AWS.config.update({ region: 'us-east-1' });



async function handler(event, context, callback) {
    
    var codepipeline = new AWS.CodePipeline()
    
    const jobId = event["CodePipeline.job"].id
    const job_data = event['CodePipeline.job']['data']
    
    const version = await getVersion();
    const result = await install(version, job_data)



    console.info("=Returning Result to Codepipeline=")
    
    if (result) {
        var params = {
            jobId: jobId,
        }


        await codepipeline.putJobSuccessResult(params).promise()
        context.succeed("Installed Chaincode Succesfully");
       

    } else {
         
        var params = {
            failureDetails: {
                message: "Failed to deploy Chaincode",
                type: 'JobFailed'
            },
            jobId : jobId,

        };
        
        
        await codepipeline.putJobFailureResult(params).promise()
        context.fail("Failed to deploy chaincode");
    }


};

module.exports = { handler };

// extract S3 credentials from the event
function getS3Credentials(job_data){
    let artifactCredentials = job_data.artifactCredentials;

        return new AWS.S3({
            apiVersion: '2006-03-01',
            accessKeyId: artifactCredentials.accessKeyId,
            secretAccessKey: artifactCredentials.secretAccessKey,
            sessionToken: artifactCredentials.sessionToken,
            signatureVersion: "v4"
        });
}

// get the current version number for the chaincode from secretsmanager
async function getVersion() {
    logger.info("===getVersion start===")
    
    const chaincodeID = config.memberName + config.channelName + config.chaincodeName
    console.log(chaincodeID)
    var version = 0

    try {
        const response = await secretsmanager.getSecretValue({ SecretId: chaincodeID }).promise()
        version = response.SecretString
        logger.info("=Current version is " + version + "=")
    }
    catch (ResourceNotFoundException) {
        logger.info("No previous version found")
        secretsmanager.createSecret({ Name: chaincodeID, SecretString: String(0) }).promise()

    }

    logger.info("===getVersion end===")
    return version;

}




// install our chaincode to Fabric
async function install(version, job_data) {
    logger.info("=== Install Start ===")


    let fabricClient = await setupFabricClient();


    //create gopath directories
    logger.info("=Creating GOPATH=")
    fs.mkdirSync('/tmp/go/src/' + config.chaincodeName, { recursive: true });
    logger.info("=Created /tmp/go=");

    let filepath = '/tmp/' + config.chaincodeNam + '.zip'


    const bucket = job_data["inputArtifacts"][0]["location"]["s3Location"]["bucketName"]
    const key = job_data["inputArtifacts"][0]["location"]["s3Location"]["objectKey"]
    
    
    //download chaincode from S3
    const params = {
        Bucket: bucket,
        Key: key
    };

    logger.info("Downloading Chaincode from S3")

    var file = fs.createWriteStream(filepath);
    
    let s3 = getS3Credentials(job_data)
    await s3.getObject(params).createReadStream().pipe(unzipper.Extract({ path: '/tmp/go/src/' + config.chaincodeName }));
    logger.info("=Downloaded Chaincode=");


    logger.info("=Installing Chaincode to Fabric=")

    let installRequest = {
        targets: ["peer1"],
        chaincodePath: config.chaincodeName,
        chaincodeId: config.chaincodeName,
        chaincodeVersion: String(version)
    }

    const installResult = await fabricClient.installChaincode(installRequest, 2000)


    try {
        if (installResult[0][0].response.status == 200) {
            logger.info("Chaincode installed succesfully")
        }
        else {
            logger.info("Failed to install chaincode")
            logger.info("=== Install End ===")

            return false
        }
    }
    catch (e) {
        logger.info("Failed to install chaincode")
        logger.info(installResult)
        logger.info("=== Install End ===")

        return false
    }


    const new_version = String(Number(version) + 1)

    logger.info("Writing version number to secrets manager")
    const chaincodeID = config.memberName + config.channelName + config.chaincodeName
    secretsmanager.putSecretValue({ SecretId: chaincodeID, SecretString: new_version }).promise()

    logger.info("=== Install End ===")
    return true


}

