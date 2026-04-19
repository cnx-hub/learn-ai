import { model } from '../initConfig.mjs';
import { executeCommandTool, listDirectoryTool, readFileTool, writeFileTool } from "./all-tool.mjs";
import { InMemoryChatMessageHistory } from "@langchain/core/chat_history";
import { HumanMessage, SystemMessage, ToolMessage } from "@langchain/core/messages";
import { JsonOutputToolsParser } from "@langchain/core/output_parsers/openai_tools";
import chalk from 'chalk';


const tools = [
    executeCommandTool, listDirectoryTool, readFileTool, writeFileTool
];

const modelWithTool = model.bindTools(tools);

async function runAgentWithTools(query, maxIterations = 30) {
    try {
        const history = new InMemoryChatMessageHistory();
        const systemPrompt = new SystemMessage(`你是一个项目管理助手，使用工具完成任务。

当前工作目录: ${process.cwd()}

工具：
1. read_file: 读取文件
2. write_file: 写入文件
3. execute_command: 执行命令（支持 workingDirectory 参数）
4. list_directory: 列出目录

重要规则 - execute_command：
- workingDirectory 参数会自动切换到指定目录
- 当使用 workingDirectory 时，绝对不要在 command 中使用 cd
- 错误示例: { command: "cd react-todo-app && pnpm install", workingDirectory: "react-todo-app" }
- 正确示例: { command: "pnpm install", workingDirectory: "react-todo-app" }

重要规则 - write_file：
- 当写入 React 组件文件（如 App.tsx）时，如果存在对应的 CSS 文件（如 App.css），在其他 import 语句后加上这个 css 的导入
`);

        await history.addMessage(systemPrompt);
        await history.addMessage(new HumanMessage(query));

        for (let i = 0; i < maxIterations; i++) {
            console.log(chalk.bgGreen(`⏳ 正在等待 AI 思考...`));

            const rawStream = await modelWithTool.stream(history.messages);
            // console.log(chalk.green(`  AI 思考结束，正在流式输出`))
            const toolParser = new JsonOutputToolsParser();
            let fullAIMessage = '';
            // 记录每个工具调用已打印的长度（用 id 或 filePath 作为 key）
            const printedLengths = new Map();

            for await (const chunk of rawStream) {
                fullAIMessage = fullAIMessage ? fullAIMessage.concat(chunk) : chunk;

                let parsedTools = null;
                try {
                    parsedTools = await toolParser.parseResult([{ message: fullAIMessage }])
                } catch (error) {

                }

                if (parsedTools?.length > 0) {
                    //  console.log(JSON.stringify(parsedTools, null, 2));

                    for (const toolCall of parsedTools) {
                        if (toolCall.type === 'write_file' && toolCall.args?.content) {
                            const toolCallId = toolCall.id || toolCall.args.filePath || 'default';
                            const currentContent = String(toolCall.args.content);
                            const previousLength = printedLengths.get(toolCallId);

                            if (previousLength === undefined) {
                                printedLengths.set(toolCallId, 0);
                                console.log(
                                    chalk.bgBlue(
                                        `\n[工具调用] write_file("${toolCall.args.filePath}") - 开始写入（流式预览）\n`,
                                    ),
                                );
                            }

                            if (currentContent.length > previousLength) {
                                const newContent = currentContent.slice(previousLength);
                                process.stdout.write(newContent);
                                printedLengths.set(toolCallId, currentContent.length);
                            }
                        }
                    }
                } else {
                    if (chunk.content) {
                        process.stdout.write(
                            typeof chunk.content === 'string'
                                ? chunk.content
                                : JSON.stringify(chunk.content),
                        )
                    }
                }
            }

            await history.addMessage(fullAIMessage);
            console.log(chalk.green('\n✅ 消息已完整存入历史'));


            if (!fullAIMessage.tool_calls || fullAIMessage.tool_calls.length === 0) {
                console.log(`\n✨ AI 最终回复:\n${fullAIMessage.content}\n`);
                return fullAIMessage.content;
            }


            for (const toolCall of fullAIMessage.tool_calls) {
                const foundTool = tools.find(t => t.name === toolCall.name);

                if (foundTool) {
                    const result = await foundTool.invoke(toolCall.args);

                    history.addMessage(new ToolMessage({
                        content: result,
                        tool_call_id: toolCall.id,
                    }))
                }
            }

        }

        const finalMessages = await history.getMessages();

        return finalMessages[finalMessages.length - 1].content;


    } catch (error) {
        console.log('流式解析错误：', error.message);
    }
}

const case1 = `创建一个功能丰富的 React TodoList 应用：

1. 创建项目：echo -e "n\nn" | pnpm create vite react-todo-app --template react-ts
2. 修改 src/App.tsx，实现完整功能的 TodoList：
 - 添加、删除、编辑、标记完成
 - 分类筛选（全部/进行中/已完成）
 - 统计信息显示
 - localStorage 数据持久化
3. 添加复杂样式：
 - 渐变背景（蓝到紫）
 - 卡片阴影、圆角
 - 悬停效果
4. 添加动画：
 - 添加/删除时的过渡动画
 - 使用 CSS transitions
5. 列出目录确认

注意：使用 pnpm，功能要完整，样式要美观，要有动画效果

去掉 main.tsx 里的 index.css 导入

之后在 react-todo-app 项目中：
1. 使用 pnpm install 安装依赖
2. 使用 pnpm run dev 启动服务器
`;

try {
    await runAgentWithTools(case1);
} catch (error) {
    console.error(`\n❌ 错误: ${error.message}\n`);
}

