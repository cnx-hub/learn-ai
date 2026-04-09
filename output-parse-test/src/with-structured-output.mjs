import { model } from './initConfig.mjs';
import { z } from 'zod';
import { HumanMessage } from '@langchain/core/messages';

// 定义结构化输出的 schema
const scientistSchema = z.object({
    name: z.string().describe("科学家的全名"),
    birth_year: z.number().describe("出生年份"),
    nationality: z.string().describe("国籍"),
    fields: z.array(z.string()).describe("研究领域列表"),
});

const structuredModel = model.withStructuredOutput(scientistSchema, {
    method: "functionCalling",
    // name: "extract_scientist_info",
});
const prompt = new HumanMessage("介绍一下爱因斯坦，并提取科学家信息。");

try {
    const result = await structuredModel.invoke([prompt]);
    console.log("结构化结果:", JSON.stringify(result, null, 2));
    console.log(`\n姓名: ${result.name}`);
    console.log(`出生年份: ${result.birth_year}`);
    console.log(`国籍: ${result.nationality}`);
    console.log(`研究领域: ${result.fields.join(', ')}`);
} catch (error) {
    console.log('error:', error.message);
}
