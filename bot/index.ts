"use strict";

import dotenv from "dotenv";
dotenv.config();
import { MessageEvent, TextMessage, QuickReply } from "@line/bot-sdk";
import { Web3BotClient, createWeb3BotClient } from "./web3_bot_client";
import { getSdkError } from "@walletconnect/utils";

const bot = createWeb3BotClient();

bot.on("message", (event: MessageEvent) => {
  if (event.message.type == "text") {
    switch (event.message.text) {
      case "/connect":
        connect(bot, event);
        break;
      case "/my_wallet":
        myWallet(bot, event);
        break;
      case "/send_tx":
        sendTx(bot, event);
        break;
      case "/disconnect":
        disconnect(bot, event);
        break;
      default:
        say_hello(bot, event);
    }
  }
});

bot.start();

async function say_hello(bot: Web3BotClient, event: MessageEvent) {
  try {
    const to = event.source.userId || "";
    const messages: Array<TextMessage> = [
      {
        type: "text",
        text: "This is an example of a LINE bot for connecting to Klaytn wallets and sending transactions with WalletConnect.\n\nCommands list:\n/connect - Connect to a wallet\n/my_wallet - Show connected wallet\n/send_tx - Send transaction\n/disconnect - Disconnect from the wallet",
        quickReply: {
          items: [
            {
              type: "action",
              action: {
                type: "message",
                label: "/connect",
                text: "/connect",
              },
            },
            {
              type: "action",
              action: {
                type: "message",
                label: "/my_wallet",
                text: "/my_wallet",
              },
            },
            {
              type: "action",
              action: {
                type: "message",
                label: "/send_tx",
                text: "/send_tx",
              },
            },
            {
              type: "action",
              action: {
                type: "message",
                label: "/disconnect",
                text: "/disconnect",
              },
            },
          ],
        },
      },
    ];
    await bot.lineMessagingApiClient.pushMessage({ to, messages });
  } catch (e) {
    console.log(e);
  }
}

async function connect(bot: Web3BotClient, event: MessageEvent) {
  try {
    const to = event.source.userId || "";
    const wallet = bot.getWalletInfo(to);
    if (wallet) {
      let messages: Array<TextMessage> = [
        {
          type: "text",
          text: `You have already connect ${wallet.metadata.name}\nYour address: ${wallet.addresses[0]}\n\nDisconnect wallet firstly to connect a new one`,
        },
      ];
      await bot.lineMessagingApiClient.pushMessage({ to, messages });
      return;
    }
    const { uri, approval } = await bot.wcSignClient.connect({
      requiredNamespaces: {
        eip155: {
          methods: [
            "eth_sendTransaction",
            "eth_signTransaction",
            "eth_sign",
            "personal_sign",
            "eth_signTypedData",
          ],
          chains: ["eip155:1001"],
          events: ["chainChanged", "accountsChanged"],
        },
      },
    });

    if (uri) {
      let messages: Array<TextMessage> = [
        {
          type: "text",
          text: "Choose your wallet",
          quickReply: {
            items: [
              {
                type: "action",
                action: {
                  type: "uri",
                  label: "@Wallet",
                  uri:
                    process.env.MINI_WALLET_URL +
                    "/wc?uri=" +
                    encodeURIComponent(uri),
                },
              },
              {
                type: "action",
                action: {
                  type: "uri",
                  label: "Metamask",
                  uri:
                    "https://metamask.app.link/wc?uri=" +
                    encodeURIComponent(uri),
                },
              },
            ],
          },
        },
      ];
      await bot.lineMessagingApiClient.pushMessage({ to, messages });

      const session = await approval();
      bot.wcTopics[to] = session.topic;
      const wallet = bot.getWalletInfo(to);
      messages = [
        {
          type: "text",
          text: `${wallet?.metadata.name} connected successfully`,
        },
      ];
      await bot.lineMessagingApiClient.pushMessage({ to, messages });
    }
  } catch (e) {
    console.log(e);
  }
}

async function myWallet(bot: Web3BotClient, event: MessageEvent) {
  try {
    const to = event.source.userId || "";
    const wallet = bot.getWalletInfo(to);
    if (!wallet) {
      const messages: Array<TextMessage> = [
        {
          type: "text",
          text: "You didn't connect a wallet",
        },
      ];
      await bot.lineMessagingApiClient.pushMessage({ to, messages });
      return;
    }
    let messages: Array<TextMessage> = [
      {
        type: "text",
        text: `Connected wallet: ${wallet.metadata.name}\nYour address: ${wallet.addresses[0]}`,
      },
    ];
    await bot.lineMessagingApiClient.pushMessage({ to, messages });
  } catch (e) {
    console.log(e);
  }
}

async function sendTx(bot: Web3BotClient, event: MessageEvent) {
  try {
    const to = event.source.userId || "";
    const wallet = bot.getWalletInfo(to);
    if (!wallet) {
      const messages: Array<TextMessage> = [
        {
          type: "text",
          text: "Connect wallet to send transaction",
        },
      ];
      await bot.lineMessagingApiClient.pushMessage({ to, messages });
      return;
    }

    let messages: Array<TextMessage> = [
      {
        type: "text",
        text: `Open ${wallet.metadata.name} and confirm transaction`,
        quickReply: {
          items: [
            {
              type: "action",
              action: {
                type: "uri",
                label: `Open ${wallet.metadata.name}`,
                uri: wallet.metadata.redirect?.universal || "",
              },
            },
          ],
        },
      },
    ];
    await bot.lineMessagingApiClient.pushMessage({ to, messages });

    const topic = bot.wcTopics[to] || "";
    const transactionId = await bot.wcSignClient.request({
      topic: topic,
      chainId: "eip155:1001",
      request: {
        method: "eth_sendTransaction",
        params: [
          {
            from: wallet?.addresses[0],
            to: "0x0000000000000000000000000000000000000000",
            data: "0x",
            gasPrice: "0x029104e28c",
            gas: "0x5208",
            value: "0x01",
          },
        ],
      },
    });

    messages = [
      {
        type: "text",
        text: `Transaction result\nhttps://baobab.klaytnscope.com/tx/${transactionId}`,
      },
    ];
    await bot.lineMessagingApiClient.pushMessage({ to, messages });
  } catch (e) {
    console.log(e);
  }
}

async function disconnect(bot: Web3BotClient, event: MessageEvent) {
  try {
    const to = event.source.userId || "";
    if (!bot.getWalletInfo(to)) {
      const messages: Array<TextMessage> = [
        {
          type: "text",
          text: "You didn't connect a wallet",
        },
      ];
      await bot.lineMessagingApiClient.pushMessage({ to, messages });
      return;
    }

    const topic = bot.wcTopics[to] || "";

    await bot.wcSignClient.disconnect({
      topic: topic,
      reason: getSdkError("USER_DISCONNECTED"),
    });
    delete bot.wcTopics[to];
    const messages: Array<TextMessage> = [
      {
        type: "text",
        text: "Wallet has been disconnected",
      },
    ];
    await bot.lineMessagingApiClient.pushMessage({ to, messages });
  } catch (e) {
    console.log(e);
  }
}
