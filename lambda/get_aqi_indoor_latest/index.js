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
    if (typeof event.deviceid !== 'string') {
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
    const userDevice = await dynamo.getItem({
        TableName: "user-device",
        Key: {
            deviceid: { S: event.deviceid },
            user: { S: event.email }
        },
        ProjectionExpression: "#U, #T",
        ExpressionAttributeNames: { '#U': 'user', '#T': 'type' },
    }).promise();
    if (!!userDevice &&
        !!userDevice.Item &&
        (userDevice.Item.user.S !== event.email)
    ) {
        return argumentErrorResponse('User is not permited')
    }
    const datas = await docClient.query({
        TableName: 'aqi_indoor',
        KeyConditionExpression: "deviceid = :d",
        ExpressionAttributeValues: {
            ":d": event.deviceid
        },
        ProjectionExpression: '#T, #D',
        ExpressionAttributeNames: { '#T': 'timestamp', '#D': 'data' },
        Limit: 1,
        ScanIndexForward: false

    }).promise()
    if (!Array.isArray(datas.Items)) {
        return successResponse(null)
    }
    const responseDatas = datas.Items.map(data => {
        const responseData = JSON.parse(data.data)
        responseData.timestamp = data.timestamp
        return responseData
    })
    return successResponse(responseDatas.length === 0 ? null : responseDatas[0])
};
