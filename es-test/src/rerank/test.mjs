import { DashscopeRerank } from './dashscope-rerank.mjs'

import { Document } from '@langchain/core/documents';
import dotenv from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../../../.env'), quiet: true });

async function main() {
    const apiKey = process.env.OPENAI_API_KEY;

    const compressor = new DashscopeRerank({ apiKey });
    const query = "什么是文本排序模型";
    const docs = [
        new Document({
            pageContent:
                "预训练语言模型的发展给文本排序模型带来了新的进展",
        }),
        new Document({
            pageContent: "量子计算是计算科学的一个前沿领域",
        }),
        new Document({
            pageContent: "文本排序模型广泛用于搜索引擎和推荐系统中…",
        }),
    ];


    const compressed = await compressor.compressDocuments(docs, query);
    console.log("重排后顺序（pageContent）：");
    for (const d of compressed) {
        console.log("-", d.pageContent);
    }
}

main()