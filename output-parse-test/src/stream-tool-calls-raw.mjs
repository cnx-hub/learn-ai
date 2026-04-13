import { model } from './initConfig.mjs';
import { z } from 'zod'


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
    name: "extract_scientist_info",
    description: "提取和结构化科学家的详细信息",
    schema: scientistSchema
}])

console.log("🌊 流式 Tool Calls 演示 - 直接打印原始 tool_calls_chunk\n");
const prompt = "详细介绍牛顿的生平和成就"

try {
    const stream = await modelWithTool.stream(prompt);


    console.log("📡 实时输出流式 tool_calls_chunk:\n");

    let chunkIndex = 0;

    for await (const chunk of stream) {
        chunkIndex++;
        // console.log(chunk);    
        if (chunk.tool_call_chunks && chunk.tool_call_chunks.length > 0) {
            // process.stdout.write(JSON.stringify(chunk?.tool_calls?.[0]?.args))
            process.stdout.write(chunk.tool_call_chunks[0].args || '');
        }
    }

    console.log(`\n\n✅ 流式输出完成,总共的 chunk 数:${chunkIndex}`);
} catch (error) {
    console.log(error)
}