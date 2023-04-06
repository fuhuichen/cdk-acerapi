const AWS = require("aws-sdk");
const dynamo = new AWS.DynamoDB();
const eventbridge = new AWS.EventBridge();
const lambda = new AWS.Lambda();

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
    return typeof input.sid === 'string';
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
    const schedules = await dynamo.scan({
        TableName: 'schedule',
        ExpressionAttributeValues: {
            ':s': { S: event.sid }
        },
        FilterExpression: '#S = :s',
        ExpressionAttributeNames: { '#S': 'sid' },
        ProjectionExpression: 'sid, deviceid, tmstart, tmend, wkstart, wkend, start_topic, start_data, end_topic, end_data, createdAt, enabled',
    }).promise()
    if (!Array.isArray(schedules.Items) || schedules.Items.length !== 1) {
        return argumentErrorResponse('Schedule not found')
    }
    const userDevice = await dynamo.getItem({
        TableName: "user-device",
        Key: {
            deviceid: { S: schedules.Items[0].deviceid.S },
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
        TableName: 'schedule',
        Key: {
            sid: { S: event.sid },
            deviceid: { S: schedules.Items[0].deviceid.S },
        }
    }).promise()
    const start_rule = `${event.sid}_start`
    await eventbridge.removeTargets({ Ids: [`${start_rule}-target`], Rule: start_rule }).promise()
    await eventbridge.deleteRule({ Name: start_rule }).promise()
    const end_rule = `${event.sid}_end`;
    await eventbridge.removeTargets({ Ids: [`${end_rule}-target`], Rule: end_rule }).promise()
    await eventbridge.deleteRule({ Name: end_rule }).promise()
    return successResponse;
};
