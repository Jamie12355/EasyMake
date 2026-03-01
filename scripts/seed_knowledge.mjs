import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://dshbiuojzgnhzizwcbee.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_hnl1XfEkTh8gbyCB7bjctw_49Wasqut";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const initialData = [
    {
        title: "2026 UCAS Application Timeline",
        content: "UCAS application cycle for 2026 entry opens early September 2025. Oxbridge/Medicine deadline is October 15, 2025. Equal consideration deadline for all other courses is late January 2026.",
        category: "timeline",
        tags: ["UCAS", "UK", "2026"]
    },
    {
        title: "G5 University GPA & IELTS Requirements",
        content: "To realistically apply to G5 institutions (Oxford, Cambridge, LSE, Imperial, UCL), students typically need a minimum GPA of 3.8/4.0 (or 85%+ for Chinese universities), and an IELTS score of 7.0-7.5 with no band lower than 6.5.",
        category: "requirements",
        tags: ["G5", "GPA", "IELTS", "UK"]
    },
    {
        title: "Business Analytics Application Advice",
        content: "When applying for Business Analytics programs at Imperial College or UCL, strongly highlight programming skills (Python/R) and quantitative background. Portfolios featuring real-world data science projects significantly increase offer rates.",
        category: "expert_advice",
        tags: ["Business Analytics", "Imperial", "UCL", "UK"]
    },
    {
        title: "Imperial College London - Target Facts",
        content: "Imperial College London strictly prioritizes STEM boundaries. Their Business School is heavily quantitative. Average acceptance rate hovers around 15%, but highly competitive courses drop to 5%.",
        category: "university_info",
        tags: ["Imperial", "G5", "STEM", "London"]
    }
];

async function seed() {
    console.log("Agent 4: Initializing Knowledge Base Harvest...");

    // First, test if the table exists by doing a simple select
    const { data: test, error: testError } = await supabase.from('agency_knowledge').select('id').limit(1);

    if (testError && testError.code === '42P01') {
        console.error("\n❌ ERROR: Table 'agency_knowledge' does not exist yet.");
        console.error("Please run the SQL snippet in your Supabase SQL Editor first!");
        return;
    }

    // Insert data (ignoring conflicts if they already exist based on title)
    const { data, error } = await supabase
        .from('agency_knowledge')
        .upsert(initialData, { onConflict: 'title' });

    if (error) {
        console.error("Error inserting data:", error.message);
    } else {
        console.log("✅ Successfully seeded the Supabase Knowledge Base!");
    }
}

seed();
