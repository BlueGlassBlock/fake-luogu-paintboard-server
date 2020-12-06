# fake-luogu-paintboard-server

模拟[洛谷冬日绘板](https://www.luogu.com.cn/paintBoard)服务器，可用于测试脚本。

[![npm](https://img.shields.io/npm/v/fake-luogu-paintboard-server)](https://www.npmjs.com/package/fake-luogu-paintboard-server)

## 安装/运行

### NPM

```sh
npm install -g fake-luogu-paintboard-server
```

```sh
fake-luogu-paintboard-server --help
```

### 手动安装

```sh
git clone https://github.com/ouuan/fake-luogu-paintboard-server
cd fake-luogu-paintboard-server
yarn
```

```sh
yarn start --help
```

## HTTP API

由于洛谷冬日绘板活动已经结束（还未开始），部分 API 的具体返回值和提示信息难以考证，可能稍微有些不准确。

### `GET(http://localhost:<port>/paintBoard)`

返回 [洛谷冬日绘板主页](https://www.luogu.com.cn/paintBoard) 的 HTML。

### `GET(http://localhost:<port>/paintBoard/board)`

返回一个包含 `WIDTH` 行的字符串，其中第 `i` 行包含 `HEIGHT` 个字符，其中的第 `j` 个字符是绘板上第 `i + 1` 列第 `j + 1` 行的颜色的编号的 32 进制（10-31 用小写字母 a-v 表示）。

### `POST(http://localhost:<port>/paintBoard/paint)`

要求：

1.  传入一个带 `_uid` 和 `__client_id` 的 Cookie；
2.  Referer 为 `Referer: https://www.luogu.com.cn/paintBoard`；
3.  data 为：`{x:<columnIndex>,y:<rowIndex>,color:<colorIndex>}`，表示在第 `x + 1` 列第 `y + 1` 行的像素画编号为 `color` 的颜色。

## WebSocket API

### `send({"type":"join_channel","channel":"paintboard"})`

服务器收到客户端的这条消息后会回复 `{"type":"result"}`。

### `receive({"type":"paintboard_update",x,y,color})`

在一个绘制事件成功时，服务器会向所有已连接的客户端发送 `{"type":"paintboard_update",x,y,color}` 表示这次绘制的像素坐标以及新颜色的编号。
