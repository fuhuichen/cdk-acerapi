const AWS = require("aws-sdk");

const dynamo = new AWS.DynamoDB.DocumentClient();
// const dynamo = new AWS.DynamoDB();


/**
 * Demonstrates a simple HTTP endpoint using API Gateway. You have full
 * access to the request and response payload, including headers and
 * status code.
 *
 * To scan a DynamoDB table, make a GET request with the TableName as a
 * query string parameter. To put, update, or delete an item, make a POST,
 * PUT, or DELETE request respectively, passing in the payload to the
 * DynamoDB API as a JSON body.
 */
exports.handler = async (event, context) => {
    // console.log('Received event:', JSON.stringify(event, null, 2));

    let body;
    let statusCode = '200';
    const headers = {
        'Content-Type': 'application/json',
    };

    const params = {
        TableName: 'device',
        Select: "COUNT",
    };

    let report = {};
    let scanResult = {};
    let count = 0;
    try {

        scanResult = await dynamo.scan(params).promise()
        console.log('-----> count: '+JSON.stringify(scanResult));
        while(scanResult.LastEvaluatedKey !== null && scanResult.LastEvaluatedKey !== undefined){
            count+= scanResult.Count;
            params.ExclusiveStartKey = scanResult.LastEvaluatedKey;
            console.log('-----> params: '+JSON.stringify(params));
            // request.setExclusiveStartKey(result.getLastEvaluatedKey());
            scanResult = await dynamo.scan(params).promise()
            console.log('-----> count: '+JSON.stringify(scanResult));
        }


        // const numOfDevices = await dynamo.scan(params).promise()
        // console.log('-----> count: '+numOfDevices);
        report.numberOfPairedDevices = count;
        // switch (event.httpMethod) {
        //     case 'DELETE':
        //         body = await dynamo.delete(JSON.parse(event.body)).promise();
        //         break;
        //     case 'GET':
        //         body = await dynamo.scan({ TableName: event.queryStringParameters.TableName }).promise();
        //         break;
        //     case 'POST':
        //         body = await dynamo.put(JSON.parse(event.body)).promise();
        //         break;
        //     case 'PUT':
        //         body = await dynamo.update(JSON.parse(event.body)).promise();
        //         break;
        //     default:
        //         throw new Error(`Unsupported method "${event.httpMethod}"`);
        // }
    } catch (err) {
        statusCode = '400';
        body = err.message;
    } finally {
        body = JSON.stringify(report);
    }

    return {
        statusCode,
        body,
        headers,
    };
};
