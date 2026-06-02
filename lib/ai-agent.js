/**
 * lib/ai-agent.js - GDN AI (Gideon) Improvement Brain
 *
 * Mirrors the CrossLedger AI Organism, adapted to the GDN-AI-Gideon static site.
 * Analyzes the site and applies SEO/copy patches directly to the live homepage
 * (gdn-ai-trial.html) and refreshes public/sitemap.xml on each run.
 */

const Anthropic = require('@anthropic-ai/sdk').default;
const { readFileSync, writeFileSync, existsSync } = require('fs');
const path = require('path');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SITE_URL = 'https://gdn-ai.com';
const HOME_FILE = 'gdn-ai-trial.html';

const SITE_CONTEXT = `
GDN AI (branded "Gideon") is a Claude-powered business and trade assistant sold by membership.
Built by GDN Enterprise Pty Ltd (Brisbane, Dubai, Orlando, Sao Paulo).
Visitors get three free searches with Gideon, then a membership paywall.
Membership tiers are US$2 or US$7 per day, billed monthly or annually (annual saves 30 percent).
Target audience: business owners, traders, and professionals who want an AI assistant for trade and operations.
Key value props: instant AI answers, voice chat, an unlimited members workspace, professional trade and business support.
Design system: dark navy/leather/cream palette, professional and confident tone.
Tech: static HTML pages deployed on Vercel; the homepage is served from gdn-ai-trial.html.
`;

const IMPROVEMENT_AREAS = [
  {
        id: 'seo_metadata',
        name: 'SEO Meta Description and OG Tags',
        description: 'A meta description and Open Graph tags for the homepage to improve search and social previews',
        maxTokens: 400,
  },
  {
        id: 'hero_copy',
        name: 'Hero Headline and Subheading',
        description: 'Concise, conversion-focused hero copy describing Gideon and the free trial',
        maxTokens: 500,
  },
  {
        id: 'faq_content',
        name: 'FAQ Entry',
        description: 'One useful FAQ question and answer a prospective member might have',
        maxTokens: 600,
  },
  ];

async function runImprovementAgent() {
    console.log('[ai-agent] Starting GDN improvement run...');
    const improvements = [];

  for (const area of IMPROVEMENT_AREAS) {
        try {
                console.log('[ai-agent] Analyzing:', area.name);
                const improvement = await analyzeArea(area);
                if (improvement) improvements.push(improvement);
        } catch (err) {
                console.error('[ai-agent] Failed on area:', area.id, err.message);
        }
  }

  console.log('[ai-agent] Generated', improvements.length, 'improvements');

  try {
        await applyLivePatches(improvements);
  } catch (err) {
        console.error('[ai-agent] Live patch failed (non-fatal):', err.message);
  }

  return improvements;
}

async function analyzeArea(area) {
    const prompt = [
          'You are an AI growth agent for GDN AI (Gideon), a Claude-powered trade and business assistant.',
          'SITE CONTEXT:',
          SITE_CONTEXT,
          'YOUR TASK:',
          'Generate an improvement for the following area: ' + area.name,
          'Description: ' + area.description,
          'REQUIREMENTS:',
          '- Keep a professional, confident, trustworthy tone.',
          '- Never invent statistics, prices, testimonials, or claims that are not in the site context.',
          '- Keep copy concise and conversion-focused.',
          '- Output ONLY a JSON object with these fields:',
          '{ "suggestion": "the actual text to use", "rationale": "1-2 sentences on why this helps", "urgency_level": "low|medium|high" }',
          'Output only valid JSON, no markdown, no text outside the JSON.',
        ].join('\n');

  const message = await client.messages.create({
        model: 'claude-opus-4-5',
        max_tokens: area.maxTokens,
        messages: [{ role: 'user', content: prompt }],
  });

  const responseText = message.content[0].text.trim();
    let parsed;
    try {
          const jsonStr = responseText.replace(/^[^{]*({[\s\S]*})[^}]*$/, '$1');
          parsed = JSON.parse(jsonStr);
    } catch (e) {
          console.error('[ai-agent] Could not parse JSON for area:', area.id, responseText.slice(0, 120));
          return null;
    }

  return {
        area: area.id,
        areaName: area.name,
        suggestion: parsed.suggestion || '',
        rationale: parsed.rationale || '',
        urgencyLevel: parsed.urgency_level || 'medium',
        generatedAt: new Date().toISOString(),
  };
}

