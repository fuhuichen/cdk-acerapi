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
    if (!!!event.body || !!!event.body.mfid) {
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
    const responseData = {}
    Object.keys(favors.Items[0]).forEach(key => {
        if (key === 'data') {
            responseData[key] = JSON.parse(favors.Items[0][key].S)
        }
        else {
            responseData[key] = favors.Items[0][key].S
        }
    })
    return successResponse(responseData)
};
