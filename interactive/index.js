const fetch = require("node-fetch");
const env_yaml = require('env-yaml');
const logger = require('./log.js')(process.env.NODE_ENV, console)

import { SlackRequest } from './SlackClasses';

if (process.env.NODE_ENV === "development") {
  env_yaml.config();
}

const config = {
  SLACK_TOKEN: process.env.SLACK_TOKEN,
  SLACK_OAUTH_TOKEN: process.env.SLACK_OAUTH_TOKEN
};

const emojis = [
  ["1️⃣", "one"],
  ["2️⃣", "two"],
  ["3️⃣", "three"],
  ["4️⃣", "four"],
  ["5️⃣", "five"],
  ["6️⃣", "six"],
  ["7️⃣", "seven"],
  ["8️⃣", "eight"],
  ["9️⃣", "nine"],
  ["🔟", "keycap_ten"],
];

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
 * Gets command params from request body text
 * Supports a maximum of 10 options
 * MATCHES SIMPLEPOLL NOW
 * 
 * @param {string} bodyText request body text
 * @returns {string} cleaned params
 */
function getPromptAndOptionsFromBody(bodyText) {
  const cleanedBodyText = bodyText.replace(/“|”/g, "\"");
  let params = cleanedBodyText.match(/"[^"\\]*(?:\\.[^"\\]*)*"|\S+/g);
  if (params) {
    return params
      .filter(x => x !== "\"") // Eliminate strings with just " in it
      .reduce((x, y) => {
        // Join the resulting string back together again and RESPECT balanced quotes
        const newElementIsQuoted = y.startsWith("\"") && y.endsWith("\"");
        const reducerIsEmpty = x.length === 0;
        const lastElementIsQuoted = !reducerIsEmpty && x[x.length-1].endsWith("\"") && x[x.length-1].startsWith("\"");

        if (newElementIsQuoted || reducerIsEmpty || lastElementIsQuoted) x.push(y)
        else x[x.length-1] += " " + y;
        return x;
      }, [])
      .map(x => x.replace(/(?<!\\)"/g,"").replace(/\\"/g, "\"")) // Negative lookbehind of unescaped quotes and replacing escaped quotes with unescaped quotes
      .slice(0, 11);
  }
  return []
}

/**
 * Format slack message to look like a real fucking poll
 *
 * @param {string} question the poll question
 * @param {array} options poll options
 * @returns {string}
 */
function formatSlackMessage(question, options) {
  if (!question) {
    throw new ParameterError(200, "Uh, did you follow the command hints? You need a question first..");
  }
  if (options.length < 2) {
    throw new ParameterError(200, "Hey, you don't have enough options to make a poll!");
  }

  return `*${question}*\nOptions:\n${options.map((x, i) => `>${emojis[i][0]} ${x}`).join("\n")}`;
}

/**
 * Sends message to slack
 * 
 * @param {string} channel channel id
 * @param {string} username username
 * @param {string} pollText poll text
 * @returns {Promise<{ ts: number, channel: string }>} response
 */
async function sendMessage(channel, username, pollText) {
  const json_resp = await (await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      'Authorization': `Bearer ${config.SLACK_OAUTH_TOKEN}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json; charset=utf-8'
    },
    body: JSON.stringify({
      channel: channel,
      text: pollText,
      as_user: false,
      username: username,
    })
  })).json();
  logger.debug("Sent message with timestamp ", json_resp.ts, " and channel id ", json_resp.channel);
  return json_resp;
}

/**
 * Sends emojis to message id in channel
 * 
 * @param {string} channel channel id
 * @param {number} ts timestamp of message
 * @param {number} reactions number of reactions
 * @returns {boolean} success
 */
async function sendEmojis(channel, ts, reactions) {
  let success = true
  for(let i = 0; i < reactions; i++) {
    success &= (await (await fetch("https://slack.com/api/reactions.add", {
      method: "POST",
      headers: {
        'Authorization': `Bearer ${config.SLACK_OAUTH_TOKEN}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json; charset=utf-8'
      },
      body: JSON.stringify({
        name: emojis[i][1],
        channel: channel,
        timestamp: ts
      })
    })).json())["ok"]
  }
  logger.debug("Sent ", reactions, " emojis to message timestamp ", ts)
  return success;
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


    // success!
    res.json({ text: "Successfully made the poll!" });
  }
  catch (err) {
    logger.error(JSON.stringify(err));
    res.status(err.status || 500).json(err);
  }
}