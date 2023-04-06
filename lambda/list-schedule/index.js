const AWS = require('aws-sdk');
const dynamo = new AWS.DynamoDB();

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
        userDevice.Item.user.S !== event.email
    ) {
        return argumentErrorResponse("Device already paired by other user");
    }
    const schedules = await dynamo.scan({
        TableName: 'schedule',
        ExpressionAttributeValues: {
            ':d': { S: event.deviceid }
        },
        FilterExpression: '#D = :d',
        ExpressionAttributeNames: { '#D': 'deviceid' },
        ProjectionExpression: 'sid, deviceid, tmstart, tmend, wkstart, wkend, start_topic, start_data, end_topic, end_data, createdAt, enabled'
    }).promise()
    if (!Array.isArray(schedules.Items)) {
        return successResponse([])
    }
    const responseDatas = schedules.Items.map(schedule => {
        const responseData = {}
        Object.keys(schedule).forEach(key => {
            if (key === 'wkstart' || key === 'wkend') {
                responseData[key] = schedule[key].L.map(({ N }) => parseInt(N))
            }
            else if (key === 'createdAt') {
                responseData[key] = parseInt(schedule[key].N)
            }
            else if (key === 'enabled') {
                responseData[key] = schedule[key].BOOL
            }
            else if (key === 'start_data' || key === 'end_data') {
                responseData[key] = JSON.parse(schedule[key].S)
            }
            else {
                responseData[key] = schedule[key].S
            }
        })
        return responseData
    })
    return successResponse(responseDatas)
};
