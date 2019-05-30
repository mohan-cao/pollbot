/**
 * Copyright 2017, Google, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

const proxyquire = require('proxyquire').noCallThru();
const sinon = require('sinon');
const assert = require('assert');
const tools = require('@google-cloud/nodejs-repo-tools');

const method = 'POST';
const text = 'giraffe 123 456 789';
const SLACK_TOKEN = 'slack-token';

function getSample() {
  const config = {
    SLACK_TOKEN: SLACK_TOKEN
  };
  const googleapis = {};

  return {
    program: proxyquire('../', {
      googleapis: {google: googleapis},
      './config.json': config,
    }),
    mocks: {
      googleapis: googleapis,
      config: config,
    },
  };
}

function getMocks() {
  const req = {
    headers: {},
    query: {},
    body: {},
    get: function(header) {
      return this.headers[header];
    },
  };
  sinon.spy(req, 'get');
  const res = {
    headers: {},
    send: sinon.stub().returnsThis(),
    json: sinon.stub().returnsThis(),
    end: sinon.stub().returnsThis(),
    status: function(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    set: function(header, value) {
      this.headers[header] = value;
      return this;
    },
  };
  sinon.spy(res, 'status');
  sinon.spy(res, 'set');
  return {
    req: req,
    res: res,
  };
}

beforeEach(tools.stubConsole);
afterEach(tools.restoreConsole);

/**
 * Happy paths
 */

it('Handles a proper request', async () => {
  const mocks = getMocks();
  const sample = getSample();

  mocks.req.method = method;
  mocks.req.body.token = SLACK_TOKEN;
  mocks.req.body.text = text;
  
  await sample.program.pollbot(mocks.req, mocks.res);

  assert.strictEqual(mocks.res.json.callCount, 1);
  assert.strictEqual(console.error.callCount, 0);
});

/**
 * Sad paths
 */

it('Send fails if not a POST request', async () => {
  const error = new Error('Only POST requests are accepted');
  error.code = 405;
  const mocks = getMocks();
  const sample = getSample();

  try {
    await sample.program.pollbot(mocks.req, mocks.res);
  } catch (err) {
    assert.deepStrictEqual(err, error);
    assert.strictEqual(mocks.res.status.callCount, 1);
    assert.deepStrictEqual(mocks.res.status.firstCall.args, [error.code]);
    assert.strictEqual(mocks.res.send.callCount, 1);
    assert.deepStrictEqual(mocks.res.send.firstCall.args, [error]);
    assert.strictEqual(console.error.callCount, 1);
    assert.deepStrictEqual(console.error.firstCall.args, [error]);
  }
});

it('Throws if invalid slack token', async () => {
  const error = new Error('Invalid credentials');
  error.code = 401;
  const mocks = getMocks();
  const sample = getSample();

  mocks.req.method = method;
  mocks.req.body.token = 'wrong';

  try {
    await sample.program.pollbot(mocks.req, mocks.res);
  } catch (err) {
    assert.deepStrictEqual(err, error);
    assert.strictEqual(mocks.res.status.callCount, 1);
    assert.deepStrictEqual(mocks.res.status.firstCall.args, [error.code]);
    assert.strictEqual(mocks.res.send.callCount, 1);
    assert.deepStrictEqual(mocks.res.send.firstCall.args, [error]);
    assert.strictEqual(console.error.callCount, 1);
    assert.deepStrictEqual(console.error.firstCall.args, [error]);
  }
});

it('Handles error', async () => {
  const error = new Error('error');
  const mocks = getMocks();
  const sample = getSample();

  mocks.req.method = method;
  mocks.req.body.token = SLACK_TOKEN;
  mocks.req.body.text = text;

  try {
    await sample.program.pollbot(mocks.req, mocks.res);
  } catch (err) {
    assert.deepStrictEqual(err, error);
    assert.strictEqual(mocks.res.status.callCount, 1);
    assert.deepStrictEqual(mocks.res.status.firstCall.args, [500]);
    assert.strictEqual(mocks.res.send.callCount, 1);
    assert.deepStrictEqual(mocks.res.send.firstCall.args, [error]);
    assert.strictEqual(console.error.callCount, 1);
    assert.deepStrictEqual(console.error.firstCall.args, [error]);
  }
});