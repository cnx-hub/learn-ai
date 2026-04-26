import dotenv from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url'
import { ChatOpenAI } from "@langchain/openai";
import { MultiServerMCPClient } from '@langchain/mcp-adapters';
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';
import { RunnableSequence, RunnablePassthrough, RunnableBranch, RunnableLambda } from "@langchain/core/runnables";
import { HumanMessage, ToolMessage } from '@langchain/core/messages';
import chalk from 'chalk';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../../../.env'), quiet: true });

const model = new ChatOpenAI({
    modelName: process.env.MODEL_NAME,
    apiKey: process.env.API_KEY,
    configuration: {
        baseURL: process.env.BASE_URL,
    }
});

const mcpClient = new MultiServerMCPClient({
    mcpServers: {
        "amap-maps-streamableHTTP": {
            "url": "https://mcp.amap.com/mcp?key=" + process.env.AMAP_MAPS_API_KEY
        },
        "chrome-devtools": {
            "command": "npx",
            "args": ["-y", "chrome-devtools-mcp@latest", "--no-performance-crux", "--no-usage-statistics"]
        },
    }
});

const tools = await mcpClient.getTools();
const modelWith = model.bindTools(tools);

const prompt = ChatPromptTemplate.fromMessages([
    ["system", "你是一个可以调用 MCP 工具的智能助手。"],
    new MessagesPlaceholder("messages"),
]);

const llmChain = prompt.pipe(modelWith);

const toolExecutor = RunnableLambda.from(async (state) => {
    const { tools, response } = state;
    const toolResults = [];

    for (const toolCall of response?.tool_calls) {
        const foundTool = tools.find(t => t.name === toolCall.name);

        if (!foundTool) {
            continue;
        }

        const toolResult = await foundTool.invoke(toolCall.args);

        // 兼容不同返回格式的字符串化
        const contentStr = typeof toolResult === 'string'
            ? toolResult
            : (toolResult?.text || JSON.stringify(toolResult));
        toolResults.push(new ToolMessage({
            content: contentStr,
            tool_call_id: toolCall.id,
        }));
    }

    return toolResults;
})

const agentStepChain = RunnableSequence.from([
    RunnablePassthrough.assign({
        response: llmChain,
    }),
    RunnableBranch.from([
        [
            (state) => !state.response?.tool_calls ||
                state.response.tool_calls.length === 0,
            (state) => {
                const { response, messages } = state;
                const newMessages = [...messages, response];
                return {
                    ...state,
                    messages: newMessages,
                    done: true,
                    final: response.content,
                }
            }
        ],
        (state) => {
            const { messages, response } = state;
            const newMessages = [...messages, response];

            console.log(
                chalk.bgBlue(
                    `🔍 检测到 ${response.tool_calls.length} 个工具调用`
                )
            );
            console.log(
                chalk.bgBlue(
                    `🔍 工具调用: ${response.tool_calls
                        .map((t) => t.name)
                        .join(', ')}`
                )
            );

            return {
                ...state,
                messages: newMessages,
            };
        }
    ]),
    RunnablePassthrough.assign({
        toolMessages: toolExecutor,
    }),
    (state) => {
        const { messages, toolMessages } = state;
        return {
            ...state,
            messages: [...messages, ...(toolMessages ?? [])],
            done: false,
        };
    }
])

async function runAgentWithTools(query, maxIterations = 30) {
    try {
        let state = {
            messages: [new HumanMessage(query)],
            done: false,
            final: null,
            tools,
        }

        for (let i = 0; i < maxIterations; i++) {
            state = await agentStepChain.invoke(state);

            if (state.done) {
                console.log(`\n✨ AI 最终回复:\n${state.final}\n`);
                return state.final;
            }
        }
        return state.messages?.[state?.messages?.length - 1]?.content;

    } catch (error) {
        console.log('err:', error)
    }
}


// 如果 API 配额正常，取消下面的注释来运行完整测试
const res = await runAgentWithTools("北京南站附近的酒店，最近的 3 个酒店，拿到酒店图片，打开浏览器，展示每个酒店的图片，每个 tab 一个 url 展示，并且在把那个页面标题改为酒店名");
console.log(res)

// await mcpClient.close();
