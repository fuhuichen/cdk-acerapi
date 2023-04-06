const AWS = require("aws-sdk");
const dynamo = new AWS.DynamoDB();
const eventbridge = new AWS.EventBridge();
const lambda = new AWS.Lambda();

const SCHEDULE_LAMBDA_ARN =
  "arn:aws:lambda:ap-southeast-1:745063739240:function:user-schedule-worker";

const argumentErrorResponse = (reason) => ({
  code: 400,
  description: reason,
});

const successResponse = (data) => ({
  code: 0,
  description: "Success",
  data,
});

const TIME_REGEX = /^([0-1]?[0-9]|2[0-3]):(0|00|15|30|45|59|14|29|44|1|16|31|46)$/;

const SCHEMAS = [{
    name: "deviceid", // - (String) The device ID is paired.
    validate: (value) => {
      return typeof value === "string";
    },
    transform: (value) => ({ S: value }),
  },
  {
    name: "tmstart", // - (String) Schedule start time (HH:mm), mm: 0/15/30/45 minutes
    validate: (value) => {
      return typeof value === "string" && TIME_REGEX.test(value);
    },
    transform: (value) => ({ S: value }),
  },
  {
    name: "tmend", // - (String) Schedule end time (HH:mm), mm: 0/15/30/45 minutes
    validate: (value) => {
      return typeof value === "string" && TIME_REGEX.test(value);
    },
    transform: (value) => ({ S: value }),
  },
  {
    name: "wkstart", // - (Array) Weekday for the schedule (0~6) repeating
    validate: (value) => {
      if (Array.isArray(value) === false) return false;
      if (value.length === 0) return false;
      if (new Set(value).size !== value.length) return false;
      return value.reduce((accu, v) => {
        if (accu === false) return false;
        if (Number.isInteger(v) === false) return false;
        if (v < 0 || v > 6) return false;
        return true;
      }, true);
    },
    transform: (value) => ({ L: value.map((v) => ({ N: v.toString() })) }),
  },
  {
    name: "wkend", // - (Array) Weekday for the schedule (0~6) repeating
    validate: (value) => {
      if (Array.isArray(value) === false) return false;
      if (value.length === 0) return false;
      if (new Set(value).size !== value.length) return false;
      return value.reduce((accu, v) => {
        if (accu === false) return false;
        if (Number.isInteger(v) === false) return false;
        if (v < 0 || v > 6) return false;
        return true;
      }, true);
    },
    transform: (value) => ({ L: value.map((v) => ({ N: v.toString() })) }),
  },
  {
    name: "start_topic", // - (String) MQTT topic
    validate: (value) => {
      return typeof value === "string";
    },
    transform: (value) => ({ S: value }),
  },
  {
    name: "start_data", // - (Object) data publish to topic while start
    validate: (value) => {
      return (
        typeof value === "object"
      );
    },
    transform: (value) => ({ S: JSON.stringify(value) }),
  },
  {
    name: "end_topic", // - (String) MQTT topic
    validate: (value) => {
      return typeof value === "string";
    },
    transform: (value) => ({ S: value }),
  },
  {
    name: "end_data", // - (Object) data publish to topic while end
    validate: (value) => {
      return (
        typeof value === "object"
      );
    },
    transform: (value) => ({ S: JSON.stringify(value) }),
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

exports.handler = async(event, context) => {
  if (isInputValid(event.body) === false) {
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
  const userDevice = await dynamo.getItem({
    TableName: "user-device",
    Key: {
      deviceid: { S: event.body.deviceid },
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
  const sid = context.awsRequestId;
  const createdAt = Math.floor(+new Date() / 1000).toString();
  const Item = {};
  SCHEMAS.forEach(({ name, transform }) => {
    Item[name] = transform(event.body[name]);
  });
  Item.sid = { S: sid };
  Item.createdAt = { N: createdAt };
  Item.enabled = { BOOL: true }
  await dynamo
    .putItem({
      TableName: "schedule",
      Item,
    })
    .promise();
  const schedule = event.body;
  schedule.sid = sid;
  const wkstart = event.body.wkstart.map((wk) => (wk + 1).toString()).join(",");
  const start_rule = `${sid}_start`;
  const start_hour = parseInt(
    TIME_REGEX.exec(event.body.tmstart)[1]
  ).toString();
  const start_min = parseInt(TIME_REGEX.exec(event.body.tmstart)[2]).toString();
  const start_expresstion = [start_min, start_hour, "?", "*", wkstart, "*"];
  const startBridge = await eventbridge
    .putRule({
      Name: start_rule,
      ScheduleExpression: `cron(${start_expresstion.join(" ")})`,
    })
    .promise();
  await eventbridge
    .putTargets({
      Rule: start_rule,
      Targets: [{
        Id: `${start_rule}-target`,
        Arn: SCHEDULE_LAMBDA_ARN,
        Input: JSON.stringify({ type: "start", schedule }),
      }, ],
    })
    .promise();
  const end_rule = `${sid}_end`;
  const end_hour = parseInt(TIME_REGEX.exec(event.body.tmend)[1]).toString();
  const end_min = parseInt(TIME_REGEX.exec(event.body.tmend)[2]).toString();
  const wkend = event.body.wkend.map((wk) => (wk + 1).toString()).join(",");
  const end_expresstion = [end_min, end_hour, "?", "*", wkend, "*"];
  const endBridge = await eventbridge
    .putRule({
      Name: end_rule,
      ScheduleExpression: `cron(${end_expresstion.join(" ")})`,
    })
    .promise();
  await eventbridge
    .putTargets({
      Rule: end_rule,
      Targets: [{
        Id: `${end_rule}-target`,
        Arn: SCHEDULE_LAMBDA_ARN,
        Input: JSON.stringify({ type: "end", schedule }),
      }, ],
    })
    .promise();
  return successResponse(schedule);
};
