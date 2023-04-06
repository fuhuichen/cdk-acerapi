const AWS = require('aws-sdk');
const dynamo = new AWS.DynamoDB();

const FIELDS = ['deviceid', 'model', 'devicename', 'city', '#Z', 'inlocation', 'outlocation', 'mainfw', 'commfw', 'certs', 'notify']

const endpoint = 'aecv2cgzfn96o-ats.iot.ap-southeast-1.amazonaws.com'
const RootCA = "-----BEGIN CERTIFICATE-----\nMIIDQTCCAimgAwIBAgITBmyfz5m/jAo54vB4ikPmljZbyjANBgkqhkiG9w0BAQsF\nADA5MQswCQYDVQQGEwJVUzEPMA0GA1UEChMGQW1hem9uMRkwFwYDVQQDExBBbWF6\nb24gUm9vdCBDQSAxMB4XDTE1MDUyNjAwMDAwMFoXDTM4MDExNzAwMDAwMFowOTEL\nMAkGA1UEBhMCVVMxDzANBgNVBAoTBkFtYXpvbjEZMBcGA1UEAxMQQW1hem9uIFJv\nb3QgQ0EgMTCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBALJ4gHHKeNXj\nca9HgFB0fW7Y14h29Jlo91ghYPl0hAEvrAIthtOgQ3pOsqTQNroBvo3bSMgHFzZM\n9O6II8c+6zf1tRn4SWiw3te5djgdYZ6k/oI2peVKVuRF4fn9tBb6dNqcmzU5L/qw\nIFAGbHrQgLKm+a/sRxmPUDgH3KKHOVj4utWp+UhnMJbulHheb4mjUcAwhmahRWa6\nVOujw5H5SNz/0egwLX0tdHA114gk957EWW67c4cX8jJGKLhD+rcdqsq08p8kDi1L\n93FcXmn/6pUCyziKrlA4b9v7LWIbxcceVOF34GfID5yHI9Y/QCB/IIDEgEw+OyQm\njgSubJrIqg0CAwEAAaNCMEAwDwYDVR0TAQH/BAUwAwEB/zAOBgNVHQ8BAf8EBAMC\nAYYwHQYDVR0OBBYEFIQYzIU07LwMlJQuCFmcx7IQTgoIMA0GCSqGSIb3DQEBCwUA\nA4IBAQCY8jdaQZChGsV2USggNiMOruYou6r4lK5IpDB/G/wkjUu0yKGX9rbxenDI\nU5PMCCjjmCXPI6T53iHTfIUJrU6adTrCC2qJeHZERxhlbI1Bjjt/msv0tadQ1wUs\nN+gDS63pYaACbvXy8MWy7Vu33PqUXHeeE6V/Uq2V8viTO96LXFvKWlJbYK8U90vv\no/ufQJVtMVT8QtPHRh8jrdkPSHCa2XV4cdFyQzR1bldZwgJcJmApzyMZFo6IQ6XU\n5MsI+yMRQ+hDKXJioaldXgjUkK642M4UwtBV8ob2xJNDd2ZhwLnoQdeXeGADbkpy\nrqXRfboQnoZsG4q5WTP468SQvvG5\n-----END CERTIFICATE-----\n"
const incommingTopic = 'incomming'

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
    const userDevices = await dynamo.query({
        TableName: 'user-device',
        ExpressionAttributeValues: {
            ':u': { S: event.email }
        },
        KeyConditionExpression: '#U = :u',
        ExpressionAttributeNames: { '#U': 'user', '#T': 'type' },
        ProjectionExpression: 'deviceid, createdAt, #T'
    }).promise()
    const devices = []
    for (let idx = 0; idx < userDevices.Items.length; idx++) {
        const findDevice = await dynamo.getItem({
            TableName: 'device',
            Key: {
                'deviceid': { S: userDevices.Items[idx].deviceid.S }
            },
            ProjectionExpression: FIELDS.join(","),
            ExpressionAttributeNames: { '#Z': 'timezone' }
        }).promise()

        if (!!!findDevice.Item) {
            continue
        }

        const responseData = { endpoint, rootCA: RootCA, sendTopic: incommingTopic, clientId: userDevices.Items[idx].deviceid.S, subscribeTopic: userDevices.Items[idx].deviceid.S }
        FIELDS.forEach(field => {
            if (field === 'certs') {
                const certs = JSON.parse(findDevice.Item[field].S)
                responseData.cert = certs.certificatePem
                responseData.privateKey = certs.keyPair.PrivateKey
            }
            else if (field === '#Z') {
                responseData['timezone'] = findDevice.Item['timezone'].S
            }
            else if (field === 'notify') {
                responseData['notify'] = typeof findDevice.Item['notify'] === 'undefined'?false:findDevice.Item['notify'].BOOL
            }
            else {
                responseData[field] = findDevice.Item[field].S
            }
        })
        responseData.pairdate = userDevices.Items[idx].createdAt.N
        responseData.isShared = userDevices.Items[idx].type.S === 'share'
        devices.push(responseData)
    }


    return successResponse(devices)
};
