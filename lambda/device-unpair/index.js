const AWS = require('aws-sdk');
const dynamo = new AWS.DynamoDB();
const eventbridge = new AWS.EventBridge();

const argumentErrorResponse = (reason) => ({
    code: 400,
    description: reason
})

const successResponse = {
    code: 0,
    description: "Success"
}

const removeFavors = async deviceid => {
    const favors = await dynamo.scan({
        TableName: 'favor',
        ExpressionAttributeValues: {
            ':d': { S: deviceid }
        },
        FilterExpression: '#D = :d',
        ExpressionAttributeNames: { '#D': 'deviceid', '#M': 'mfid' },
        ProjectionExpression: '#M'
    }).promise()
    if (Array.isArray(favors.Items) && favors.Items.length > 0) {
        for (let idx = 0; idx < favors.Items.length; idx++) {
            const item = favors.Items[idx]
            await dynamo.deleteItem({
                TableName: 'favor',
                Key: {
                    mfid: { S: item.mfid.S },
                    deviceid: { S: deviceid }
                }
            }).promise()
        }
    }
}

const removeSchedules = async deviceid => {
    const schedules = await dynamo.scan({
        TableName: 'schedule',
        ExpressionAttributeValues: {
            ':d': { S: deviceid }
        },
        FilterExpression: '#D = :d',
        ExpressionAttributeNames: { '#D': 'deviceid' },
        ProjectionExpression: 'sid, deviceid, tmstart, tmend, wkstart, wkend, start_topic, start_data, end_topic, end_data, createdAt, enabled'
    }).promise()
    if (Array.isArray(schedules.Items) && schedules.Items.length > 0) {
        for (let idx = 0; idx < schedules.Items.length; idx++) {
            const item = schedules.Items[idx]
            await dynamo.deleteItem({
                TableName: 'schedule',
                Key: {
                    sid: { S: item.sid.S },
                    deviceid: { S: deviceid },
                }
            }).promise()
            const start_rule = `${item.sid.S}_start`
            await eventbridge.removeTargets({ Ids: [`${start_rule}-target`], Rule: start_rule }).promise()
            await eventbridge.deleteRule({ Name: start_rule }).promise()
            const end_rule = `${item.sid.S}_end`;
            await eventbridge.removeTargets({ Ids: [`${end_rule}-target`], Rule: end_rule }).promise()
            await eventbridge.deleteRule({ Name: end_rule }).promise()
        }
    }
}

const removeShares = async deviceid => {
    const userDevices = await dynamo.scan({
        TableName: 'user-device',
        ExpressionAttributeValues: {
            ':d': { S: deviceid },
            ':t': { S: 'share' }
        },
        FilterExpression: '#D = :d and #T = :t',
        ExpressionAttributeNames: { '#D': 'deviceid', '#T': 'type', '#U': 'user' },
        ProjectionExpression: '#U, #D'
    }).promise()
    if (Array.isArray(userDevices.Items) && userDevices.Items.length > 0) {
        for (let idx = 0; idx < userDevices.Items.length; idx++) {
            const item = userDevices.Items[idx]
            await dynamo.deleteItem({
                TableName: 'user-device',
                Key: {
                    user: { S: item.user.S },
                    deviceid: { S: item.deviceid.S }
                }
            }).promise()
        }
    }
}

exports.handler = async(event) => {
    if (typeof event.body.deviceid !== 'string') {
        return argumentErrorResponse('Argument error')
    }
    console.log(event.email)
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
        TableName: 'user-device',
        Key: {
            'deviceid': { S: event.body.deviceid },
            'user': { S: event.email }
        },
        ProjectionExpression: 'deviceid, #T',
        ExpressionAttributeNames: { '#T': 'type' },
    }).promise()
    if (!!!userDevice.Item) {
        return successResponse
    }
    const findDevice = await dynamo.getItem({
        TableName: 'device',
        Key: {
            'deviceid': { S: event.body.deviceid }
        },
        ProjectionExpression: 'deviceid'
    }).promise()
    if (!!!findDevice.Item) {
        return successResponse
    }
    if (userDevice.Item.type.S === 'owner') {
        // remove share
        await removeShares(event.body.deviceid)
        // remove favors
        await removeFavors(event.body.deviceid)
        // remove schedules
        await removeSchedules(event.body.deviceid)
    }
    await dynamo.deleteItem({
        TableName: 'user-device',
        Key: {
            user: { S: event.email },
            deviceid: { S: event.body.deviceid }
        }
    }).promise()
    return successResponse
};
