// deno-lint-ignore-file no-explicit-any
import "https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

type Provider = "line" | "kakao";

Deno.serve(async (req: Request) => {
    const body = await req.json();
    const client = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    );

    const provider = getProvider(body);
    const botChannel = client.channel(provider);
    const returnChannel = client.channel("return");

    let response: any;
    if (provider == "kakao") {
        returnChannel.on("broadcast", { event: "return" }, (payload: any) => {
            console.log("broadcast receive: ", payload.payload);
            response = payload.payload;
        }).subscribe();
    }

    const sendWebhook = async (msg: any) => {
        return await botChannel.send({
            type: "broadcast",
            event: provider + ":webhook",
            payload: msg,
        });
    };

    if (provider == "line") {
        await sendWebhook(body.events);
    } else if (provider == "kakao") {
        await sendWebhook({
            action: body.action,
            intent: body.intent,
            userRequest: body.userRequest,
        });
    }

    // Timeout after 5 seconds
    if (provider == "kakao") {
        for (let i = 0; i < 50; i++) {
            if (response) {
                break;
            }
            await new Promise((resolve) => setTimeout(resolve, 100));
        }
    }

    client.removeChannel(botChannel);
    client.removeChannel(returnChannel);

    return new Response(response ? JSON.stringify(response) : "{}");
});

function getProvider(body: any): Provider {
    // TODO: More robust provider detection
    if (
        body.destination
    ) {
        return "line";
    } else if (
        body.bot
    ) {
        return "kakao";
    }
    throw new Error("Invalid request");
}
