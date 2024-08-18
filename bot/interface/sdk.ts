import { KaiaBotClient } from "../kaia_bot_client";

export interface MessengerSdk {
    connect: (bot: KaiaBotClient, event: MessageEvent | any) => Promise<any>;
    myWallet: (bot: KaiaBotClient, event: MessageEvent | any) => Promise<any>;
    sendTx: (bot: KaiaBotClient, event: MessageEvent | any) => Promise<any>;
    disconnect: (
        bot: KaiaBotClient,
        event: MessageEvent | any,
    ) => Promise<any>;
    status: (bot: KaiaBotClient, event?: MessageEvent | any) => Promise<any>;
    say_hello: (
        bot: KaiaBotClient,
        event?: MessageEvent | any,
    ) => Promise<any>;
}
