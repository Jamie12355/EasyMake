import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://dshbiuojzgnhzizwcbee.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_hnl1XfEkTh8gbyCB7bjctw_49Wasqut";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const comprehensiveData = [
    // --- UK KNOWLEDGE ---
    {
        title: "UCL Application Deadlines 2026",
        content: "UCL normally opens its graduate application portal in mid-October. For competitive programs like Management and CS, early application by November is highly recommended. The final deadline is usually late March, but programs close early when full.",
        category: "timeline",
        tags: ["UCL", "UK", "2026", "Deadline"]
    },
    {
        title: "LSE Personal Statement Guidelines",
        content: "LSE heavily prioritizes academic rigor in personal statements over extracurriculars. 80% of the statement should focus on academic curiosity, specific theories, and alignment with the course module. Avoid generic 'why I like this subject' statements.",
        category: "expert_advice",
        tags: ["LSE", "Personal Statement", "UK", "G5"]
    },
    {
        title: "UK Russell Group Masters GPA Requirements",
        content: "For Top Russell Group universities (e.g., King's, Manchester, Warwick, Edinburgh), Chinese applicants from Tier 1 (985/211) universities typically need an 80-85% average. Double Non (双非) applicants usually need 85-90%, depending on the specific program's tier list.",
        category: "requirements",
        tags: ["Russell Group", "GPA", "UK", "Masters"]
    },

    // --- US KNOWLEDGE ---
    {
        title: "US Ivy League Holistic Review Process",
        content: "Ivy League schools use a holistic review process. While a near-perfect GPA and SAT/ACT are baseline expectations, admission hinges on demonstrated leadership, unique extracurricular impact (the 'spike'), and compelling essays that show personal character.",
        category: "expert_advice",
        tags: ["US", "Ivy League", "Undergrad"]
    },
    {
        title: "US Fall 2026 Early Decision Timelines",
        content: "For US undergraduate Fall 2026 entry, Early Decision (ED1) and Early Action (EA) deadlines are typically November 1, 2025. ED2 and Regular Decision (RD) deadlines fall around January 1-15, 2026. Applying ED significantly boosts acceptance rates for top-tier schools.",
        category: "timeline",
        tags: ["US", "ED", "EA", "2026", "Undergrad"]
    },
    {
        title: "US STEM OPT Extension Basics",
        content: "International students graduating from designated STEM degree programs in the US are eligible for a 24-month extension of their post-completion OPT (Optional Practical Training), allowing them to work in the US for up to 3 years without an H-1B visa.",
        category: "university_info",
        tags: ["US", "STEM", "OPT", "Visa"]
    },

    // --- AUSTRALIA GO8 KNOWLEDGE ---
    {
        title: "Australia Go8 Admission Characteristics",
        content: "Group of Eight (Go8) universities in Australia (like UniMelb, USYD, UNSW) are generally GPA-driven for Masters admissions. They have clear, transparent grade cutoffs based on the applicant's Chinese university tier. Portfolios or interviews are rarely required outside of art/design degrees.",
        category: "requirements",
        tags: ["Australia", "Go8", "GPA", "Masters"]
    },
    {
        title: "Australia 2026 Intakes",
        content: "Unlike the UK/US, Australian universities typically have two main intakes: Semester 1 (February/March) and Semester 2 (July/August). Applications are rolling, so applying 6-9 months in advance is recommended to secure COE and process visas.",
        category: "timeline",
        tags: ["Australia", "2026", "Intake"]
    },

    // --- HK/SG KNOWLEDGE ---
    {
        title: "Hong Kong Top 3 (HKU, CUHK, HKUST) Application Strategy",
        content: "Applications for HK Top 3 Masters programs usually open in September and are reviewed on a rolling basis. The 'first-come, first-served' principle strongly applies. Applying in the first round (Sept-Nov) is critical as later rounds are extremely competitive.",
        category: "timeline",
        tags: ["Hong Kong", "HKU", "CUHK", "HKUST", "Masters"]
    },
    {
        title: "NUS & NTU (Singapore) Admission Preferences",
        content: "National University of Singapore (NUS) and Nanyang Technological University (NTU) highly favor applicants from 985/211 universities in China with exceptional GPAs (85%+). Strong professional experience or research publications can sometimes offset slightly lower grades.",
        category: "requirements",
        tags: ["Singapore", "NUS", "NTU", "Masters"]
    },

    // --- GENERAL EXPERT ADVICE ---
    {
        title: "Art & Design Portfolio Advice (UAL/Parsons)",
        content: "For top art schools like UAL and Parsons, the portfolio must demonstrate the creative process, not just final pieces. Include sketchbooks, ideation, material experimentation, and critical reflection. Quality over quantity; 15-20 strong pages is ideal.",
        category: "expert_advice",
        tags: ["Art", "Design", "UAL", "Parsons", "Portfolio"]
    },
    {
        title: "Understanding Conditional vs. Unconditional Offers",
        content: "A Conditional Offer means you have a place, provided you meet certain requirements before enrollment (usually final GPA or IELTS score). An Unconditional Offer means you have met all academic requirements and your place is guaranteed upon acceptance.",
        category: "university_info",
        tags: ["Offers", "Terminology"]
    }
];

async function seedMassive() {
    console.log("Agent 4: Initiating Comprehensive Knowledge Harvest...");

    // Insert data (ignoring conflicts if they already exist based on title)
    const { data, error } = await supabase
        .from('agency_knowledge')
        .upsert(comprehensiveData, { onConflict: 'title' });

    if (error) {
        console.error("❌ Error inserting massive data:", error.message);
    } else {
        console.log(`✅ Successfully injected ${comprehensiveData.length} new records into the Supabase Knowledge Base!`);
    }
}

seedMassive();
