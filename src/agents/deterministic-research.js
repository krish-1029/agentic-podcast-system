/**
 * Deterministic Channel Research
 *
 * Runs a fixed search → scrape → summarize pipeline to produce a channel report
 * without using the LangChain ReAct agent. Stable and fast.
 */

import { search, scrape } from '../tools/index.js';
import { ChatOpenAI } from '@langchain/openai';
import config from '../config/config.js';
import logger from '../utils/logger.js';
import { getChannel } from './channel-registry.js';

const log = logger.child('DeterministicResearch');

function buildQueries(channelId) {
  const date = new Date();
  const today = date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const map = {
    tech: [
      `tech news today ${today}`,
      `software development news ${today}`,
      `framework updates ${today}`,
    ],
    finance: [
      `stock market news today ${today}`,
      `economic data ${today}`,
      `earnings results ${today}`,
    ],
    f1: [
      `F1 news today ${today}`,
      `F1 qualifying results ${today}`,
      `F1 practice results ${today}`,
    ],
    world_news: [
      `world news today ${today}`,
      `breaking news ${today}`,
      `global headlines ${today}`,
    ],
    science: [
      `science news today ${today}`,
      `research findings ${today}`,
      `scientific breakthrough ${today}`,
    ],
  };
  return map[channelId] || [`${channelId} news today ${today}`];
}

export async function deterministicChannelReport(channelId, customRequests = []) {
  const start = Date.now();
  const channel = getChannel(channelId);
  if (!channel) throw new Error(`Unknown channel: ${channelId}`);

  log.start(`Deterministic research for ${channelId}`);
  const queries = buildQueries(channelId);
  const collected = [];

  for (const q of queries.slice(0, 3)) {
    const results = await search(q, { maxResults: 5, timeRange: 'day' });
    const first = results.find(r => r.url && r.source && !/wsj|nytimes|bloomberg|ft.com/i.test(r.source)) || results[0];
    if (!first || !first.url) continue;
    try {
      const text = await scrape(first.url, { maxLength: 2000 });
      collected.push({ title: first.title, url: first.url, text });
    } catch {
      // skip failures quickly
    }
  }

  const grounding = collected.map((c, i) => `(${i + 1}) ${c.title}\nURL: ${c.url}\nEXCERPT: ${String(c.text || '').slice(0, 700)}`).join('\n\n');

  const targetWords = 320; // middle of 280–350
  const prompt = `You are a ${channel.name} specialist. Today is ${new Date().toDateString()}.
Using ONLY the context below, write a clear, unambiguous ${targetWords}-word report with specific dates, figures, and named sources. Avoid speculation.
\nCONTEXT:\n${grounding || '(no excerpts available)'}\n\nFinal Answer:`;

  const llm = new ChatOpenAI({
    openAIApiKey: config.openaiApiKey,
    modelName: config.openaiSynthesisModel,
    temperature: 0.2,
    timeout: 60000,
  });

  const completion = await llm.invoke(prompt);
  const report = typeof completion === 'string' ? completion : (completion?.content || completion?.text || '');

  const duration = Date.now() - start;
  log.success(`Deterministic research complete for ${channelId}`, { duration: `${duration}ms` });

  return {
    channelId,
    channelName: channel.name,
    report,
    duration,
    status: 'success',
    method: 'deterministic',
    timestamp: new Date().toISOString(),
  };
}

export default {
  deterministicChannelReport,
};


