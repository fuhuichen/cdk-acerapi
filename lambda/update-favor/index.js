const AWS = require("aws-sdk");
const dynamo = new AWS.DynamoDB();

const argumentErrorResponse = (reason) => ({
    code: 400,
    description: reason,
});

const successResponse = (data) => ({
    code: 0,
    description: "Success",
    data,
});

const SCHEMAS = [{
        name: "mfid", // - (String) The favor ID.
        validate: (value) => {
            return typeof value === "string";
        },
        transform: (value) => ({ S: value }),
    },
    {
        name: "data",
        validate: (value) => {
            return typeof value === "object";
        },
        transform: (value) => ({ S: JSON.stringify(value) }),
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
            ':m': { S: event.body.mfid }
        },
        FilterExpression: '#M = :m',
        ExpressionAttributeNames: { '#M': 'mfid', '#D': 'data' },
        ProjectionExpression: 'mfid, deviceid, #D',
    }).promise()
    if (!Array.isArray(favors.Items) || favors.Items.length !== 1) {
        return argumentErrorResponse('Favor not found')
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
        return argumentErrorResponse("Device already paired by other user");
    }
    const mfid = event.body.mfid;
    const createdAt = Math.floor(+new Date() / 1000).toString();
    const Item = {};
    SCHEMAS.forEach(({ name, transform }) => {
        Item[name] = transform(event.body[name]);
    });
    Item.createdAt = { N: createdAt };
    Item.deviceid = { S: favors.Items[0].deviceid.S }
    await dynamo
        .putItem({
            TableName: "favor",
            Item,
        })
        .promise();
    const favor = event.body;
    favor.mfid = mfid;
    favor.deviceid = favors.Items[0].deviceid.S
    return successResponse(favor);
};
