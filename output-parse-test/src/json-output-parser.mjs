import dotenv from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { ChatOpenAI } from '@langchain/openai';
import { JsonOutputParser } from '@langchain/core/output_parsers'

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../../.env') });

const model = new ChatOpenAI({
    modelName: process.env.MODEL_NAME,
    apiKey: process.env.API_KEY,
    configuration: {
        baseURL: process.env.BASE_URL,
    }
});

const parser = new JsonOutputParser();

const question = `请介绍一下爱因斯坦的信息。请以 JSON 格式返回，包含以下字段：name（姓名）、birth_year（出生年份）、nationality（国籍）、major_achievements（主要成就，数组）、famous_theory（著名理论）。

${parser.getFormatInstructions()}`;

try {
    console.log("🤔 正在调用大模型...\n");
    const response = await model.invoke(question);

    console.log("✅ 收到响应:\n");
    console.log(response.content);

    // 解析 JSON
    const jsonResult = await parser.parse(response.content);
    console.log("\n📋 解析后的 JSON 对象:");
    console.log(jsonResult);
} catch (error) {
    console.error("❌ 错误:", error.message);
}