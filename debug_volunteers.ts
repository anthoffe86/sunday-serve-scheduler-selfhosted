import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config();

async function debug() {
    const supabaseUrl = process.env.VITE_SUPABASE_URL!;
    const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY!; // Or use service key if available locally
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("Checking role preferences for 'sidesman-sound'...");
    const { data: rolePrefs, error: rpError } = await supabase
        .from("role_preferences")
        .select("user_id, role")
        .eq("role", "sidesman-sound");

    if (rpError) {
        console.error("Error fetching role prefs:", rpError);
        return;
    }

    console.log(`Found ${rolePrefs.length} role preferences for 'sidesman-sound'.`);
    const userIds = rolePrefs.map(r => r.user_id);

    console.log("Checking profiles for these users...");
    const { data: profiles, error: pError } = await supabase
        .from("profiles")
        .select("user_id, name, email, active")
        .in("user_id", userIds);

    if (pError) {
        console.error("Error fetching profiles:", pError);
        return;
    }

    console.log("Eligible Volunteers Data:");
    profiles.forEach(p => {
        console.log(`- ${p.name} (${p.email}), Active: ${p.active}`);
    });
}

debug();
