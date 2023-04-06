const AWS = require('aws-sdk');
const dynamo = new AWS.DynamoDB();
const iot = new AWS.Iot();

const argumentErrorResponse = (reason) => ({
    code: 400,
    description: reason
})

const successResponse = {
    code: 0,
    description: "Success"
}

exports.handler = async(event) => {
    if (!!!event.body || !!!event.body.fullname || !!!event.body.country || !!!event.body.language) {
        return argumentErrorResponse('Argument error')
    }
    const result = await dynamo.getItem({
        TableName: 'user',
        Key: {
            'acc': { S: event.email }
        },
        ProjectionExpression: 'acc'
    }).promise()
    if (!!result.Item) {
        return argumentErrorResponse('User already exists')
    }
    const thingName = event.email.replace('@', 'A').replace(/\./g, 'P')
    const thing = await iot.createThing({ thingName, thingTypeName: 'user' }).promise()
    const certs = await iot.createKeysAndCertificate({ setAsActive: true }).promise()
    await iot.attachPrincipalPolicy({ policyName: 'acerpure', principal: certs.certificateArn }).promise()
    await iot.attachThingPrincipal({ principal: certs.certificateArn, thingName }).promise()
    const Item = {
        'acc': { S: event.email },
        'fullname': { S: event.body.fullname },
        'country': { S: event.body.country },
        'language': { S: event.body.language },
        'enabled': { BOOL: true },
        'thing': { S: JSON.stringify(thing) },
        'certs': { S: JSON.stringify(certs) }
    }
    if (!!event.body.givenname) {
        Item['givenname'] = { S: event.body.givenname }
    }
    if (!!event.body.familyname) {
        Item['familyname'] = { S: event.body.familyname }
    }
    if (!!event.body.accesstype) {
        Item['accesstype'] = { S: event.body.accesstype }
    }
    await dynamo.putItem({
        TableName: 'user',
        Item
    }).promise()
    return successResponse;
};
