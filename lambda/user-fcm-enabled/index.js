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
    if (!!!event.email || typeof event.enabled !== 'boolean') {
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
    const userFCM = await dynamo.getItem({
        TableName: 'user-fcm',
        Key: {
            'user': { S: event.email }
        },
        ProjectionExpression: 'user'
    })
    if (!!userFCM && !!userFCM.Item && userFCM.Item.user.S !== event.email) {
        return argumentErrorResponse('Your fcm token not set')
    }
    await dynamo.updateItem({
        TableName: 'user-fcm',
        Key: {
            "user": {
                S: event.email
            }
        },
        UpdateExpression: "SET #E = :e",
        ExpressionAttributeNames: {
            "#E": "enabled"
        },
        ExpressionAttributeValues: {
            ":e": {
                BOOL: event.enabled
            }
        },
    }).promise()
    return successResponse
};
