import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { join, dirname, parse } from 'path';
import { EPubLoader } from "@langchain/community/document_loaders/fs/epub";
import { MilvusClient, DataType, MetricType, IndexType } from '@zilliz/milvus2-sdk-node';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { OpenAIEmbeddings } from '@langchain/openai'

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../../.env') });

const COLLECTION_NAME = 'ebook_collection';
const VECTOR_DIM = 1024;
const CHUNK_SIZE = 500; // 拆分到 500 个字符

const embeddings = new OpenAIEmbeddings({
    modelName: process.env.EMBEDDINGS_MODEL_NAME,
    apiKey: process.env.API_KEY,
    configuration: {
        baseURL: process.env.BASE_URL,
    },
    dimensions: VECTOR_DIM,
});

const client = new MilvusClient({
    address: 'localhost:19530'
})

const EPUB_FILE = './天龙八部.epub';
const BOOK_NAME = parse(EPUB_FILE).name;

async function getEmbedding(text) {
    const result = await embeddings.embedQuery(text);
    return result;
}

async function ensureCollection(bookId) {
    try {
        const hasCollection = await client.hasCollection({ collection_name: COLLECTION_NAME });

        if (!hasCollection.value) {
            await client.createCollection({
                collection_name: COLLECTION_NAME,
                fields: [
                    { name: 'id', data_type: DataType.VarChar, max_length: 100, is_primary_key: true },
                    { name: 'book_id', data_type: DataType.VarChar, max_length: 100 },
                    { name: 'book_name', data_type: DataType.VarChar, max_length: 200 },
                    { name: 'chapter_num', data_type: DataType.Int32 },
                    { name: 'index', data_type: DataType.Int32 },
                    { name: 'content', data_type: DataType.VarChar, max_length: 10000 },
                    { name: 'vector', data_type: DataType.FloatVector, dim: VECTOR_DIM }
                ]
            })

            console.log('✓ 集合创建成功');
            // 创建索引
            console.log('创建索引...');

            await client.createIndex({
                collection_name: COLLECTION_NAME,
                field_name: 'vector',
                index_type: IndexType.IVF_FLAT,
                metric_type: MetricType.COSINE,
                params: { nlist: 1024 }
            })

            console.log('✓ 索引创建成功');
        }

        try {
            await client.loadCollection({ collection_name: COLLECTION_NAME });
            console.log('✓ 集合加载成功');
        } catch (error) {
            console.log('✓ 集合已处于加载状态');
        }

    } catch (error) {
        console.error('创建集合时出错:', error.message);
        throw error;
    }
}

async function insertChunksBatch(chunks, bookId, chapterNum) {
    try {
        if (chunks.length === 0) {
            return 0;
        }

        const insertData = await Promise.all(chunks.map(async (chunk, chunkIndex) => {
            const vector = await getEmbedding(chunk);

            return {
                id: `${bookId}_${chapterNum}_${chunkIndex}`,
                book_id: bookId,
                book_name: BOOK_NAME,
                chapter_num: chapterNum,
                index: chunkIndex,
                content: chunk,
                vector: vector,
            }
        }));

        const insertResult = await client.insert({
            collection_name: COLLECTION_NAME,
            data: insertData
        });

        return Number(insertResult.insert_cnt) || 0;
    } catch (error) {
        console.error(`插入章节 ${chapterNum} 的数据时出错:`, error.message);
        console.error('错误详情:', error);
        throw error;
    }
}

async function loadAndProcessEPubStreaming(bookId) {
    try {
        console.log(`\n开始加载 EPUB 文件: ${EPUB_FILE}`);

        const loader = new EPubLoader(
            EPUB_FILE,
            {
                splitChapters: true,
            }
        );

        const documents = await loader.load();

        console.log('documents========', documents.length);
        const textSplitter = new RecursiveCharacterTextSplitter({
            chunkSize: CHUNK_SIZE,
            chunkOverlap: 50, // 重叠 50 个字符，保持上下文连贯性
        });

        let totalInserted = 0;

        for (let chapterIndex = 0; chapterIndex < documents.length; chapterIndex++) {
            const chapter = documents[chapterIndex];
            const chapterContent = chapter.pageContent;

            console.log(`处理第 ${chapterIndex + 1}/${documents.length} 章...`);
            const chunks = await textSplitter.splitText(chapterContent);
            console.log(`  拆分为 ${chunks.length} 个片段`);

            if (!chunks.length) {
                console.log('  ⚠️ 章节内容为空，跳过');
                continue;
            }

            console.log(`  生成向量并插入中...`);

            const insertedCount = await insertChunksBatch(chunks, bookId, chapterIndex + 1);
            totalInserted += insertedCount;
            console.log(`  ✓ 插入 ${insertedCount} 个片段，累计插入 ${totalInserted} 个片段`);
        }

        console.log(`\n总共插入 ${totalInserted} 条记录\n`);
        return totalInserted;
    } catch (error) {
        console.error('加载 EPUB 文件时出错:', error.message);
        throw error;
    }
}


async function main() {
    try {
        console.log('='.repeat(80));
        console.log('电子书处理程序');
        console.log('='.repeat(80));

        // 连接 Milvus
        console.log('\n连接 Milvus...');
        await client.connectPromise;
        console.log('✓ 已连接\n');

        const bookId = 1;

        await ensureCollection(bookId);
        // 加载和处理 EPUB 文件（流式处理，边处理边插入）
        await loadAndProcessEPubStreaming(bookId);

        console.log('='.repeat(80));
        console.log('处理完成！');
        console.log('='.repeat(80));
    } catch (error) {
        console.error('\n错误:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

main();
