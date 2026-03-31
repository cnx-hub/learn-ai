import dotenv from 'dotenv';
import { OpenAIEmbeddings } from "@langchain/openai";

import { dirname, join } from "path"
import { fileURLToPath } from 'url';
import { MilvusClient } from '@zilliz/milvus2-sdk-node';

const COLLECTION_NAME = 'ai_diary';
const VECTOR_DIM = 1024;

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../../.env') });

const embeddings = new OpenAIEmbeddings({
    apiKey: process.env.API_KEY,
    model: process.env.EMBEDDINGS_MODEL_NAME,
    configuration: {
        baseURL: process.env.BASE_URL,
    },
    dimensions: VECTOR_DIM
});

const client = new MilvusClient({
    address: 'localhost:19530',
});

async function getEmbedding(context) {
    const result = await embeddings.embedQuery(context);
    return result;
}

async function main() {
    try {
        console.log('Connecting to Milvus...');
        await client.connectPromise;
        console.log('Connected to Milvus successfully!');

        console.log('Updating diary entry...');
        const updateId = 'diary_001';
        const updatedContent = {
            id: updateId,
            content: '今天下了一整天的雨，心情很糟糕。工作上遇到了很多困难，感觉压力很大。一个人在家，感觉特别孤独。',
            date: '2026-01-10',
            mood: 'sad',
            tags: ['生活', '散步', '朋友']
        };

        const queryVector = await getEmbedding(updatedContent.content);
        const updateData = { ...updatedContent, vector: queryVector };
        const result = await client.upsert({
            collection_name: COLLECTION_NAME,
            data: [updateData]
        });

        console.log(`✓ Updated diary entry: ${updateId}`);
        console.log(`  New content: ${updatedContent.content}`);
        console.log(`  New mood: ${updatedContent.mood}`);
        console.log(`  New tags: ${updatedContent.tags.join(', ')}\n`);

    } catch (error) {
        console.error('Error:', error.message);
    }
};

main();