'use strict';

const config = require('./config.json');
const {google} = require('googleapis');
const fetch = require('node-fetch');

const emojis = [
  "1️⃣",
  "2️⃣",
  "3️⃣",
  "4️⃣",
  "5️⃣",
  "6️⃣",
  "7️⃣",
  "8️⃣",
  "9️⃣",
  "🔟",
];

class Message {
  constructor() {
    this.type = null;
    this.user = null;
    this.ts = null;
    this.text = null;
  }
}

class Channel {
  constructor() {
    this.id = null;
    this.name = null;
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

function parsePayload(payload) {
  return JSON.parse(payload);
}

/**
 * Receive a interactive request from Slack
 *
 * Trigger this function by making a POST request with a payload to:
 * https://[YOUR_REGION].[YOUR_PROJECT_ID].cloudfunctions.net/kgsearch
 *
 * @param {object} req Cloud Function request object.
 * @param {object} req.body The request payload.
 * @param {string} req.body.payload The request payload
 * @param {string} req.body.token Slack's verification token.
 * @param {string} req.body.callback_id The callback id to determine the type of interactive request
 * @param {string} req.body.type callback type
 * @param {Channel} req.body.channel The originating message channel
 * @param {Message} req.body.message The originating message timestamp
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

      const slack_response = parsePayload(req.body.payload);

      // Verify that this request came from Slack
      verifyWebhook(slack_response);

      return fetch("https://slack.com/api/reactions.add", {
        method: "POST",
        body: {
          "token": config.SLACK_OAUTH_TOKEN,
          "name": "thumbsup",
          "channel": slack_response.channel.id,
          "timestamp": slack_response.message.ts,
        }
      });
    })
    .then(x => x.json())
    .then(x => {
      console.log(JSON.stringify(x));
      res.status(200).send('');
    })
    .catch(err => {
      console.error(err);
      res.status(err.code || 500).send(err);
      return Promise.reject(err);
    });
};