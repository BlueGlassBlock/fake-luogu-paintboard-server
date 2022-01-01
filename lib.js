/**
* @license
* Copyright 2020-2021 Yufan You
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/

const fs = require('fs').promises;
const { inRange } = require('lodash');
const path = require('path');
const async = require('async');
const WebSocket = require('ws');
const server = require('server');
const json = require('server/reply/json');
const status = require('server/reply/status');
const Crypto = require('crypto');
const url = require('url');

const { get, post } = server.router;

const COLOR = [
  [0, 0, 0],
  [255, 255, 255],
  [170, 170, 170],
  [85, 85, 85],
  [254, 211, 199],
  [255, 196, 206],
  [250, 172, 142],
  [255, 139, 131],
  [244, 67, 54],
  [233, 30, 99],
  [226, 102, 158],
  [156, 39, 176],
  [103, 58, 183],
  [63, 81, 181],
  [0, 70, 112],
  [5, 113, 151],
  [33, 150, 243],
  [0, 188, 212],
  [59, 229, 219],
  [151, 253, 220],
  [22, 115, 0],
  [55, 169, 60],
  [137, 230, 66],
  [215, 255, 7],
  [255, 246, 209],
  [248, 203, 140],
  [255, 235, 59],
  [255, 193, 7],
  [255, 152, 0],
  [255, 87, 34],
  [184, 63, 39],
  [121, 85, 72],
];

const DEFAULT_COLOR = 2;

const constants = require('./constants');

function randomString(size = 25) {  
  return Crypto
    .randomBytes(size)
    .toString('base64')
    .slice(0, size)
}

async function createServer({
  port = constants.port,
  wsport = constants.wsport,
  noRestrict = false,
  cd = constants.cd,
  width = constants.width,
  height = constants.height,
  verbose = false,
} = {}) {
  const board = new Array(width).fill(0).map(() => new Array(height).fill(DEFAULT_COLOR));
  const lastPaint = new Map();

  const wsUrl = `ws://localhost:${wsport}/ws`;

  const homePage = await fs.readFile(path.resolve(__dirname, 'paintBoard.html'))
    .then((data) => data.toString()
      .replace(/\$wsUrl/g, wsUrl)
      .replace(/\$width/g, width)
      .replace(/\$height/g, height)
      .replace(/\$5width/g, 5 * width)
      .replace(/\$5height/g, 5 * height)
      .replace(/\$cd/g, cd));

  const wss = await new Promise((resolve, reject) => {
    const wsServer = new WebSocket.Server({ port: wsport, path: '/ws' });

    wsServer.on('connection', (ws) => {
      ws.on('message', (message) => {
        const msg = JSON.parse(message);
        if (msg.type === 'join_channel' && msg.channel === 'paintboard') {
          ws.send(JSON.stringify({ type: 'result' }));
        }
      });
    });

    wsServer.on('listening', () => resolve(wsServer));

    wsServer.on('error', (error) => reject(error));
  });

  function getBoard() {
    let result = '';
    board.forEach((column) => {
      column.forEach((cell) => {
        result += Number(cell).toString(COLOR.length);
      });
      result += '\n';
    });
    return result;
  }

  const paintQueue = async.queue(async ({
    x, y, color, log,
  }) => {
    board[x][y] = color;
    const broadcast = JSON.stringify({
      type: 'paintboard_update',
      x,
      y,
      color,
    });
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(broadcast);
      }
    });
    log.info(`WebSocket broadcast: ${broadcast}`);
  });

  async function resetToken(ctx) {
    return json({ status: 200, data: {token: randomString()} });
  }


  async function paint(ctx) {
    function response(statusCode, message) {
      ctx.log.info(`${statusCode}: ${message}`);
      return json({ status: statusCode, data: message });
    }

    const token = url.parse(ctx.url, true).query?.token;

    if (!noRestrict) {
      if (!token) {
        return response(401, '未找到 Token');
      }

      if (lastPaint.has(token) && Date.now() - lastPaint.get(token) < cd) {
        return response(403, `Token:${token} 冷却中`);
      }
    }

    if (ctx.data) {
      const x = +ctx.data.x;
      const y = +ctx.data.y;
      const color = +ctx.data.color;

      if (inRange(x, 0, width) && inRange(y, 0, height) && inRange(color, 0, COLOR.length)) {
        lastPaint.set(token, Date.now());
        await paintQueue.push({
          x, y, color, log: ctx.log,
        });
        return response(200, `成功（Token:${token}, x:${x}, y:${y}, color:${color}）`);
      }
    }

    return response(400, 'data 中的 x, y, color 不合法');
  }

  await server({ port, security: { csrf: false }, log: verbose ? 'info' : 'warning' }, [
    get('/paintBoard', () => homePage),
    get('/paintBoard/board', getBoard),
    post('/paintBoard/paint', paint),
    post('/paintBoard/resetToken', resetToken),
    get(() => status(404).send('Not Found')),
  ]);

  return {
    homePageUrl: `http://localhost:${port}/paintBoard`,
    wsUrl,
  };
}

module.exports = { createServer };
