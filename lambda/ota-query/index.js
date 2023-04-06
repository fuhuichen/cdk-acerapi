const AWS = require('aws-sdk');
const dynamo = new AWS.DynamoDB();
const docClient = new AWS.DynamoDB.DocumentClient();

const argumentErrorResponse = (reason) => ({
    code: 400,
    description: reason
})

const successResponse = data => ({
    code: 0,
    description: "Success",
    data
})

exports.handler = async(event) => {
    console.log("#---> " + JSON.stringify(event))
    if (typeof event.model !== 'string') {
        return argumentErrorResponse('Argument error')
    }
    const user = await dynamo.getItem({
        TableName: 'user',
        Key: {
            'acc': { S: event.email }
        },
        ProjectionExpression: 'acc, enabled'
    }).promise()
    if (!!!user.Item) {
        return argumentErrorResponse('User not signup')
    }
    if (user.Item.enabled.BOOL === false) {
        return argumentErrorResponse('User is disabled')
    }
    const otas = await docClient.query({
        TableName: "ota",
        KeyConditionExpression: "#M = :m",
        ExpressionAttributeNames: {
            "#M": "model"
        },
        ExpressionAttributeValues: {
            ":m": event.model
        }
    }).promise()
    if (otas.Count !== 1) {
        return argumentErrorResponse("data not found")
    }
    return successResponse(otas.Items[0])
};
