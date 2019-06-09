const fetch = require("node-fetch");
const env_yaml = require('env-yaml');
const logger = require('./log.js')(process.env.NODE_ENV, console)

const SlackRequest = require("./SlackClasses").SlackRequest;
const Action = require("./SlackClasses").Action;
const Button = require("./SlackClasses").Button;

if (process.env.NODE_ENV === "development") {
  env_yaml.config({ path: '../.env.yml' });
}

const config = {
  SLACK_TOKEN: process.env.SLACK_TOKEN,
  SLACK_OAUTH_TOKEN: process.env.SLACK_OAUTH_TOKEN
};

class HTTPError extends Error {
  constructor(code, message) {
    super();
    this.status = code;
    this.text = message;
  }
  toString() {
    return JSON.stringify(this);
  }
}

class ParameterError extends HTTPError {}

/**
 * Verify that the webhook request came from Slack.
 *
 * @param {object} body The body of the request.
 * @param {string} body.token The Slack token to be verified.
 */
function verifyWebhook(body) {
  if (!body || body.token !== config.SLACK_TOKEN) {
    throw new HTTPError(401, (body && body.token ? "Invalid token" : "Missing token"));
  }
}

/**
 * Deletes poll in channel
 * 
 * @param {string} channel channel id
 * @param {number} ts timestamp of message
 * @returns {boolean} success
 */
async function deletePoll(channel, ts) {
  let json = (await (await fetch("https://slack.com/api/chat.delete", {
    method: "POST",
    headers: {
      'Authorization': `Bearer ${config.SLACK_OAUTH_TOKEN}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json; charset=utf-8'
    },
    body: JSON.stringify({
      channel: channel,
      ts: ts
    })
  })).json())
  let success = json["ok"]
  if (success) logger.debug("Deleted poll in channel ", channel, " with message timestamp ", ts)
  else logger.error(json, channel, ts)
  return !!success;
}

/**
 * Deletes the originating message
 * 
 * @param {string} response_url 
 */
function deleteOriginatingMessage(response_url) {
  fetch(response_url, {
    method: "POST",
    headers: {
      'Content-Type': 'application/json; charset=utf-8'
    },
    body: JSON.stringify({
      "delete_original": true
    })
  });
  logger.debug("Deleted originating message");
}

/**
 * Parses payload into a slack request
 * @param {string} payload the payload to parse
 * @returns {SlackRequest}
 */
function parsePayload(payload) {
  return JSON.parse(payload);
}

/**
 * Handles the interactive commands
 * 
 * @param {string} channel channel
 * @param {string} timestamp timestamp
 * @param {[Action]} actions actions
 */
async function handleInteractiveCommands(channel, timestamp, actions) {
  if (!Array.isArray(actions)) return;
  for (let i=0; i<actions.length; i++) {
    await handleButtonActionDeletePoll(actions[i]);
  }
}

/**
 * Handle the button that deletes the poll
 * 
 * @param {Button} action action
 */
async function handleButtonActionDeletePoll(action) {
  if (action.type !== "button" || action.action_id !== "deletePoll") return;
  let pair = action.value.split(',');
  await deletePoll(pair[0], pair[1]);
}

/**
 * Receive a interactive request from Slack
 *
 * Trigger this function by making a POST request with a payload to:
 * https://[YOUR_REGION].[YOUR_PROJECT_ID].cloudfunctions.net/interactive
 *
 * @param {object} req Cloud Function request object.
 * @param {object} req.body The request payload.
 * @param {string} req.body.payload The request payload
 * @param {object} res Cloud Function response object.
 */
exports.interactive = async function(req, res) {
  try {
    // Accept POST only
    if (req.method !== 'POST') {
      throw new HTTPError(405, 'Only POST requests are accepted');
    }

    const slackRequest = parsePayload(req.body.payload);

    // Verify that this request came from Slack
    verifyWebhook(slackRequest);

    // interpret interactive request
    await handleInteractiveCommands(slackRequest.channel, slackRequest.container.message_ts, slackRequest.actions);
    deleteOriginatingMessage(slackRequest.response_url);

    // success!
    res.json({ text: "Successfully deleted the poll!" });
  }
  catch (err) {
    logger.error(err);
    res.status(err.status || 500).json(err);
  }
}