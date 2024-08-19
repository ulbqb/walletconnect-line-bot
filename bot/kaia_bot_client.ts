"use strict";

import {
    createClient,
    RealtimeChannel,
    SupabaseClient,
} from "@supabase/supabase-js";
import { messagingApi } from "@line/bot-sdk";
import { SignClient } from "@walletconnect/sign-client";
import { EngineTypes, SessionTypes } from "@walletconnect/types";
import { ISignClient, SignClientTypes } from "@walletconnect/types";
import { Web3 } from "web3";
import { Transaction } from "web3-types";
import { kakaoChannelName, lineChannelName } from "./implementations";

export type Config = {
    sbUrl: string;
    sbKey: string;
    sbChannelIds: string[];
    lineAccessToken: string;
    wcProjectId: string;
    rpcEndpoint: string;
};

export class KaiaBotClient {
    sbClient: SupabaseClient<any>;
    sbChannels: RealtimeChannel[];
    returnChannel: RealtimeChannel;
    sbChannelIds: string[];
    lineMessagingApiClient: messagingApi.MessagingApiClient;
    wcSignClient: ISignClient;
    wcTopics: { [key: string]: string };
    callbacks: { [key: string]: (event: any) => void };
    web3Client: Web3;

    constructor(conf: Config) {
        // supabase
        this.sbChannelIds = conf.sbChannelIds;
        this.sbClient = createClient(conf.sbUrl, conf.sbKey);
        this.sbChannels = conf.sbChannelIds.map((name) =>
            this.sbClient.channel(name)
        );
        this.returnChannel = this.sbClient.channel("return");

        // line
        this.lineMessagingApiClient = new messagingApi.MessagingApiClient({
            channelAccessToken: conf.lineAccessToken,
        });

        // wallet connect
        let bufClient: ISignClient | null = null;
        SignClient.init({
            projectId: conf.wcProjectId,
            metadata: {
                name: "Wallet Connect Bot",
                description: "Wallet Connect Bot",
                url: "https://example.com",
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

        // web3
        this.web3Client = new Web3(
            new Web3.providers.HttpProvider(conf.rpcEndpoint),
        );
    }
    // supabase
    async start() {
        for (let i = 0; i < this.sbChannelIds.length; i++) {
            switch (this.sbChannelIds[i]) {
                case "line":
                    this.startLine(this.sbChannels[i]);
                    break;
                case "kakao":
                    this.startKakao(this.sbChannels[i]);
                    break;
            }
        }
    }

    startLine(channel: RealtimeChannel | undefined) {
        if (!channel) {
            return;
        }
        const name = lineChannelName;
        channel.on("broadcast", { event: name }, (payload) => {
            for (const event of payload.payload.events) {
                const cb = this.callbacks[name];
                if (cb) {
                    cb(event);
                }
            }
        }).subscribe();
    }

    startKakao(channel: RealtimeChannel | undefined) {
        if (!channel) {
            return;
        }
        const name = kakaoChannelName;
        channel.on("broadcast", { event: name }, (payload) => {
            const cb = this.callbacks[name];
            if (cb) {
                cb(payload.payload);
            }
        }).subscribe();
    }

    on(type: string, callback: (event: any) => void) {
        this.callbacks[type] = callback;
    }

    // line
    async sendMessage(to: string, messages: Array<messagingApi.Message>) {
        await this.lineMessagingApiClient.pushMessage({ to, messages });
    }

    async sendResponse(response: any) {
        await this.returnChannel.send({
            type: "broadcast",
            event: "return",
            payload: response,
        });
    }

    // walletconnect
    async connect(params: EngineTypes.ConnectParams): Promise<{
        uri?: string;
        approval: () => Promise<SessionTypes.Struct>;
    }> {
        return await this.wcSignClient.connect(params);
    }

    async disconnect(params: EngineTypes.DisconnectParams): Promise<void> {
        await this.wcSignClient.disconnect(params);
    }

    async request<T>(params: EngineTypes.RequestParams): Promise<T> {
        return await this.wcSignClient.request(params);
    }

    getTopic(to: string): string {
        return this.wcTopics[to] || "";
    }

    setTopic(to: string, topic: string) {
        this.wcTopics[to] = topic;
    }

    deleteTopic(to: string) {
        delete this.wcTopics[to];
    }

    getWalletInfo(
        userId: string,
    ): { metadata: SignClientTypes.Metadata; addresses: Array<string> } | null {
        const topic = this.wcTopics[userId] || "";
        try {
            const session = this.wcSignClient.session.get(topic);
            if (session.expiry * 1000 <= Date.now() + 1000) {
                return null;
            }
            return {
                metadata: session.peer.metadata,
                addresses: session.namespaces["eip155"]?.accounts.map(
                    (a) => a.split(":")[2] || "",
                ) || [],
            };
        } catch (e) {
            return null;
        }
    }

    async sendValueTx<T>(
        topic: string,
        from: string,
        to: string,
        value: string,
    ): Promise<T> {
        const tx: Transaction = {
            from,
            to,
            value,
        };
        const gasPrice = await this.getGasPrice();
        const gas = await this.estimateGas(tx);
        return await this.request({
            topic,
            chainId: "eip155:" + process.env.CHAIN_ID,
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
    }

    // rpc
    async getGasPrice(): Promise<string> {
        return this.web3Client.utils.toHex(
            await this.web3Client.eth.getGasPrice(),
        );
    }

    async getBalance(address: string): Promise<string> {
        if (!address) {
            return "0 KAIA";
        }
        const balance = BigInt(await this.web3Client.eth.getBalance(address));
        return (Number(balance) / 1e18).toFixed(2) + " KAIA";
    }

    async getBlockInfo(): Promise<string> {
        const block = await this.web3Client.eth.getBlock("latest");
        const blocknumber = block.number;
        const timestamp = Number(block.timestamp);
        const baseFee = Number(block.baseFeePerGas) / 10 ** 9;
        return `Current Kaia Status⛓️\n\nBlock Number: ${blocknumber}\nTimestamp: ${timestamp}\nBase Fee: ${baseFee} gkei`;
    }

    async estimateGas(transaction: Transaction): Promise<string> {
        return this.web3Client.utils.toHex(
            await this.web3Client.eth.estimateGas(transaction),
        );
    }
}

export function createKaiaBotClient(conf: Config): KaiaBotClient {
    return new KaiaBotClient(conf);
}
