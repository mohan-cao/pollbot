const fetch = require("node-fetch");
const env_yaml = require('env-yaml');
const logger = require('./log.js')(process.env.NODE_ENV, console)

if (process.env.NODE_ENV === "development") {
  env_yaml.config({ path: '../.env.yml' });
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
 * Makes and returns a response
 * 
 * @param {string} channel channel of poll msg
 * @param {string} ts timestamp of poll msg
 */
function makeResponse(channel, ts) {
  return {
    text: "Successfully made the poll!",
    blocks: [
      {
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": `Successfully made the poll!`
        }
      },
      {
        "type": "actions",
        "elements": [{
          "type": "button",
          "text": {
            "type": "plain_text",
            "text": `Delete the poll?`,
            "emoji": true
          },
          "style": "danger",
          "action_id": "deletePoll",
          "value": channel + ',' + ts,
          "confirm": {
            "title": {
              "type": "plain_text",
               "text": "Are you sure?"
            },
            "text": {
               "type": "mrkdwn",
               "text": "You can't change your mind."
            },
            "confirm": {
                "type": "plain_text",
                "text": "Do it"
            },
            "deny": {
                "type": "plain_text",
                "text": "Stop!"
            }
          }
        }]
      }
    ],
    response_type: "ephemeral"
  };
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
exports.pollbot = async function(req, res) {
  try {
    // Accept POST only
    if (req.method !== 'POST') {
      throw new HTTPError(405, 'Only POST requests are accepted');
    }

    // Verify that this request came from Slack
    verifyWebhook(req.body);

    // Parse prompt and options from body text
    const params = getPromptAndOptionsFromBody(req.body.text);
    const [prompt, ...options] = params;

    // Send slack message and react to it
    const pollText = formatSlackMessage(prompt, options);
    const x = await sendMessage(req.body.channel_id, req.body.user_name, pollText);
    sendEmojis(x.channel, x.ts, options.length);

    const response = makeResponse(x.channel, x.ts);
    // Send response
    res.json(response);
  }
  catch (err) {
    logger.error(JSON.stringify(err));
    res.status(err.status || 500).json(err);
  }
}