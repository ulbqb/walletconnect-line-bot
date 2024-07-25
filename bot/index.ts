"use strict";

import dotenv from "dotenv";
dotenv.config();
import { MessageEvent, TextMessage } from "@line/bot-sdk";
import { KaiaBotClient, createKaiaBotClient } from "./kaia_bot_client";
import { getSdkError } from "@walletconnect/utils";
import { Transaction } from "web3-types";

const bot = createKaiaBotClient({
  sbUrl: process.env.SUPABASE_URL ?? "",
  sbKey: process.env.SUPABASE_KEY ?? "",
  sbChannelId: process.env.SUPABASE_CHANNEL_ID ?? "",
  lineAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN ?? "",
  wcProjectId: process.env.WALLET_CONNECT_PROJECT_ID ?? "",
  rpcEndpoint: process.env.RPC_ENDPOINT ?? "",
});

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

async function say_hello(bot: KaiaBotClient, event: MessageEvent) {
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
    await bot.sendMessage(to, messages);
  } catch (e) {
    console.log(e);
  }
}

async function connect(bot: KaiaBotClient, event: MessageEvent) {
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
      await bot.sendMessage(to, messages);
      return;
    }
    const { uri, approval } = await bot.connect({
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
                  label: "Metamask",
                  uri:
                    process.env.MINI_WALLET_URL_COMPACT +
                    "/open/wallet/?url=" +
                    encodeURIComponent(
                      "metamask://wc?uri=" + encodeURIComponent(uri)
                    ),
                },
              },
              {
                type: "action",
                action: {
                  type: "uri",
                  label: "Mini Wallet",
                  uri:
                    process.env.MINI_WALLET_URL_TALL +
                    "/wc/?uri=" +
                    encodeURIComponent(uri),
                },
              },
              {
                type: "action",
                action: {
                  type: "uri",
                  label: "Kaikas(unsupported)",
                  uri: "https://www.vocabulary.com/dictionary/unsupported",
                },
              },
              {
                type: "action",
                action: {
                  type: "uri",
                  label: "Trust(unsupported)",
                  uri: "https://www.vocabulary.com/dictionary/unsupported",
                },
              },
            ],
          },
        },
      ];
      await bot.sendMessage(to, messages);

      const session = await approval();
      bot.setTopic(to, session.topic);
      const wallet = bot.getWalletInfo(to);
      messages = [
        {
          type: "text",
          text: `${wallet?.metadata.name} connected successfully`,
        },
      ];
      await bot.sendMessage(to, messages);
    }
  } catch (e) {
    console.log(e);
  }
}

async function myWallet(bot: KaiaBotClient, event: MessageEvent) {
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
      await bot.sendMessage(to, messages);
      return;
    }
    let messages: Array<TextMessage> = [
      {
        type: "text",
        text: `Connected wallet: ${wallet.metadata.name}\nYour address: ${wallet.addresses[0]}`,
      },
    ];
    await bot.sendMessage(to, messages);
  } catch (e) {
    console.log(e);
  }
}

async function sendTx(bot: KaiaBotClient, event: MessageEvent) {
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
      await bot.sendMessage(to, messages);
      return;
    }

    let uri = "";
    switch (wallet.metadata.name) {
      case "MetaMask Wallet":
        uri =
          process.env.MINI_WALLET_URL_COMPACT +
          "/open/wallet/?url=" +
          encodeURIComponent(wallet.metadata.redirect?.universal || "");
        break;
      case "Mini Wallet":
        uri = process.env.MINI_WALLET_URL_TALL!;
        break;
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
                label: `Open Wallet`,
                uri: uri,
              },
            },
          ],
        },
      },
    ];
    await bot.sendMessage(to, messages);

    const topic = bot.getTopic(to);
    const tx: Transaction = {
      from: wallet?.addresses[0],
      to: "0x0000000000000000000000000000000000000000",
      value: "0x1",
    };
    const gasPrice = await bot.getGasPrice();
    const gas = await bot.estimateGas(tx);
    const transactionId = await bot.request({
      topic: topic,
      chainId: "eip155:1001",
      request: {
        method: "eth_sendTransaction",
        params: [
          {
            from: tx.from,
            to: tx.to,
            data: tx.data,
            gasPrice: gasPrice,
            gasLimit: gas,
            value: tx.value,
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
    await bot.sendMessage(to, messages);
  } catch (e) {
    console.log(e);
  }
}

async function disconnect(bot: KaiaBotClient, event: MessageEvent) {
  try {
    const to = event.source.userId || "";
    if (!bot.getWalletInfo(to)) {
      const messages: Array<TextMessage> = [
        {
          type: "text",
          text: "You didn't connect a wallet",
        },
      ];
      await bot.sendMessage(to, messages);
      return;
    }

    const topic = bot.getTopic(to);

    await bot.disconnect({
      topic: topic,
      reason: getSdkError("USER_DISCONNECTED"),
    });
    bot.deleteTopic(to);
    const messages: Array<TextMessage> = [
      {
        type: "text",
        text: "Wallet has been disconnected",
      },
    ];
    await bot.sendMessage(to, messages);
  } catch (e) {
    console.log(e);
  }
}
