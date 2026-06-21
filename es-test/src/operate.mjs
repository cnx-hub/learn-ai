import { Client } from '@elastic/elasticsearch';

const client = new Client({
    node: 'http://localhost:9200'
});

const INDEX_NAME = 'travel_journal';

async function createDocument() {
    const now = new Date().toISOString();

    const res = await client.index({
        index: INDEX_NAME,
        document: {
            note_title: '夜跑复盘',
            note_body: '今天夜跑 5 公里，配速稳定，结束后做了拉伸。',
            tags: ['运动', '夜跑'],
            mood: 'focused',
            priority: 2,
            created_at: now,
            updated_at: now
        },
        refresh: true
    });

    console.log('✅ 新增成功，ID =', res._id);
    return res._id;
}

async function updateDocument(id) {
    const now = new Date().toISOString();

    const res = await client.update({
        index: INDEX_NAME,
        id: id,
        doc: {
            note_body: '今天夜跑 6 公里，状态不错，拉伸后恢复很快。',
            tags: ['运动', '夜跑', '训练'],
            updated_at: now
        },
        refresh: true
    });

    console.log('✅ 更新成功，ID =', res._id);
    return res._id;
}

async function getDocument(id) {
    const res = await client.get({
        index: INDEX_NAME,
        id: id
    });

    console.log('✅ 获取成功，ID =', res._id);
    console.log('🔍 文档内容:', res._source);
}

async function analyzeText(text, analyzer = 'ik_smart') {
    const res = await client.indices.analyze({
        index: INDEX_NAME,
        text: text,
        analyzer: analyzer
    });

    const tokens = res.tokens.map(t => t.token);
    console.log(`📝 原文: "${text}"`);
    console.log(`🔪 分词器: ${analyzer}`);
    console.log(`✨ 分词结果:`, tokens);
    return tokens;
}

async function searchDocuments() {
    // 先看看是怎么分词的
    await analyzeText('慢跑以及骑行训练', 'ik_smart');
    console.log('---');

    const res = await client.search({
        index: INDEX_NAME,
        query: {
            match: {
                note_body: {
                    query: '慢跑以及骑行训练',
                    analyzer: 'ik_smart'
                }
            }
        }
    });

    const rows = res.hits.hits.map((item) => ({
        id: item._id,
        ...item._source
    }));
    console.log('🔍 搜索结果:', rows);
}

async function deleteDocument(id) {
    await client.delete({
        index: INDEX_NAME,
        id: id,
        refresh: true
    });

    console.log('✅ 删除成功，ID =', id);
}

async function run() {
    const docId = 'tz5i6Z4BDWFy0fsv27Sl'
    // const docId = await createDocument();
    // await updateDocument(docId);
    // await getDocument(docId);

    // await searchDocuments();
    await deleteDocument(docId);
};

run().catch(console.error);
