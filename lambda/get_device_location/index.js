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
    if (!!!event.email || !!!event.body || typeof event.body.deviceid !== 'string') {
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
    const deviceLocation = await dynamo.getItem({
        TableName: 'device-location',
        Key: {
            deviceid: { S: event.body.deviceid }
        },
        ProjectionExpression: '#L',
        ExpressionAttributeNames: { "#L": 'location' },
    }).promise()
    if (!!deviceLocation && !!deviceLocation.Item && typeof deviceLocation.Item.location.S === 'string') {
        const loc = await docClient.query({
            TableName: 'location',
            KeyConditionExpression: '#N = :n',
            ExpressionAttributeValues: {
                ':n': deviceLocation.Item.location.S
            },
            ExpressionAttributeNames: { '#N': 'name' }
        }).promise();
        console.log(loc)
        if (Array.isArray(loc.Items) && loc.Items.length > 0) {
            return successResponse(loc.Items[0])
        }
    }
    return successResponse({
        name: null,
        geo: null
    });
};
