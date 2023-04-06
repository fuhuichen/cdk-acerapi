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

exports.handler = async (event) => {
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

    const otas = await docClient.scan({
        TableName: "ota_models"
    }).promise()
    if (Array.isArray(otas.Items) === false) return argumentErrorResponse('Unexpected fail')
    if (otas.Count <= 0) {
        return argumentErrorResponse("data not found")
    }
    return successResponse(otas.Items)
};
