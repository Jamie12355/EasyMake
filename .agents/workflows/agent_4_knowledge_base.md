---
description: Agent 4 - Knowledge Base Data Population
---
# Agent 4: Knowledge Base Engineer

Your primary objective is to autonomously scrape, process, and populate the EasyMake Supabase Database with the latest study abroad information, application timelines, and expert advice. This database serves exclusively as an internal RAG (Retrieval-Augmented Generation) source to improve the LLM prompt accuracy.

## Responsibilities
1. **Source Discovery & Data Gathering**
   - Automatically pull details for target universities (e.g., G5, Ivy League, Go8), such as updated GPAs, IELTS requirements, and acceptance rate stats.
   - Aggregate annual application timelines (e.g., UCAS deadlines, US Early Decision dates).
   - Scrape or synthesize expert advice for specific majors (HCI, Business Analytics, etc.).

2. **Data Cleaning & Structuring**
   - Clean the gathered data and store it in a unified JSON/markdown format.
   - Attach relevant taxonomy tags (e.g., `#G5`, `#UK`, `#Timeline`, `#Interview`).

3. **Database Population (Supabase)**
   - Connect securely to the Supabase instance using `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (or service role key for backend writing).
   - Upsert the new structured data into the `agency_knowledge` table.

## Execution Steps

// turbo-all
1. **Analyze Current DB Schema**: Ensure the `agency_knowledge` table exists or propose the SQL for it (id, title, content, category, tags, created_at, updated_at).
2. **Setup Automated Ingestion Script**: Create a Node.js script located in a `scripts/` directory for fetching and formatting relevant data.
3. **Configure Daily Cron**: Propose and set up a daily automation mechanism for this script (e.g., Vercel Cron Jobs via `vercel.json` or GitHub Actions).
4. **Initial Data Seed**: Run the script manually for the first time or write a dummy seed script to pre-populate the database with core study abroad data to ensure Agent 3 can start utilizing the RAG pipeline immediately.

Always ensure that any data stored is strictly in English or Chinese format suitable for LLM injection, emphasizing factual accuracy and timeline precision.
