const AWS = require('aws-sdk')
const dynamo = new AWS.DynamoDB();

const argumentErrorResponse = (reason) => ({
  code: 400,
  description: reason,
});

const successResponse = {
  code: 0,
  description: "Success"
};

const SCHEMAS = [{
    name: "deviceid",
    validate: (value) => {
      return typeof value === "string";
    }
  },
  {
    name: "payload",
    validate: (value) => {
      return (typeof value === "string" || typeof value === "object");
    }
  }
];

const isInputValid = (input) => {
  if (!!!input) return false;
  for (let i = 0; i < SCHEMAS.length; i++) {
    const { name, validate } = SCHEMAS[i];
    if (validate(input[name]) === false) return false;
  }
  return true;
};

const iotdata = new AWS.IotData({ endpoint: 'aecv2cgzfn96o-ats.iot.ap-southeast-1.amazonaws.com' })

const publish = (topic, payload) => {
  const params = {
    topic,
    payload,
    qos: 0
  }

  return new Promise((resolve, reject) => {
    iotdata.publish(params, function(err, data) {
      if (err) {
        reject(err)
      }
      else {
        resolve('publish ok')
      }
    })
  })
}

exports.handler = async(event, context) => {
  if (isInputValid(event.body) === false) {
    return argumentErrorResponse("Argument error");
  }
  console.log(event.email)
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
  const userDevice = await dynamo.getItem({
    TableName: "user-device",
    Key: {
      deviceid: { S: event.body.deviceid },
      user: { S: event.email }
    },
    ProjectionExpression: "#U",
    ExpressionAttributeNames: { '#U': 'user' },
  }).promise();
  if (!!userDevice &&
    !!userDevice.Item &&
    userDevice.Item.user.S !== event.email
  ) {
    return argumentErrorResponse("Device already paired by other user");
  }
  let payload = ''
  if (typeof event.body.payload === 'string') {
    payload = event.body.payload
  }
  if (typeof event.body.payload === 'object') {
    payload = JSON.stringify(event.body.payload)
  }
  await publish(event.body.deviceid, payload);
  return successResponse
};
