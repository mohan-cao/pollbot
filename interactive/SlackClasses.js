exports.Message = class Message {
  constructor() {
    this.type = "";
    this.user = "";
    this.ts = NaN;
    this.text = "";
  }
}

exports.Channel = class Channel {
  constructor() {
    this.id = "";
    this.name = "";
  }
}

exports.User = class User {
  constructor() {
    this.id = "";
  }
}

exports.Action = class Action {
  constructor() {
    this.type = "";
  }
}

exports.Button = class Button extends exports.Action {
  constructor() {
    super();
    this.type = "button";
    this.text = "";
    this.action_id = "";
    this.url = "";
    this.value = "";
    this.style = "primary";
    this.confirm = {
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
    };
  }
}

exports.SlackRequest = class SlackRequest {
  constructor() {
    this.token = "";
    this.user = new User();
    this.message = new Message();
    this.container = {
      message_ts: ""
    }
    this.channel = new Channel();
    this.actions = [new Action()];
    this.response_url = "";
  }
}