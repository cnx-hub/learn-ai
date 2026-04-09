import { model } from './initConfig.mjs';
import { z } from 'zod';
import { tool } from '@langchain/core/tools';
import { InMemoryChatMessageHistory } from '@langchain/core/chat_history';
import { ToolMessage } from '@langchain/core/messages';

const scientistSchema = z.object({
    name: z.string().describe('科学家的全名'),
    birth_year: z.number().describe('出生年份'),
    nationality: z.string().describe('国籍'),
    fields: z.array(z.string()).describe('研究领域列表'),
});

const formatDataTool = tool(async (arg) => {
    console.log(arg, 'arg');
    return arg;
}, {
    name: 'extract_scientist_info',
    description: '提取和结构化科学家的详细信息',
    schema: scientistSchema,
});

const tools = [formatDataTool];
const modelWithTool = model.bindTools(tools, {
    parallel_tool_calls: false,
});


async function runConversation(prompt) {
    const history = new InMemoryChatMessageHistory();
    const maxRounds = 6;
    let structuredResult = null;

    await history.addUserMessage(prompt);

    let response = await modelWithTool.invoke(await history.getMessages(), {
        tool_choice: 'auto',
    });
    await history.addMessage(response);

    for (let round = 0; round < maxRounds; round += 1) {
        if (!response.tool_calls?.length) {
            break;
        }

        for (const toolCall of response.tool_calls) {
            const foundTool = tools.find((t) => t.name === toolCall.name);
            if (!foundTool) {
                continue;
            }

            const resultText = await foundTool.invoke(toolCall.args);
            await history.addMessage(new ToolMessage({
                content: JSON.stringify(resultText),
                tool_call_id: toolCall.id,
            }));

            if (toolCall.name === 'extract_scientist_info') {
                structuredResult = scientistSchema.parse(resultText);
            }
        }

        response = await modelWithTool.invoke(await history.getMessages(), {
            tool_choice: 'auto',
        });
        await history.addMessage(response);
    }

    if (!structuredResult) {
        throw new Error('未拿到 extract_scientist_info 的 JSON 结果');
    }

    return {
        scientist_info: structuredResult,
    };
}

const prompt = '请介绍一下爱因斯坦，并先调用 extract_scientist_info 提取结构化信息。';

try {
    const result = await runConversation(prompt);
    console.log(JSON.stringify(result, null, 2));
} catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(JSON.stringify({ error: errorMessage }, null, 2));
    process.exit(1);
}
