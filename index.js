'use strict';

const config = require('./config.json');
const {google} = require('googleapis');

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


/**
 * Format slack message to look like a real fucking poll
 *
 * @param {string} question the poll question
 * @param {array} options poll options
 * @returns {object} The formatted message.
 */
function formatSlackMessage(question, options) {
  return {
    text: `*${question}*\nOptions:\n${options.slice(1, 11).map((x, i) => `>${emojis[i]} ${x}`).join("\n")}`,
    response_type: "in_channel"
  };
}

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
 * @param {string} bodyText 
 */
function makePoll(bodyText) {
  let cleanedBodyText = bodyText.replace(/“|”/g, "\"");
  let params = cleanedBodyText.match(/("[^"]+"|[^\s"]+)/g).map(x => x.replace(/"/g, "")).filter(x => x.length > 0);
  if (params.length < 3) {
    cb(null, { text: "Hey, you don't have enough options to make a poll!" });
  }

  return formatSlackMessage(params[0], params.slice(1));
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
 * @param {string} req.body.text The user's search query.
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

      // Verify that this request came from Slack
      verifyWebhook(req.body);

      // Send the response
      res.json(makePoll(req.body.text));
    })
    .catch(err => {
      console.error(err);
      res.status(err.code || 500).send(err);
      return Promise.reject(err);
    });
};