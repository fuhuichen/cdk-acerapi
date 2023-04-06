const AWS = require('aws-sdk');
const dynamo = new AWS.DynamoDB();
const docClient = new AWS.DynamoDB.DocumentClient();

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
    if (typeof event.deviceid !== 'string') {
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
        (userDevice.Item.user.S !== event.email)
    ) {
        return argumentErrorResponse('User is not permited')
    }
    let expression = 'deviceid = :d'
    const values = { ':d': event.deviceid }
    if (/^\d+$/.test(event.start) && /^\d+$/.test(event.end)) {
        expression = expression + ' and #T between :s and :e'
        values[':s'] = parseInt(event.start, 10)
        values[':e'] = parseInt(event.end, 10)
    }
    else if (/^\d+$/.test(event.start)) {
        expression = expression + ' and #T >= :s'
        values[':s'] = parseInt(event.start, 10)
    }
    else if (/^\d+$/.test(event.end)) {
        expression = expression + ' and #T <= :e'
        values[':e'] = parseInt(event.end, 10)
    }
    // temp response
    /*
    const fdatas = get_time_range_list(start, end, event.period).map(range => {
        return { "PM2.5": "9", "PM1.0": "5", timestamp: range[0] }
    })
    return successResponse(fdatas)
    */
    if (event.period === 'raw') {
        const datas = await docClient.query({
            TableName: `aqi_indoor`,
            KeyConditionExpression: expression,
            ExpressionAttributeValues: values,
            ProjectionExpression: '#T, #D',
            ExpressionAttributeNames: { '#T': 'timestamp', '#D': 'data' },
            //Limit: 100,
            ScanIndexForward: true
        }).promise()
        if (!Array.isArray(datas.Items)) {
            return successResponse(null)
        }
        const responseDatas = datas.Items.map(data => {
            const d = JSON.parse(data.data)
            if(d['CO2'] != null && d['CO2'] !== 'undefined') {
                return {
                    datetime: data.timestamp,
                    'PM1.0': d['PM1.0'],
                    'PM2.5': d['PM2.5'],
                    'CO2': d['CO2']
                }
            } else {
                return {
                    datetime: data.timestamp,
                    'PM1.0': d['PM1.0'],
                    'PM2.5': d['PM2.5'],
                }
            }
        })
        return successResponse(responseDatas)
    }
    const datas = await docClient.query({
        TableName: `aqi_indoor_${event.period}`,
        KeyConditionExpression: expression,
        ExpressionAttributeValues: values,
        ProjectionExpression: '#T, #P1, #P2, #P3',
        ExpressionAttributeNames: { '#T': 'timestamp', '#P1': 'pm10', '#P2': 'pm25', '#P3': 'CO2' },
       vbghnbo0-  ScanIndexForward: true
    }).promise()
    if (!Array.isArray(datas.Items)) {
        return successResponse(null)
    }
    const responseDatas = datas.Items.map(data => {
        if(data.CO2 != null && data.CO2 !== 'undefined') {
            return {
                datetime: data.timestamp,
                'PM1.0': data.pm10,
                'PM2.5': data.pm25,
                'CO2': data.CO2
            }
        } else {
            return {
                datetime: data.timestamp,
                'PM1.0': data.pm10,
                'PM2.5': data.pm25,
            }
        }
    })
    return successResponse(responseDatas)
};
