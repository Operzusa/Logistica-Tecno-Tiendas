import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push";

// Configure web-push with your VAPID keys
// These should be set in your Supabase Edge Function secrets
const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY") || "";
const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY") || "";
const vapidSubject = "mailto:admin@tecnologistics.com";

webpush.setVapidDetails(
  vapidSubject,
  vapidPublicKey,
  vapidPrivateKey
);

serve(async (req) => {
  try {
    const payload = await req.json();
    
    // Ensure this is an UPDATE event on the servicios table
    if (payload.type !== "UPDATE" || payload.table !== "servicios") {
      return new Response("Not an update on servicios", { status: 200 });
    }

    const oldRecord = payload.old_record;
    const newRecord = payload.record;

    // Only notify if the status has actually changed
    if (oldRecord.estado === newRecord.estado) {
      return new Response("Status did not change", { status: 200 });
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find the relevant users to notify
    // We notify the assigned domiciliario, and maybe admins.
    // Let's get the domiciliario's subscriptions
    const { data: subscriptions, error } = await supabase
      .from("push_subscriptions")
      .select("*")
      .eq("user_id", newRecord.domiciliario_id);

    if (error) {
      console.error("Error fetching subscriptions:", error);
      return new Response("Error fetching subscriptions", { status: 500 });
    }

    if (!subscriptions || subscriptions.length === 0) {
      return new Response("No subscriptions found for user", { status: 200 });
    }

    const notificationPayload = JSON.stringify({
      title: "Actualización de Servicio",
      body: `El servicio de ${newRecord.cliente?.nombre || 'Cliente'} ha cambiado a: ${newRecord.estado}`,
      icon: "https://api.dicebear.com/7.x/shapes/svg?seed=tecno&backgroundColor=0d93f2",
      data: {
        url: "/",
        serviceId: newRecord.id
      }
    });

    const sendPromises = subscriptions.map(async (sub) => {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth
        }
      };

      try {
        await webpush.sendNotification(pushSubscription, notificationPayload);
      } catch (err) {
        console.error("Error sending push notification:", err);
        // If the subscription is invalid/expired, we should delete it
        if (err.statusCode === 410 || err.statusCode === 404) {
          await supabase
            .from("push_subscriptions")
            .delete()
            .eq("id", sub.id);
        }
      }
    });

    await Promise.all(sendPromises);

    return new Response("Notifications sent successfully", { status: 200 });
  } catch (error) {
    console.error("Error processing webhook:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
});
