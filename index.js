'use strict';

const config = require('./config.json');
const {google} = require('googleapis');
const fetch = require("node-fetch");

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

const emojiText = [
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


/**
 * Verify that the webhook request came from Slack.
 *
 * @param {object} body The body of the request.
 * @param {string} body.token The Slack token to be verified.
 */
function verifyWebhook(body) {
  if (!body || body.token !== config.SLACK_TOKEN) {
    const error = new Error('Invalid credentials');
    error.code = 401;
    throw error;
  }
}

/**
 * Makes a message poll
 * 
 * @param {string} bodyText request body text
 * @returns {{text: string, num_reactions: number}}
 */
function makePoll(bodyText) {
  let cleanedBodyText = bodyText.replace(/“|”/g, "\"");
  let params = cleanedBodyText.match(/("[^"]+"|[^\s"]+)/g).map(x => x.replace(/"/g, "")).filter(x => x.length > 0);

  return makeSlackMessageJSON(params[0], params.slice(1));
}

/**
 * Format slack message to look like a real fucking poll
 *
 * @param {string} question the poll question
 * @param {array} options poll options
 * @returns {{ text: string, num_reactions: number }}
 */
function makeSlackMessageJSON(question, options) {
  if (!question) {
    return { response_type: "ephemeral", text: "Uh, did you follow the command hints? You need a question first.." };
  }
  if (options.length < 2) {
    return { response_type: "ephemeral", text: "Hey, you don't have enough options to make a poll!" };
  }

  return {
    text: `*${question}*\nOptions:\n${options.slice(0, 10).map((x, i) => `>${emojis[i]} ${x}`).join("\n")}`,
    num_reactions: options.slice(0, 10).length
  };
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
  console.log("Sent message with timestamp ", json_resp.ts, " and channel id ", json_resp.channel);
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
  console.debug("Sending ", (reactions+1), " emojis to message timestamp ", ts)
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
        name: emojiText[i],
        channel: channel,
        timestamp: ts
      })
    })).json())["ok"]
  }
  return success;
}

/**
 * Receive a Slash Command request from Slack.
 *
 * Trigger this function by making a POST request with a payload to:
 * https://[YOUR_REGION].[YOUR_PROJECT_ID].cloudfunctions.net/kgsearch
 *
 * @param {object} req Cloud Function request object.
 * @param {object} req.body The request payload.
 * @param {string} req.body.token Slack's verification token.
 * @param {string} req.body.channel_id channel id
 * @param {string} req.body.user_name username
 * @param {string} req.body.text The user's request params
 * @param {object} res Cloud Function response object.
 */
exports.pollbot = (req, res) => {
  return Promise.resolve()
    .then(() => {
      if (req.method !== 'POST') {
        const error = new Error('Only POST requests are accepted');
        error.code = 405;
        throw error;
      }
      return Promise.resolve();
    })
    .then(() => {
      // Verify that this request came from Slack
      verifyWebhook(req.body);
      return Promise.resolve();
    })
    .then(() => {
      // Send slack message and react to it
      const pollJSON = makePoll(req.body.text);
      return sendMessage(req.body.channel_id, req.body.user_name, pollJSON.text)
        .then(x => { sendEmojis(x.channel, x.ts, pollJSON.num_reactions); return x; });
    })
    .then(() => {
      // Send response
      res.json({ text: "Successfully made the poll!" });
      return Promise.resolve();
    })
    .catch(err => {
      console.error(err);
      res.status(err.code || 500).send(err);
      return Promise.reject(err);
    });
};