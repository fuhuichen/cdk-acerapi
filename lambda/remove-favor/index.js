const AWS = require("aws-sdk");
const dynamo = new AWS.DynamoDB();

const argumentErrorResponse = (reason) => ({
    code: 400,
    description: reason,
});

const successResponse = {
    code: 0,
    description: "Success"
};

const isInputValid = (input) => {
    if (!!!input) return false;
    return typeof input.mfid === 'string';
};

exports.handler = async(event, context) => {
    if (isInputValid(event) === false) {
        return argumentErrorResponse("Argument error");
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
    const favors = await dynamo.scan({
        TableName: 'favor',
        ExpressionAttributeValues: {
            ':m': { S: event.mfid }
        },
        FilterExpression: '#M = :m',
        ExpressionAttributeNames: { '#M': 'mfid', '#D': 'data' },
        ProjectionExpression: 'mfid, deviceid, #D',
    }).promise()
    if (!Array.isArray(favors.Items) || favors.Items.length !== 1) {
        return successResponse
    }
    const userDevice = await dynamo.getItem({
        TableName: "user-device",
        Key: {
            deviceid: { S: favors.Items[0].deviceid.S },
            user: { S: event.email }
        },
        ProjectionExpression: "#U, #T",
        ExpressionAttributeNames: { '#U': 'user', '#T': 'type' },
    }).promise();
    if (!!userDevice &&
        !!userDevice.Item &&
        (userDevice.Item.user.S !== event.email || userDevice.Item.type.S === 'share')
    ) {
        return argumentErrorResponse("You are not allowed to edit this device");
    }
    await dynamo.deleteItem({
        TableName: 'favor',
        Key: {
            mfid: { S: event.mfid },
            deviceid: { S: favors.Items[0].deviceid.S }
        }
    }).promise()
    return successResponse;
};
