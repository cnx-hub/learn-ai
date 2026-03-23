import "dotenv/config";

import { ChatOpenAI } from '@langchain/openai';
import { MultiServerMCPClient } from "@langchain/mcp-adapters";
import { SystemMessage, HumanMessage, ToolMessage } from "@langchain/core/messages";
import chalk from 'chalk';
import { object } from "zod";


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
        "amap-maps-streamableHTTP": {
            "url": "https://mcp.amap.com/mcp?key=" + process.env.AMAP_MAPS_API_KEY
        },
        'filesystem': {
            "command": "npx",
            "args": [
                "-y",
                "@modelcontextprotocol/server-filesystem",
                ...(process.env.ALLOWED_PATHS.split(',') || [])
            ]
        },
        "chrome-devtools": {
            "command": "npx",
            "args": [
                "-y",
                "chrome-devtools-mcp@latest"
            ]
        },
    }
});

const tools = await mcpClient.getTools();
const modelWithTools = model.bindTools(tools);

let resourceContents = ''
const res = await mcpClient.listResources();

for (const [serverName, resources] of Object.entries(res)) {
    for (const resource of resources) {
        const content = await mcpClient.readResource(serverName, resource.url);
        resourceContents += content[0].text;
    }
}


async function runAgentWithTools(query, maxIterations = 30) {
    const messages = [
        new SystemMessage('请始终使用简体中文回答。对用户说明、结论、路线说明等全部用中文；专有名词可保留原文必要时用括号注明。'),
        new SystemMessage(resourceContents),
        new HumanMessage(query)
    ];

    for (let i = 0; i < maxIterations; i++) {
        console.log(chalk.bgGreen(`⏳ 正在等待 AI 思考...`));
        const response = await modelWithTools.invoke(messages);
        messages.push(response);

        if (!response.tool_calls || response.tool_calls.length === 0) {
            console.log(chalk.bgGreen(`✨ AI 最终回复:\n${response.content}\n`));
            return response.content;
        }

        console.log(chalk.bgBlue(`🔍 检测到 ${response.tool_calls.length} 个工具调用`));
        console.log(chalk.bgBlue(`🔍 工具调用: ${response.tool_calls.map(t => t.name).join(', ')}`));

        for (const toolCall of response.tool_calls) {
            const foundTool = tools.find(t => t.name === toolCall.name);

            if (foundTool) {
                const toolResult = await foundTool.invoke(toolCall.args);
                let contentStr;

                if (typeof toolResult === 'string') {
                    contentStr = toolResult;
                } else if (toolResult && toolResult.text) {
                    contentStr = toolResult.text;
                }

                messages.push(new ToolMessage({
                    content: contentStr,
                    tool_call_id: toolCall.id
                }))
            }
        }
    }

    return messages[messages.length - 1].content;
}

// await runAgentWithTools('帮我规划下从淞虹路到杭州拱墅区都景公寓三条的路线，交通方式分别为公共交通、自驾')
// await runAgentWithTools('帮我规划下从淞虹路到杭州拱墅区都景公寓的路线，路线规划生成文档保存到 /Users/nanxiao/ai/tool-test 的一个 md 文件');
await runAgentWithTools("北京南站附近的酒店，最近的 3 个酒店，拿到酒店图片，打开浏览器，展示每个酒店的图片，每个 tab 一个 url 展示，并且在把那个页面标题改为酒店名");


mcpClient.close();