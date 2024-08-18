"use strict";

import dotenv from "dotenv";
dotenv.config();
import { MessageEvent } from "@line/bot-sdk";
import { createKaiaBotClient } from "./kaia_bot_client";
import {
    kakaoChannelName,
    KakaoSdk,
    lineChannelName,
    LineSdk,
} from "./implementations";

const lineSdk = new LineSdk();
const kakaoSdk = new KakaoSdk();

const bot = createKaiaBotClient({
    sbUrl: process.env.SUPABASE_URL ?? "",
    sbKey: process.env.SUPABASE_KEY ?? "",
    sbChannelIds: ["line", "kakao"],
    lineAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN ?? "",
    wcProjectId: process.env.WALLET_CONNECT_PROJECT_ID ?? "",
    rpcEndpoint: process.env.RPC_ENDPOINT ?? "",
});

bot.on(lineChannelName, (event: MessageEvent) => {
    if (event.message.type == "text") {
        switch (event.message.text || "") {
            case "/connect":
                lineSdk.connect(bot, event);
                break;
            case "/my_wallet":
                lineSdk.myWallet(bot, event);
                break;
            case "/send_tx":
                lineSdk.sendTx(bot, event);
                break;
            case "/disconnect":
                lineSdk.disconnect(bot, event);
                break;
            case "/status":
                lineSdk.status(bot, event);
                break;
            default:
                lineSdk.say_hello(bot, event);
        }
    }
});

bot.on(kakaoChannelName, (payload: any) => {
    switch (payload.action.params.action || payload.userRequest.utterance) {
        case "/connect":
            kakaoSdk.connect(bot, payload);
            break;
        case "/my_wallet":
            kakaoSdk.myWallet(bot, payload);
            break;
        case "/send_tx":
            kakaoSdk.sendTx(bot, payload);
            break;
        case "/disconnect":
            kakaoSdk.disconnect(bot, payload);
            break;
        case "/status":
            kakaoSdk.status(bot);
            break;
        default:
            kakaoSdk.say_hello(bot);
    }
});

bot.start();
