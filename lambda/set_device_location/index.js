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
    if (!!!event.body || typeof event.body.name !== 'string' || typeof event.body.geo !== 'string' || /^\d+\.?\d+;\d+\.?\d+$/.test(event.body.geo) === false || typeof event.body.deviceid !== 'string') {
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
    console.log(event.body.deviceid)
    console.log(event.body.name)
    console.log(event.body.geo)
    const userDevice = await dynamo.getItem({
        TableName: "user-device",
        Key: {
            deviceid: { S: event.body.deviceid },
            user: { S: event.email }
        },
        ProjectionExpression: "#U, #T",
        ExpressionAttributeNames: { '#U': 'user', '#T': 'type' },
    }).promise();
    if (!!userDevice &&
        !!userDevice.Item &&
        userDevice.Item.user.S !== event.email && userDevice.Item.type.S !== 'owner'
    ) {
        return argumentErrorResponse("Device already paired by other user");
    }

    await dynamo.putItem({
        TableName: 'device-location',
        Item: {
            'deviceid': { S: event.body.deviceid },
            'location': { S: event.body.name }
        }
    }).promise()

    const locations = await dynamo.query({
        TableName: 'location',
        KeyConditionExpression: '#N = :name',
        ExpressionAttributeValues: {
            ":name": {S: event.body.name},
        },
        ExpressionAttributeNames: { '#N': 'name' }
    }).promise()
    // console.log(locations);
    if (!!locations && !!locations.Count && locations.Count > 1) {
        console.log('Location count is ' + locations.Count);
        return successResponse;
    }

    await dynamo.putItem({
        TableName: 'location',
        Item: {
            'name': { S: event.body.name },
            'geo': { S: event.body.geo }
        }
    }).promise()
    // await dynamo.putItem({
    //     TableName: 'device-location',
    //     Item: {
    //         'deviceid': { S: event.body.deviceid },
    //         'location': { S: event.body.name }
    //     }
    // }).promise()
    return successResponse;
};