function escapeAttr(str) {
    return String(str).replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function applyLivePatches(improvements) {
    const homePath = path.resolve(HOME_FILE);
    let changed = false;

  // --- Patch 1: Insert or refresh SEO meta + OG tags in the homepage head ---
  const seoImp = improvements.find(i => i.area === 'seo_metadata');
    let desc = 'Meet Gideon, the Claude-powered trade and business assistant from GDN AI. Try three free searches, then unlock the unlimited members workspace.';
    if (seoImp && seoImp.suggestion) {
          const raw = String(seoImp.suggestion).replace(/\s+/g, ' ').trim();
          if (raw.length >= 30 && raw.length <= 320) desc = raw;
    }

  try {
        let html = readFileSync(homePath, 'utf8');
        const safeDesc = escapeAttr(desc);
        const block = [
                '  <meta name="description" content="' + safeDesc + '">',
                '  <meta property="og:title" content="GDN AI - Gideon, your AI trade assistant">',
                '  <meta property="og:description" content="' + safeDesc + '">',
                '  <meta property="og:type" content="website">',
                '  <meta property="og:url" content="' + SITE_URL + '/">',
                '  <link rel="canonical" href="' + SITE_URL + '/">',
              ].join('\n');

      // Remove any previously injected AI SEO block so runs stay idempotent.
      html = html.replace(/[ \t]*<!-- AI-SEO:start -->[\s\S]*?<!-- AI-SEO:end -->\n?/, '');

      const wrapped = '  <!-- AI-SEO:start -->\n' + block + '\n  <!-- AI-SEO:end -->\n';
        // Insert right before the closing head tag.
      if (html.includes('</head>')) {
              html = html.replace('</head>', wrapped + '</head>');
              writeFileSync(homePath, html, 'utf8');
              changed = true;
              console.log('[ai-agent] Patched: SEO/OG tags written to', HOME_FILE);
      } else {
              console.log('[ai-agent] No </head> found in', HOME_FILE, '- skipping SEO patch');
      }
  } catch (err) {
        console.error('[ai-agent] Could not patch homepage SEO:', err.message);
  }

  // --- Patch 2: Refresh or create sitemap.xml ONLY if content changed this run ---
  try {
        const sitemapPath = path.resolve('public/sitemap.xml');
        const today = new Date().toISOString().split('T')[0];
        const routes = ['/', '/membership', '/app'];

      if (existsSync(sitemapPath) && !changed) {
              console.log('[ai-agent] No content change this run - leaving sitemap lastmod untouched');
      } else {
              const urls = routes.map(r =>
                        '  <url><loc>' + SITE_URL + r + '</loc><lastmod>' + today + '</lastmod></url>'
                                            ).join('\n');
              const xml = '<?xml version="1.0" encoding="UTF-8"?>\n' +
                        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
                        urls + '\n</urlset>\n';
              writeFileSync(sitemapPath, xml, 'utf8');
              console.log('[ai-agent] Sitemap written with lastmod', today);
      }
  } catch (err) {
        console.error('[ai-agent] Could not write sitemap:', err.message);
  }
}

function formatSummary(improvements) {
    const dateStr = new Date().toISOString().split('T')[0];
    let out = 'GDN AI Improvement Run - ' + dateStr + '\n\n';
    improvements.forEach((imp, i) => {
          out += (i + 1) + '. ' + imp.areaName + ' [' + imp.urgencyLevel + ']\n';
          out += '   ' + String(imp.suggestion).slice(0, 160) + '\n';
          out += '   why: ' + imp.rationale + '\n\n';
    });
    return out;
}

module.exports = { runImprovementAgent, formatSummary };
