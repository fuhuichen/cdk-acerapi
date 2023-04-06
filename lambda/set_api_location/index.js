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
    if (!!!event.body || typeof event.body.name !== 'string' || typeof event.body.geo !== 'string' || /^\d+\.?\d+;\d+\.?\d+$/.test(event.body.geo) === false) {
        return argumentErrorResponse(400, 'Argument error')
    }
    const user = await dynamo
        .getItem({
            TableName: "user",
            Key: {
                acc: { S: event.email },
            },
            ProjectionExpression: "acc, enabled",
        })
        .promise();
    if (!!!user.Item) {
        return argumentErrorResponse("User not signup");
    }
    if (user.Item.enabled.BOOL === false) {
        return argumentErrorResponse("User is disabled");
    }
    console.log(event.email)
    console.log(event.body.name)
    console.log(event.body.geo)
    await dynamo.putItem({
        TableName: 'location',
        Item: {
            'name': { S: event.body.name },
            'geo': { S: event.body.geo }
        }
    }).promise()
    await dynamo.putItem({
        TableName: 'user-location',
        Item: {
            'user': { S: event.email },
            'location': { S: event.body.name }
        }
    }).promise()
    return successResponse;
};
