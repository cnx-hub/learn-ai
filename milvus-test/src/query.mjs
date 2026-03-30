import 'dotenv/config';
import dotenv from "dotenv";

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { MilvusClient, MetricType } from '@zilliz/milvus2-sdk-node';
import { OpenAIEmbeddings } from "@langchain/openai";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../../.env') });

const COLLECTION_NAME = 'ai_diary';
const VECTOR_DIM = 1024;

const embeddings = new OpenAIEmbeddings({
    modelName: process.env.EMBEDDINGS_MODEL_NAME,
    apiKey: process.env.API_KEY,
    configuration: {
        baseURL: process.env.BASE_URL,
    },
    dimensions: VECTOR_DIM,
})

const client = new MilvusClient({
    address: 'localhost:19530',
});

async function getEmbedding(text) {
    const result = await embeddings.embedQuery(text);
    return result;
}

async function main() {
    try {
        console.log('Connecting to Milvus...');
        await client.connectPromise;
        console.log('✓ Connected\n');

        console.log('Searching for similar diary entries...');
        const query = '我做饭或学习的日记';
        console.log(`Query: "${query}"\n`);

        const queryVector = await getEmbedding(query);
        const searchResult = await client.search({
            collection_name: COLLECTION_NAME,
            vector: queryVector,
            limit: 2,
            metric_type: MetricType.COSINE,
            output_fields: ['id', 'content', 'date', 'mood', 'tags']
        });

        console.log(`Found ${searchResult.results.length} results:\n`);

        // console.log('='.repeat(80));
        // console.log("searchResult :", searchResult);


        searchResult.results.forEach((result, index) => {
            console.log(`\nResult ${index + 1}:`);
            console.log(`ID: ${result.id}`);
            console.log(`Content: ${result.content}`);
            console.log(`Date: ${result.date}`);
            console.log(`Mood: ${result.mood}`);
            console.log(`Tags: ${result.tags}`);
        });
    } catch (error) {
        console.error('Error:', error.message);
    }
}


main();