import { START, END, StateGraph, MessagesAnnotation } from '@langchain/langgraph';
import { ToolNode, toolsCondition } from "@langchain/langgraph/prebuilt";
import { z } from 'zod';
import { tool } from "@langchain/core/tools";
import { getProductBySku } from './ inventory.mock.mjs';
import { ChatOpenAI } from '@langchain/openai';
import dotenv from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { HumanMessage } from '@langchain/core/messages';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../../.env') ,quiet: true});

const getProductStock = tool(({ sku }) => {
    return getProductBySku(sku);
}, {
    name: 'get_product_stock',
    description: '按 SKU 查商品名与库存，SKU 如 SKU-001。',
    schema: z.object({
        sku: z.string().describe("商品 SKU"),
    })
});


const tools = [getProductStock];

const llm = new ChatOpenAI({
    modelName: process.env.MODEL_NAME ,
    apiKey: process.env.API_KEY ?? process.env.OPENAI_API_KEY,
    configuration: {
        baseURL: process.env.BASE_URL ?? process.env.OPENAI_BASE_URL,
    },
    temperature: 0,
}).bindTools(tools);

async function agent(state) {
    // console.log(state.messages);
    const response = await llm.invoke(state.messages);
    return { messages: response };
}

const toolNode = new ToolNode(tools);

const graph = new StateGraph(MessagesAnnotation)
    .addNode('agent', agent)
    .addNode('tools', toolNode)
    .addEdge(START, 'agent').
    addConditionalEdges('agent', toolsCondition, ['tools', END])
    .addEdge('tools', 'agent')
    .compile();


const result = await graph.invoke({
    messages: [
        new HumanMessage(
            "查一下 SKU-001 的库存还有多少，回答里带上商品名和数字。"
        ),
    ],
});


// 导出为 Mermaid：可复制到 https://mermaid.live 或 Markdown 的 ```mermaid 代码块
const drawable = await graph.getGraphAsync();
const mermaid = drawable.drawMermaid({ withStyles: true });
console.log(mermaid);

const last = result.messages.at(-1);
console.log(last?.content ?? result.messages);
