import { model } from "./initConfig.mjs";
import { z } from "zod";
import { StructuredOutputParser } from '@langchain/core/output_parsers';

const schema = z.object({
    name: z.string().describe("姓名"),
    birth_year: z.number().describe("出生年份"),
    death_year: z.number().describe("去世年份"),
    nationality: z.string().describe("国籍"),
    occupation: z.string().describe("职业"),
    famous_works: z.array(z.string()).describe('著名作品列表'),
    biography: z.string().describe("简短传记")
});

const parser = StructuredOutputParser.fromZodSchema(schema);

const prompt = `
请介绍莫扎特，并严格按给定字段输出。
${parser.getFormatInstructions()}
`;


console.log("🌊 流式结构化输出演示\n");

try {
    const stream = await model.stream(prompt);
    let chunkCount = 0;
    let fullContent = '';

    console.log("📡 接收流式数据:\n");

    for await (const chunk of stream) {
        chunkCount++;

        if (chunk && typeof chunk === "object" && !Array.isArray(chunk)) {
            // const diff = getTopLevelDiff(lastChunkObject, chunk);
            // if (Object.keys(diff).length > 0) {
            //     process.stdout.write(`${JSON.stringify(diff, null, 2)}\n`);
            // }
            // lastChunkObject = chunk;
            // process.stdout.write(`${JSON.stringify(chunk, null, 2)}\n`);

            const content = chunk.content;
            fullContent += content;
            process.stdout.write(content)
        }
    }

} catch (error) {
    console.error("error:", error);
}
