import { model } from './initConfig.mjs'
import { z } from "zod";
import { JsonOutputKeyToolsParser } from '@langchain/core/output_parsers/openai_tools';

const scientistSchema = z.object({
    name: z.string().describe("科学家的全名"),
    birth_year: z.number().describe("出生年份"),
    death_year: z.number().optional().describe("去世年份，如果还在世则不填"),
    nationality: z.string().describe("国籍"),
    fields: z.array(z.string()).describe("研究领域列表"),
    achievements: z.array(z.string()).describe("主要成就"),
    biography: z.string().describe("简短传记")
});

const modelWithTool = model.bindTools([{
    name: 'extract_scientist_info',
    description: "提取和结构化科学家的详细信息",
    schema: scientistSchema
}]);

const parser = new JsonOutputKeyToolsParser({
    keyName: "extract_scientist_info",
    returnSingle: true
});
const chain = modelWithTool.pipe(parser);

function renderFrame(frameText, state) {
    if (state.renderedLineCount > 0) {
        process.stdout.write(`\x1b[${state.renderedLineCount}A`);
    }

    process.stdout.write('\x1b[0J');
    process.stdout.write(`${frameText}\n`);
    return frameText.split('\n').length;
}

function getTopLevelDiff(previous, current) {
    const diff = {};
    for (const key of Object.keys(current)) {
        if (JSON.stringify(previous?.[key]) !== JSON.stringify(current[key])) {
            diff[key] = current[key];
        }
    }
    return diff;
}

try {
    console.log("🌊 流式 Tool Call 参数解析（单区域实时刷新）\n");
    const stream = await chain.stream("详细介绍牛顿的生平和成就");
    let lastSerialized = "";
    const renderState = { renderedLineCount: 0 };
    let previousChunk = {};

    for await (const chunk of stream) {
        if (!chunk || typeof chunk !== "object" || Array.isArray(chunk)) {
            continue;
        }

        const currentSerialized = JSON.stringify(chunk);
        if (currentSerialized === lastSerialized) {
            continue;
        }

        lastSerialized = currentSerialized;

        if (process.stdout.isTTY) {
            const frameText = JSON.stringify(chunk, null, 2);
            renderState.renderedLineCount = renderFrame(frameText, renderState);
        } else {
            // const diff = getTopLevelDiff(previousChunk, chunk);
            // if (Object.keys(diff).length > 0) {
            //     process.stdout.write(`${JSON.stringify(diff, null, 2)}\n`);
            // }
        }

        previousChunk = chunk;
    }

    if (process.stdout.isTTY && renderState.renderedLineCount > 0) {
        process.stdout.write('\n');
    }
} catch (error) {
    console.error("\n❌ 错误:", error.message);
    console.error(error);
}
