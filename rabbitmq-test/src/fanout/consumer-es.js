import { connect } from '../config.js';

const EXCHANGE = 'doc.parse.fanout';
/** 本消费者专属队列：只负责「全文检索写入 ElasticSearch」 */
const QUEUE = 'doc.elasticsearch';

/**
 * fanout 消费者 B：模拟写入 ElasticSearch。
 *
 * 与 consumer-vector.js 绑定同一 Exchange、不同 Queue。
 * 生产者只发一次；两个队列各收一份，天然实现「一份 Markdown → 两路异步落地」。
 */
async function main() {
    const { channel, connection } = await connect();
    // 消费者侧也要 assertExchange：保证交换机存在，且类型与生产者一致
    await channel.assertExchange(EXCHANGE, 'fanout', { durable: true });
    /**
     * assertQueue：声明真正存消息的容器。
     * durable: true → 队列元数据持久化；消息本身还要配合 persistent 才能落盘。
     */
    await channel.assertQueue(QUEUE, { durable: true });
    await channel.bindQueue(QUEUE, EXCHANGE);

    console.log(`[fanout] ElasticSearch消费者监听队列: ${QUEUE}`);

    channel.consume(QUEUE, async (msg) => {
        if (!msg) return;

        const data = JSON.parse(msg.content.toString());
        console.log('[es] 收到消息，写入 ElasticSearch:', data.docId, data.source);

        // 实际项目里这里会做：解析 Markdown → 建索引文档 → bulk 写入 ES
        channel.ack(msg);

        await channel.close();
        await connection.close();
    });
}

main().catch(console.error);
