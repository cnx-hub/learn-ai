import dotenv from 'dotenv';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { ChatOpenAI } from "@langchain/openai";
import { tool } from "@langchain/core/tools";
import { z } from 'zod';
import { SystemMessage, HumanMessage, ToolMessage } from "@langchain/core/messages"


const __dirname = dirname(fileURLToPath(import.meta.url));
// console.log(__dirname,'dirname');
dotenv.config({ path: join(__dirname, '../../.env') });

const model = new ChatOpenAI({
    modelName: process.env.MODEL_NAME || 'qwen-coder-turbo',
    apiKey: process.env.API_KEY,
    temperature: 0,
    configuration: {
        baseURL: process.env.BASE_URL,
    }
});


const readFileTool = tool(async ({ filePath }) => {
    // 相对路径按脚本所在目录解析，避免受进程 cwd 影响
    const resolvedPath = filePath.startsWith('/') ? filePath : join(__dirname, filePath.replace(/^\.\//, ''));
    const content = await readFile(resolvedPath, 'utf8');
    console.log(`[工具调用] read_file("${filePath}") - 成功读取 ${content.length} 字节`)
    return content;
}, {
    name: "read_file",
    description: "读取文件内容",
    schema: z.object({
        filePath: z.string().describe("文件路径"),
    }),
});

const tools = [readFileTool];

const modelWithTools = model.bindTools(tools);

const messages = [
    new SystemMessage(`你是一个代码助手，可以使用工具读取文件并解释代码。
  
  工作流程：
  1. 用户要求读取文件时，立即调用 read_file 工具
  2. 等待工具返回文件内容
  3. 基于文件内容进行分析和解释
  
  可用工具：
  - read_file: 读取文件内容（使用此工具来获取文件内容）
  `),
    new HumanMessage('请读取 ./tool-file-read.mjs 文件内容并解释代码')
];

let response = await modelWithTools.invoke(messages);
console.log(response);

messages.push(response);


while (response.tool_calls && response.tool_calls?.length > 0) {
    console.log(`\n[检测到 ${response.tool_calls.length} 个工具调用]`);

    const toolResult = await Promise.all(
        response.tool_calls?.map(async toolCall => {
            const tool = tools.find(t => t.name === toolCall.name);

            if (!tool) {
                return `错误: 找不到工具 ${toolCall.name}`;
            }

            console.log(`  [执行工具] ${toolCall.name}(${JSON.stringify(toolCall.args)})`);
            try {
                const result = await tool.invoke(toolCall.args);
                return result;
            } catch (error) {
                return `工具调用失败: ${error.message}`;
            }
        })
    )

    response.tool_calls.forEach((toolCall, index) => {
        messages.push(new ToolMessage({
            content: toolResult[index],
            tool_call_id: toolCall.id,
        }));
    })

    response = await modelWithTools.invoke(messages);
}

console.log('\n[最终回复]');
console.log(response.content);


