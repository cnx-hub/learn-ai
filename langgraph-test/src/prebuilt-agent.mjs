import { START, END, MemorySaver } from "@langchain/langgraph";
import { ChatOpenAI } from '@langchain/openai';

import dotenv from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getProductBySku } from './ inventory.mock.mjs';
import { z } from 'zod';
import { createAgent, tool } from "langchain";
import { HumanMessage } from '@langchain/core/messages'

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../../.env'), quiet: true });

const getProductStock = tool(({ sku }) => {
    return getProductBySku(sku);
}, {
    name: 'get_product_stock',
    description: '按 SKU 查商品名与库存，SKU 如 SKU-001。',
    schema: z.object({
        sku: z.string().describe("商品 SKU"),
    })
});

const model = new ChatOpenAI({
    modelName: process.env.MODEL_NAME,
    apiKey: process.env.API_KEY ?? process.env.OPENAI_API_KEY,
    configuration: {
        baseURL: process.env.BASE_URL ?? process.env.OPENAI_BASE_URL,
    },
    temperature: 0,
});

const agent = createAgent({
    model,
    tools: [getProductStock],
    systemPrompt:
        "你是仓库助手。问库存时必须调用 get_product_stock（模拟数据），禁止编造。",
    checkpointer: new MemorySaver(),
});

const result = await agent.invoke(
    { messages: [new HumanMessage("SKU-002 还剩多少库存？")] },
    { configurable: { thread_id: "demo-thread" } }
);

// 导出为 Mermaid：可复制到 https://mermaid.live 或 Markdown 的 ```mermaid 代码块
const drawable = await agent.graph.getGraphAsync();
const mermaid = drawable.drawMermaid({ withStyles: true });
console.log(mermaid);

const last = result.messages.at(-1);
console.log(JSON.stringify(result));