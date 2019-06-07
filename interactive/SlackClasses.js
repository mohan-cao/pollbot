export class Message {
  constructor() {
    this.type = "";
    this.user = "";
    this.ts = NaN;
    this.text = "";
  }
}

export class Channel {
  constructor() {
    this.id = "";
    this.name = "";
  }
}

export class User {
  constructor() {
    this.id = "";
  }
}

export class SlackRequest {
  constructor() {
    this.token = "";
    this.user = new User();
    this.message = new Message();
    this.channel = new Channel();
    this.actions = [];
  }
}