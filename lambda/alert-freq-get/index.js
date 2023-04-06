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
    const freq = await dynamo.scan({
        TableName: 'alert_freq'
    }).promise()
    if (Array.isArray(freq.Items) === false) return argumentErrorResponse('Unexpected fail')
    const data = freq.Items.map(({ alert, interval }) => ({ alert: alert.S, interval: interval.N }))
    return successResponse(data)
};
