import 'dotenv/config';
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, ToolMessage, SystemMessage } from '@langchain/core/messages';
import { MultiServerMCPClient } from '@langchain/mcp-adapters';
import chalk from 'chalk';

const model = new ChatOpenAI({
    modelName: process.env.MODEL_NAME,
    apiKey: process.env.API_KEY,
    configuration: {
        baseURL: process.env.BASE_URL,
    },
    temperature: 0,
});

const mcpClient = new MultiServerMCPClient({
    mcpServers: {
        'my-mcp-server1': {
            command: "node",
            args: [
                "/Users/nanxiao/ai/tool-test/src/my-mcp-server.mjs"
            ]
        }
    }
});

let resourceContents = ''

const tools = await mcpClient.getTools();
const res = await mcpClient.listResources();
for (const [serverName, resources] of Object.entries(res)) {
    for (const resource of resources) {
        const content = await mcpClient.readResource(serverName, resource.uri)
        resourceContents += content[0].text
    }
}

const modelWithTools = model.bindTools(tools);

async function runAgentWithTools(query, maxIterations = 30) {
    const messages = [
        new SystemMessage(resourceContents),
        new HumanMessage(query)
    ]

    for (let i = 0; i < maxIterations; i++) {
        console.log(chalk.bgGreen(`⏳ 正在等待 AI 思考...`));
        const response = await modelWithTools.invoke(messages);
        messages.push(response);

        if (!response.tool_calls || response.tool_calls.length === 0) {
            console.log(`\n✨ AI 最终回复:\n${response.content}\n`);
            return response.content;
        };

        console.log(chalk.bgBlue(`🔍 检测到 ${response.tool_calls.length} 个工具调用`));
        console.log(chalk.bgBlue(`🔍 工具调用: ${response.tool_calls.map(t => t.name).join(', ')}`));

        for (const toolCall of response.tool_calls) {
            const foundTool = tools.find(t => t.name === toolCall.name);

            if (foundTool) {
                const toolResult = await foundTool.invoke(toolCall.args);
                messages.push(new ToolMessage({
                    content: toolResult,
                    tool_call_id: toolCall.id,
                }))
            }
        }
    }
    return messages[messages.length - 1].content;
}

// await runAgentWithTools("查一下用户 006 的信息");
await runAgentWithTools("MCP Server 使用指南");

mcpClient.close();
