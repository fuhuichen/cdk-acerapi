const AWS = require('aws-sdk');
const dynamo = new AWS.DynamoDB();

const argumentErrorResponse = (code, reason) => ({
    code: 400,
    description: reason
})

const successResponse = {
    code: 0,
    description: "Success"
}

exports.handler = async(event) => {
    if (!!!event.body) {
        return argumentErrorResponse(400, 'Argument error')
    }
    const result = await dynamo.getItem({
        TableName: 'user',
        Key: {
            'acc': { S: event.email }
        },
        ProjectionExpression: 'fullname, givenname, familyname, country, #L, enabled',
        ExpressionAttributeNames: { '#L': 'language' }
    }).promise()
    if (!!!result.Item) {
        return argumentErrorResponse(404, 'User not found')
    }
    await dynamo.updateItem({
        TableName: 'user',
        Key: {
            "acc": {
                S: event.email
            }
        },
        UpdateExpression: "SET #E = :e",
        ExpressionAttributeNames: {
            "#E": "enabled"
        },
        ExpressionAttributeValues: {
            ":e": {
                BOOL: typeof event.body.enabled === 'boolean'?event.body.enabled:(!!event.body.enabled || false)
            }
        },
    }).promise()
    return successResponse;
};
