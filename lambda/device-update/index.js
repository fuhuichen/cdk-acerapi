const AWS = require('aws-sdk');
const dynamo = new AWS.DynamoDB();
const iot = new AWS.Iot();

const argumentErrorResponse = (reason) => ({
    code: 400,
    description: reason
})

const successResponse = {
    code: 0,
    description: "Success",
    data: {
        "modifiedCount": 1,
        "upsertedCount": 0,
        "matchedCount": 1,
        "upsertedId": null
    }
}

exports.handler = async(event) => {
    if (!!!event.body || !!!event.body.deviceid || !!!event.body.model || !!!event.body.devicename || !!!event.body.city || !!!event.body.timezone || !!!event.body.inlocation || !!!event.body.outlocation || !!!event.body.mainfw || !!!event.body.commfw || typeof event.body.notify !== 'boolean') {
        return argumentErrorResponse('Argument error')
    }
    const device = event.body
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
            'user': { S: event.email },
            'type': { S: 'owner' }
        },
        ProjectionExpression: 'user'
    })
    if (!!userDevice && !!userDevice.Item && userDevice.Item.user.S !== event.email) {
        return argumentErrorResponse('You are not device owner')
    }
    const findDevice = await dynamo.getItem({
        TableName: 'device',
        Key: {
            'deviceid': { S: event.body.deviceid }
        },
        ProjectionExpression: 'certs'
    }).promise()
    if (!!!findDevice.Item) {
        return argumentErrorResponse('Device not exists')
    }
    else {
        const Item = {}
        Object.keys(event.body).forEach(key => {
            if (key === 'notify') {
                Item[key] = { BOOL: event.body[key] }
            }
            else {
                Item[key] = { S: event.body[key] }
            }
        })
        Item.certs = { S: findDevice.Item.certs.S }
        await dynamo.putItem({
            TableName: 'device',
            Item
        }).promise()
    }
    return successResponse
};
