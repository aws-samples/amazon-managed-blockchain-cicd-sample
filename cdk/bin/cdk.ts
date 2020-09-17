#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { Pipeline } from '../lib/pipeline';



const app = new cdk.App();

// Modify these variables to reflect your Fabric environment
const CA_ENDPOINT =  'ca.m-..................us-east-1.amazonaws.com:30002'
const PEER_ENDPOINT = 'grpc://nd-7..................managedblockchain.us-east-1.amazonaws.com:30003'
const ORDERER_ENDPOINT = 'grpc://orderer.................amazonaws.com:30001'
const CHANNEL_NAME = 'mychannel';
const MSP = 'm-.................'
const MEMBERNAME = 'mymember'


// This is the ID of the VPC that you will deploy the lambda function to
const VPCID = 'vpc-.................'

// This is the account number that you are going to use to deploy the app
const ACCNUM = '.................'

new Pipeline(app, 'Fabric-CICD', { env: {account: ACCNUM, region: 'us-east-1'},
            vpcid: VPCID, 
            chaincodeName: 'forex', 
            CA_ENDPOINT: CA_ENDPOINT,
            PEER_ENDPOINT: PEER_ENDPOINT,
            ORDERER_ENDPOINT: ORDERER_ENDPOINT,
            CHANNEL_NAME: CHANNEL_NAME,
            MSP: MSP,
            MEMBERNAME: MEMBERNAME
        });