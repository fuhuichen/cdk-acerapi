const AWS = require('aws-sdk');
const dynamo = new AWS.DynamoDB();

const argumentErrorResponse = (code, reason) => ({
    code: 400,
    description: reason
})

const successResponse = {
    code: 0,
    description: "Success"
}

exports.handler = async(event) => {
    if (!!!event.body || !!!event.body.fullname || !!!event.body.country || !!!event.body.language) {
        return argumentErrorResponse(400, 'Argument error')
    }
    const result = await dynamo.getItem({
        TableName: 'user',
        Key: {
            'acc': { S: event.email }
        },
        ProjectionExpression: 'enabled, certs, thing'
    }).promise()
    if (!!!result.Item) {
        return argumentErrorResponse(404, 'User not found')
    }
    const Item = {
        'acc': { S: event.email },
        'fullname': { S: event.body.fullname },
        'country': { S: event.body.country },
        'language': { S: event.body.language },
        'enabled': { BOOL: result.Item.enabled.BOOL },
        'certs': { S: result.Item.certs.S },
        'thing': { S: result.Item.thing.S }
    }
    if (!!event.body.givenname) {
        Item['givenname'] = { S: event.body.givenname }
    }
    if (!!event.body.familyname) {
        Item['familyname'] = { S: event.body.familyname }
    }
    await dynamo.putItem({
        TableName: 'user',
        Item
    }).promise()
    return successResponse;
};
