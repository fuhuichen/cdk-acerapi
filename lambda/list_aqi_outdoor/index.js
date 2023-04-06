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
    console.log(event)
    if (typeof event.email !== 'string') {
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
    const userLocation = await docClient.query({
        //TableName: 'user-location',
        TableName: 'device-location',
        //KeyConditionExpression: '#U = :u',
        KeyConditionExpression: '#D = :d',
        ExpressionAttributeValues: {
            //':u': event.email
            ':d': event.deviceid
        },
        ProjectionExpression: '#L',
        //ExpressionAttributeNames: { '#L': 'location', '#U': 'user' },
        ExpressionAttributeNames: { '#L': 'location', '#D': 'deviceid' },
    }).promise()
    //return userLocation
    if (!Array.isArray(userLocation.Items) || userLocation.Items.length !== 1) {
        return argumentErrorResponse('Location not set')
    }
    let expression = '#L = :l'
    const values = { ':l': userLocation.Items[0].location }
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
            TableName: `aqi_outdoor`,
            KeyConditionExpression: expression,
            ExpressionAttributeValues: values,
            ProjectionExpression: '#T, #P1, #P2, #V',
            ExpressionAttributeNames: { '#T': 'timestamp', '#L': 'location', '#P1': 'pm10', '#P2': 'pm25', '#V': 'value' },
            //Limit: 100,
            ScanIndexForward: true
        }).promise()
        if (!Array.isArray(datas.Items)) {
            return successResponse(null)
        }
        const responseDatas = datas.Items.map(data => {
            return {
                datetime: data.timestamp,
                'PM1.0': data.pm10 || 0,
                'PM2.5': data.pm25 || data.value,
            }
        })
        return successResponse(responseDatas)
    }
    console.log(expression, values)
    const datas = await docClient.query({
        TableName: `aqi_outdoor_${event.period}`,
        KeyConditionExpression: expression,
        ExpressionAttributeValues: values,
        ProjectionExpression: '#T, #P1, #P2',
        ExpressionAttributeNames: { '#T': 'timestamp', '#L': 'location', '#P1': 'pm10', '#P2': 'pm25' },
        //Limit: 100,
        ScanIndexForward: true
    }).promise()
    if (!Array.isArray(datas.Items)) {
        return successResponse(null)
    }
    const responseDatas = datas.Items.map(data => {
        return {
            datetime: data.timestamp,
            'PM1.0': data.pm10,
            'PM2.5': data.pm25,
        }
    })
    console.log(responseDatas)
    return successResponse(responseDatas)
};
