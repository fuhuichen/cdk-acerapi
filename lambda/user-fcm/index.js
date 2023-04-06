const AWS = require('aws-sdk');
const dynamo = new AWS.DynamoDB();

const argumentErrorResponse = (reason) => ({
    code: 400,
    description: reason
})

const successResponse = {
    code: 0,
    description: "Success"
}

exports.handler = async(event) => {
    if (typeof event.fcm !== 'string' || !!!event.email) {
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
    await dynamo.putItem({
        TableName: 'user-fcm',
        Item: {
            user: { S: event.email },
            fcm: { S: event.fcm || '' },
            enabled: { BOOL: true }
        }
    }).promise()
    return successResponse;
};
