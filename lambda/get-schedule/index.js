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
    if (!!!event.body || !!!event.body.sid) {
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
    const schedules = await dynamo.scan({
        TableName: 'schedule',
        ExpressionAttributeValues: {
            ':s': { S: event.body.sid }
        },
        FilterExpression: '#S = :s',
        ExpressionAttributeNames: { '#S': 'sid' },
        ProjectionExpression: 'sid, deviceid, tmstart, tmend, wkstart, wkend, start_topic, start_data, end_topic, end_data, createdAt, enabled',
    }).promise()
    if (!Array.isArray(schedules.Items) || schedules.Items.length !== 1) {
        return argumentErrorResponse('Schedule not found')
    }
    const schedule = schedules.Items[0]
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
    return successResponse(responseData)
};
