import { MessengerSdk } from "../interface/sdk";
import { KaiaBotClient } from "../kaia_bot_client";
import { getSdkError } from "@walletconnect/utils";
import {
    BasicCard,
    QuickReply,
    SimpleText,
    SimpleThumbnail,
    SkillResponse,
    Template,
    WebLinkButton,
} from "kakao-chatbot-templates";

export class KakaoSdk implements MessengerSdk {
    async connect(bot: KaiaBotClient, event: any): Promise<void> {
        try {
            const user = event.userRequest.user.id || "";
            const wallet = bot.getWalletInfo(user);
            if (wallet) {
                const response = wrapResponse(
                    new Template(
                        [
                            new SimpleText(
                                `You have already connect ${wallet.metadata.name}\nYour address: ${
                                    wallet.addresses[0]
                                }\n\nDisconnect wallet firstly to connect a new one`,
                            ),
                        ],
                    ),
                );
                await bot.sendResponse(response);
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
                        chains: ["eip155:" + process.env.CHAIN_ID],
                        events: ["chainChanged", "accountsChanged"],
                    },
                },
            });
            if (uri) {
                let response = wrapResponse(
                    new Template([
                        new BasicCard({
                            description: "Choose your wallet",
                            thumbnail: new SimpleThumbnail(
                                `https://drive.google.com/uc?export=view&id=1lEseL9zsVaZD4rkuutFkPAxGxUZGpwNZ`,
                            ),
                            buttons: [
                                new WebLinkButton(
                                    "Metamask",
                                    process.env.MINI_WALLET_URL_COMPACT +
                                        "/open/wallet/?url=" +
                                        encodeURIComponent(
                                            "metamask://wc?uri=" +
                                                encodeURIComponent(uri),
                                        ),
                                ),
                                new WebLinkButton(
                                    "Mini Wallet",
                                    process.env.MINI_WALLET_URL_TALL +
                                        "/wc/?uri=" +
                                        encodeURIComponent(uri),
                                ),
                            ],
                        }),
                    ]),
                );
                await bot.sendResponse(response);
                const session = await approval();
                bot.setTopic(user, session.topic);
            }
        } catch (e) {
            console.error(e);
            await bot.sendResponse(e);
        }
    }

    async myWallet(bot: KaiaBotClient, event: any): Promise<void> {
        try {
            const user = event.userRequest.user.id || "";
            const wallet = bot.getWalletInfo(user);
            if (!wallet) {
                const response = wrapResponse(
                    new Template([
                        new SimpleText(
                            "You didn't connect a wallet",
                        ),
                    ]),
                );
                await bot.sendResponse(response);
                return;
            }

            const balance = await bot.getBalance(wallet.addresses[0] || "");
            const response = wrapResponse(
                new Template([
                    new SimpleText(
                        `${wallet.metadata.name}\n\nYour address: ${
                            wallet.addresses[0]
                        }\n\nYour balance: ${balance}`,
                    ),
                ]),
            );
            await bot.sendResponse(response);
        } catch (e) {
            console.error(e);
            await bot.sendResponse(e);
        }
    }

    async sendTx(bot: KaiaBotClient, event: any): Promise<void> {
        try {
            const user = event.userRequest.user.id || "";
            const wallet = bot.getWalletInfo(user);
            if (!wallet) {
                const response = wrapResponse(
                    new Template(
                        [
                            new SimpleText(
                                "You didn't connect a wallet",
                            ),
                        ],
                    ),
                );
                await bot.sendResponse(response);
                return;
            }
            let uri = "";
            switch (wallet.metadata.name) {
                case "MetaMask Wallet":
                    uri = process.env.MINI_WALLET_URL_COMPACT +
                        "/open/wallet/?url=" +
                        encodeURIComponent(
                            wallet.metadata.redirect?.universal || "",
                        );
                    break;
                case "Mini Wallet":
                    uri = process.env.MINI_WALLET_URL_TALL + "/wc/?uri=" +
                        encodeURIComponent(uri);
                    break;
            }

            let response = wrapResponse(
                new Template([
                    new BasicCard({
                        description:
                            `Open ${wallet.metadata.name} and confirm transaction`,
                        thumbnail: new SimpleThumbnail(
                            `https://drive.google.com/uc?export=view&id=14fPyHLPBunY-HhsA8tashjxj32Z4crRl`,
                        ),
                        buttons: [
                            new WebLinkButton(
                                "Open Wallet",
                                uri,
                            ),
                        ],
                    }),
                ]),
            );
            await bot.sendResponse(response);

            const topic = bot.getTopic(user);
            const transactionId = await bot.sendValueTx(
                topic,
                wallet.addresses[0] || "",
                "0x0000000000000000000000000000000000000000",
                "0x1",
            );

            response = wrapResponse(
                new Template([
                    new SimpleText(
                        `Transaction result\nhttps://baobab.klaytnscope.com/tx/${transactionId}`,
                    ),
                ]),
            );
            await bot.sendResponse(response);
        } catch (e) {
            console.error(e);
            await bot.sendResponse(e);
        }
    }

    async disconnect(bot: KaiaBotClient, event: any): Promise<void> {
        try {
            const user = event.userRequest.user.id || "";
            if (!bot.getWalletInfo(user)) {
                const response = wrapResponse(
                    new Template(
                        [
                            new SimpleText(
                                "You didn't connect a wallet",
                            ),
                        ],
                    ),
                );
                await bot.sendResponse(response);
                return;
            }

            const topic = bot.getTopic(user);
            await bot.disconnect({
                topic: topic,
                reason: getSdkError("USER_DISCONNECTED"),
            });
            bot.deleteTopic(user);
            const response = wrapResponse(
                new Template(
                    [
                        new SimpleText(
                            "Wallet has been disconnected",
                        ),
                    ],
                ),
            );
            await bot.sendResponse(response);
        } catch (e) {
            console.error(e);
            await bot.sendResponse(e);
        }
    }

    async status(bot: KaiaBotClient): Promise<void> {
        try {
            const blockInfo = await bot.getBlockInfo();
            const response = wrapResponse(
                new Template(
                    [
                        new SimpleText(
                            blockInfo,
                        ),
                    ],
                ),
            );
            await bot.sendResponse(response);
        } catch (e) {
            console.error(e);
            await bot.sendResponse(e);
        }
    }

    async say_hello(bot: KaiaBotClient): Promise<void> {
        try {
            const response = wrapResponse(
                new Template(
                    [
                        new SimpleText(
                            "This is an example of a Kakao bot for connecting to Kaia wallets and sending transactions with WalletConnect.\n\nCommands list:\n/connect - Connect to a wallet\n/my_wallet - Show connected wallet\n/send_tx - Send transaction\n/disconnect - Disconnect from the wallet",
                        ),
                    ],
                    [
                        new QuickReply({
                            label: "Connect",
                            action: "block",
                            messageText: "/connect",
                            blockId: "66c0a93a9109d53a3d9c266b",
                        }),
                        new QuickReply({
                            label: "My Wallet",
                            action: "block",
                            messageText: "/my_wallet",
                            blockId: "66c0accbd7822a7a6e8a0513",
                        }),
                        new QuickReply({
                            label: "Send Transaction",
                            action: "block",
                            messageText: "/send_tx",
                            blockId: "66c0acff632734050fdf8378",
                        }),
                        new QuickReply({
                            label: "Disconnect",
                            action: "block",
                            messageText: "/disconnect",
                            blockId: "66c0acea7712c0500c5a9422",
                        }),
                        new QuickReply({
                            label: "Chain Status",
                            action: "block",
                            messageText: "/status",
                            blockId: "66c157829109d53a3d9c3130",
                        }),
                    ],
                ),
            );
            await bot.sendResponse(response);
        } catch (e) {
            console.error(e);
            await bot.sendResponse(e);
        }
    }
}

function wrapResponse(response: Template): any {
    return (new SkillResponse(response)).render();
}
