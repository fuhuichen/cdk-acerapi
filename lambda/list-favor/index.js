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
    if (typeof event.deviceid !== 'string') return argumentErrorResponse('Argument error')
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
            'deviceid': { S: event.deviceid },
            'user': { S: event.email }
        },
        ProjectionExpression: 'deviceid, #U',
        ExpressionAttributeNames: { '#U': 'user' },
    }).promise()
    if (!!userDevice && !!userDevice.Item && userDevice.Item.user.S !== event.email) {
        return argumentErrorResponse('User is not permit to update device info')
    }
    const favors = await dynamo.scan({
        TableName: 'favor',
        ExpressionAttributeValues: {
            ':d': { S: event.deviceid }
        },
        FilterExpression: '#D = :d',
        ExpressionAttributeNames: { '#D': 'deviceid', '#A': 'data' },
        ProjectionExpression: 'mfid, deviceid, #A'
    }).promise()
    if (!Array.isArray(favors.Items)) {
        return successResponse([])
    }
    const responseDatas = favors.Items.map(favor => {
        const responseData = {}
        Object.keys(favor).forEach(key => {
            if (key === 'data') {
                responseData[key] = JSON.parse(favor[key].S)
            }
            else {
                responseData[key] = favor[key].S
            }
        })
        return responseData
    })
    return successResponse(responseDatas)
};
