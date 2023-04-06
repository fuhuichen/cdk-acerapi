const AWS = require('aws-sdk')
const dynamo = new AWS.DynamoDB();

const argumentErrorResponse = (reason) => ({
    code: 400,
    description: reason,
});

const successResponse = data => ({
    code: 0,
    description: "Success",
    data
});

const SCHEMAS = [{
        name: "deviceid",
        validate: (value) => {
            return typeof value === "string";
        }
    }
];

const isInputValid = (input) => {
    if (!!!input) return false;
    for (let i = 0; i < SCHEMAS.length; i++) {
        const { name, validate } = SCHEMAS[i];
        if (validate(input[name]) === false) return false;
    }
    return true;
};

exports.handler = async(event, context) => {
    if (isInputValid(event.body) === false) {
        return argumentErrorResponse("Argument error");
    }
    console.log(event.email)
	console.log(event.body.deviceid)
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
        ProjectionExpression: "#U",
        ExpressionAttributeNames: { '#U': 'user' },
    }).promise();
    if (!!!userDevice ||
        !!!userDevice.Item ||
        userDevice.Item.user.S !== event.email
    ) {
        return argumentErrorResponse("Device already paired by other user");
    }
    const deviceStatus = await dynamo.getItem({
        TableName: "device-state",
        Key: {
            deviceid: { S: event.body.deviceid }
        },
        ProjectionExpression: "#S, #D",
        ExpressionAttributeNames: { '#S': 'status', '#D': 'data' },
    }).promise();
    const responseData = {
        status: 'offline',
        data: {}
    }
    if (!!deviceStatus && !!deviceStatus.Item) {
        if (!!deviceStatus.Item.status && !!deviceStatus.Item.status.S) {
            responseData.status = deviceStatus.Item.status.S
        }
        if (!!deviceStatus.Item.data && typeof deviceStatus.Item.data.S === 'string') {
            responseData.data = JSON.parse(deviceStatus.Item.data.S)
			console.log(responseData.data)
        }
    }
    return successResponse(responseData)
};
