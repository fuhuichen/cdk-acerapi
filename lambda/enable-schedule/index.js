const AWS = require("aws-sdk");
const dynamo = new AWS.DynamoDB();
const eventbridge = new AWS.EventBridge();
const lambda = new AWS.Lambda();

const SCHEDULE_LAMBDA_ARN =
  "arn:aws:lambda:ap-southeast-1:295813269701:function:user-schedule-worker";

const argumentErrorResponse = (reason) => ({
  code: 400,
  description: reason,
});

const successResponse = {
  code: 0,
  description: "Success"
};

const isInputValid = (input) => {
  if (!!!input) return false;
  return typeof input.enabled === 'boolean' && typeof input.sid === 'string';
};

exports.handler = async(event, context) => {
  if (isInputValid(event) === false) {
    return argumentErrorResponse("Argument error");
  }
  const user = await dynamo
    .getItem({
      TableName: "user",
      Key: {
        acc: { S: event.email },
      },
      ProjectionExpression: "acc, enabled",
    })
    .promise();
  if (!!!user.Item) {
    return argumentErrorResponse("User not signup");
  }
  if (user.Item.enabled.BOOL === false) {
    return argumentErrorResponse("User is disabled");
  }
  const schedules = await dynamo.scan({
    TableName: 'schedule',
    ExpressionAttributeValues: {
      ':s': { S: event.sid }
    },
    FilterExpression: '#S = :s',
    ExpressionAttributeNames: { '#S': 'sid' },
    ProjectionExpression: 'sid, deviceid, tmstart, tmend, wkstart, wkend, start_topic, start_data, end_topic, end_data, createdAt, enabled',
  }).promise()
  if (!Array.isArray(schedules.Items) || schedules.Items.length !== 1) {
    return argumentErrorResponse('Schedule not found')
  }
  const userDevice = await dynamo.getItem({
    TableName: "user-device",
    Key: {
      deviceid: { S: schedules.Items[0].deviceid.S },
      user: { S: event.email }
    },
    ProjectionExpression: "#U, #T",
    ExpressionAttributeNames: { '#U': 'user', '#T': 'type' },
  }).promise();
  if (!!userDevice &&
    !!userDevice.Item &&
    userDevice.Item.user.S !== event.email && userDevice.Item.type.S !== 'owner'
  ) {
    return argumentErrorResponse("Device already paired by other user");
  }
  const sid = event.sid;
  const createdAt = Math.floor(+new Date() / 1000).toString();
  await dynamo.updateItem({
    TableName: 'schedule',
    Key: {
      "sid": {
        S: event.sid
      },
      "deviceid": {
        S: schedules.Items[0].deviceid.S
      }
    },
    UpdateExpression: "SET #E = :e, #C = :c",
    ExpressionAttributeNames: {
      "#E": "enabled",
      "#C": "createdAt"
    },
    ExpressionAttributeValues: {
      ":e": {
        BOOL: typeof event.enabled === 'boolean' ? event.enabled : !!event.enabled
      },
      ":c": {
        N: createdAt
      }
    },
  }).promise()

  if (event.enabled === true) {
    await eventbridge.enableRule({ Name: `${event.sid}_start` }).promise()
    await eventbridge.enableRule({ Name: `${event.sid}_end` }).promise()
  }
  else {
    await eventbridge.disableRule({ Name: `${event.sid}_start` }).promise()
    await eventbridge.disableRule({ Name: `${event.sid}_end` }).promise()
  }

  return successResponse;
};
