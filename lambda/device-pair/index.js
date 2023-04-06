const AWS = require('aws-sdk');
const dynamo = new AWS.DynamoDB();
const iot = new AWS.Iot();
const eventbridge = new AWS.EventBridge();

const endpoint = 'aecv2cgzfn96o-ats.iot.ap-southeast-1.amazonaws.com'
const RootCA = "-----BEGIN CERTIFICATE-----\nMIIDQTCCAimgAwIBAgITBmyfz5m/jAo54vB4ikPmljZbyjANBgkqhkiG9w0BAQsF\nADA5MQswCQYDVQQGEwJVUzEPMA0GA1UEChMGQW1hem9uMRkwFwYDVQQDExBBbWF6\nb24gUm9vdCBDQSAxMB4XDTE1MDUyNjAwMDAwMFoXDTM4MDExNzAwMDAwMFowOTEL\nMAkGA1UEBhMCVVMxDzANBgNVBAoTBkFtYXpvbjEZMBcGA1UEAxMQQW1hem9uIFJv\nb3QgQ0EgMTCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBALJ4gHHKeNXj\nca9HgFB0fW7Y14h29Jlo91ghYPl0hAEvrAIthtOgQ3pOsqTQNroBvo3bSMgHFzZM\n9O6II8c+6zf1tRn4SWiw3te5djgdYZ6k/oI2peVKVuRF4fn9tBb6dNqcmzU5L/qw\nIFAGbHrQgLKm+a/sRxmPUDgH3KKHOVj4utWp+UhnMJbulHheb4mjUcAwhmahRWa6\nVOujw5H5SNz/0egwLX0tdHA114gk957EWW67c4cX8jJGKLhD+rcdqsq08p8kDi1L\n93FcXmn/6pUCyziKrlA4b9v7LWIbxcceVOF34GfID5yHI9Y/QCB/IIDEgEw+OyQm\njgSubJrIqg0CAwEAAaNCMEAwDwYDVR0TAQH/BAUwAwEB/zAOBgNVHQ8BAf8EBAMC\nAYYwHQYDVR0OBBYEFIQYzIU07LwMlJQuCFmcx7IQTgoIMA0GCSqGSIb3DQEBCwUA\nA4IBAQCY8jdaQZChGsV2USggNiMOruYou6r4lK5IpDB/G/wkjUu0yKGX9rbxenDI\nU5PMCCjjmCXPI6T53iHTfIUJrU6adTrCC2qJeHZERxhlbI1Bjjt/msv0tadQ1wUs\nN+gDS63pYaACbvXy8MWy7Vu33PqUXHeeE6V/Uq2V8viTO96LXFvKWlJbYK8U90vv\no/ufQJVtMVT8QtPHRh8jrdkPSHCa2XV4cdFyQzR1bldZwgJcJmApzyMZFo6IQ6XU\n5MsI+yMRQ+hDKXJioaldXgjUkK642M4UwtBV8ob2xJNDd2ZhwLnoQdeXeGADbkpy\nrqXRfboQnoZsG4q5WTP468SQvvG5\n-----END CERTIFICATE-----\n"
const incommingTopic = 'incomming'

const argumentErrorResponse = (reason) => ({
    code: 400,
    description: reason
})

const successResponse = (data) => ({
    code: 0,
    description: "Success",
    data,
})

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
    if (!!!event.body || !!!event.body.deviceid || !!!event.body.model || !!!event.body.devicename || !!!event.body.city || !!!event.body.timezone || !!!event.body.inlocation || !!!event.body.outlocation || !!!event.body.mainfw || !!!event.body.commfw) {
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
    let owner = null;
    console.log(event.email)
    console.log(event.body.deviceid)
    const userDevices = await dynamo.scan({
        TableName: 'user-device',
        ExpressionAttributeValues: {
            ':d': { S: event.body.deviceid },
            ':t': { S: 'owner' }
        },
        FilterExpression: '#D = :d and #T = :t',
        ExpressionAttributeNames: { '#D': 'deviceid', '#T': 'type', '#U': 'user' },
        ProjectionExpression: '#U'
    }).promise()
    if (Array.isArray(userDevices.Items) && userDevices.Items.length === 1) {
        owner = userDevices.Items[0].user.S
    }
    if (owner !== null && owner !== event.email) {
        await removeFavors(event.body.deviceid)
        await removeSchedules(event.body.deviceid)
        await removeShares(event.body.deviceid)
        //return argumentErrorResponse('Device already paired by other user')
    }
    const findDevice = await dynamo.getItem({
        TableName: 'device',
        Key: {
            'deviceid': { S: event.body.deviceid }
        },
        ProjectionExpression: 'deviceid, certs, thing'
    }).promise()
    const responseData = { endpoint, rootCA: RootCA, sendTopic: incommingTopic, clientId: event.body.deviceid, subscribeTopic: event.body.deviceid }
    let certs = {}
    if (!!!findDevice.Item) {
        const thing = await iot.createThing({ thingName: device.deviceid, thingTypeName: 'pure' }).promise()
        device.thing = JSON.stringify(thing)
        certs = await iot.createKeysAndCertificate({ setAsActive: true }).promise()
        device.certs = JSON.stringify(certs)
        await iot.attachPrincipalPolicy({ policyName: 'acerpure', principal: certs.certificateArn }).promise()
        await iot.attachThingPrincipal({ principal: certs.certificateArn, thingName: device.deviceid }).promise()
        const Item = {}
        Object.keys(device).forEach(key => {
            if (key === 'notify') {
                Item[key] = { BOOL: device[key] === 'false' ? false : true }
            }
            else {
                Item[key] = { S: device[key] }
            }
        })
        await dynamo.putItem({
            TableName: 'device',
            Item
        }).promise()
    }
    else {
        const Item = findDevice.Item
        Object.keys(device).forEach(key => {
            if (key === 'notify') {
                Item[key] = { BOOL: device[key] === 'false' ? false : true }
            }
            else {
                Item[key] = { S: device[key] }
            }
        })
        await dynamo.putItem({
            TableName: 'device',
            Item
        }).promise()
        certs = JSON.parse(findDevice.Item.certs.S)
    }
    responseData.cert = certs.certificatePem
    responseData.privateKey = certs.keyPair.PrivateKey
    if (owner !== null && owner !== event.email) {
        await dynamo.deleteItem({
            TableName: 'user-device',
            Key: {
                user: { S: owner },
                deviceid: { S: event.body.deviceid }
            }
        }).promise()
    }
    await dynamo.putItem({
        TableName: 'user-device',
        Item: {
            user: { S: event.email },
            deviceid: { S: event.body.deviceid },
            type: { S: 'owner' },
            createdAt: { N: Math.floor(+new Date() / 1000).toString() }
        }
    }).promise()
    return successResponse(responseData)
};
