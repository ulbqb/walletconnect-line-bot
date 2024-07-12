import "https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async (req: Request) => {
  const { destination, events } = await req.json();
  console.log(`destination: ${destination}, event num: ${events.length}`);

  const client = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );
  const channel = client.channel(destination);

  const isSuccess = await channel.send({
    type: "broadcast",
    event: "webhook",
    payload: { events },
  });

  console.log(`broadcast send ${isSuccess}`);

  client.removeChannel(channel);
  return new Response();
});
