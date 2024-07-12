"use strict";

import dotenv from "dotenv";
dotenv.config();
import {
  SupabaseClient,
  RealtimeChannel,
  createClient,
} from "@supabase/supabase-js";
import { messagingApi } from "@line/bot-sdk";
import { SignClient } from "@walletconnect/sign-client";
import { ISignClient, SignClientTypes } from "@walletconnect/types";

export class Web3BotClient {
  sbClient: SupabaseClient<any>;
  sbChannel: RealtimeChannel;
  lineMessagingApiClient: messagingApi.MessagingApiClient;
  wcSignClient: ISignClient;
  wcTopics: { [key: string]: string };
  callbacks: { [key: string]: (event: any) => void };

  constructor() {
    // supabase
    this.sbClient = createClient(
      process.env.SUPABASE_URL ?? "",
      process.env.SUPABASE_KEY ?? ""
    );
    this.sbChannel = this.sbClient.channel(
      process.env.SUPABASE_CHANNEL_ID ?? ""
    );

    // line
    this.lineMessagingApiClient = new messagingApi.MessagingApiClient({
      channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN ?? "",
    });

    // wallet connect
    let bufClient: ISignClient | null = null;
    SignClient.init({
      projectId: process.env.WALLET_CONNECT_PROJECT_ID,
      // optional parameters
      // relayUrl: "<YOUR RELAY URL>",
      metadata: {
        name: "Wallet Connect Bot",
        description: "Wallet Connect Bot",
        url: "https://line.me",
        icons: ["https://walletconnect.com/walletconnect-logo.png"],
      },
    })
      .then((result) => (bufClient = result))
      .catch((error) => console.log(error));
    while (bufClient === null) {
      require("deasync").runLoopOnce();
    }
    this.wcSignClient = bufClient;
    this.wcTopics = {};

    // bot
    this.callbacks = {};
  }

  async start() {
    this.sbChannel
      .on("broadcast", { event: "webhook" }, (payload) => {
        for (const event of payload.payload.events) {
          const cb = this.callbacks[event.type];
          if (cb) {
            cb(event);
          }
        }
      })
      .subscribe();
  }

  on(type: string, callback: (event: any) => void) {
    this.callbacks[type] = callback;
  }

  getWalletInfo(
    userId: string
  ): { metadata: SignClientTypes.Metadata; addresses: Array<string> } | null {
    const topic = this.wcTopics[userId] || "";
    try {
      const session = this.wcSignClient.session.get(topic);
      if (session.expiry * 1000 <= Date.now() + 1000) {
        return null;
      }
      return {
        metadata: session.peer.metadata,
        addresses:
          session.namespaces["eip155"]?.accounts.map(
            (a) => a.split(":")[2] || ""
          ) || [],
      };
    } catch (e) {
      return null;
    }
  }
}

export function createWeb3BotClient(): Web3BotClient {
  return new Web3BotClient();
}
