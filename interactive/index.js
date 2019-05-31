'use strict';

const config = require('./config.json');
const {google} = require('googleapis');
const fetch = require('node-fetch');

const emojis = [
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "keycap_ten",
];

class Message {
  constructor() {
    this.type = "";
    this.user = "";
    this.ts = NaN;
    this.text = "";
  }
}

class Channel {
  constructor() {
    this.id = "";
    this.name = "";
  }
}

class User {
  constructor() {
    this.id = "";
  }
}

class SlackRequest {
  constructor() {
    this.token = "";
    this.user = new User();
    this.message = new Message();
    this.channel = new Channel();
    this.actions = [];
  }
}

/**
 * Verify that the webhook request came from Slack.
 *
 * @param {object} body The body of the request.
 * @param {string} body.token The Slack token to be verified.
 */
function verifyWebhook(body) {
  if (!body || !body.token) {
    const error = new Error("No credentials!");
    error.code = 401;
    throw error;
  } else if (body.token !== config.SLACK_TOKEN) {
    const error = new Error('Invalid credentials');
    error.code = 401;
    throw error;
  }
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
 * Sends a reaction to the designated slack message
 * 
 * @param {string} token oauth token with scopes user/bot
 * @param {string} emoji emoji string (without the surrounding ":")
 * @param {string} channelId channel id
 * @param {string} msgTimestamp message timestamp
 * @param {string} userId user id to act on behalf of
 */
function sendReaction(token, emoji, channelId, msgTimestamp, userId) {
  return fetch("https://slack.com/api/reactions.add", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "X-Slack-User": userId,
      'Accept': 'application/json',
      'Content-Type': 'application/json; charset=utf-8'
    },
    body: JSON.stringify({
      "name": emoji,
      "channel": channelId,
      "timestamp": msgTimestamp,
    })
  });
}

/**
 * Gets emoji choice from actions
 * @param {array} actions
 * @returns {null | string}
 */
function getEmojiFromActions(actions) {
  if (actions.length < 1) return null;
  const i = parseInt(actions[0].value);
  if (i < 0 || i > emojis.length - 1) return null;
  return emojis[i];
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
exports.interactive = (req, res) => {
  return Promise.resolve()
    .then(() => {
      if (req.method !== 'POST') {
        const error = new Error('Only POST requests are accepted');
        error.code = 405;
        throw error;
      }

      const slackRequest = parsePayload(req.body.payload);

      // Verify that this request came from Slack
      verifyWebhook(slackRequest);

      const emojiIndex = getEmojiFromActions(slackRequest.actions);

      return sendReaction(config.SLACK_OAUTH_TOKEN, emojiIndex, slackRequest.channel.id, slackRequest.message.ts, slackRequest.user.id);
    })
    .then(x => x.json())
    .then(x => {
      console.debug(JSON.stringify(x));
      res.status(200).send('')
      return Promise.resolve();
    })
    .catch(err => {
      console.error(err);
      res.status(err.code || 500).send(err);
      return Promise.reject(err);
    });
};