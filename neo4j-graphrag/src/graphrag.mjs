import dotenv from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { ChatOpenAI } from '@langchain/openai';
import { StateGraph, START, END, Annotation } from '@langchain/langgraph';
import { Neo4jGraph } from '@langchain/community/graphs/neo4j_graph';
import { HumanMessage } from '@langchain/core/messages'

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../../.env'), quiet: true });

const llm = new ChatOpenAI({
    model: process.env.MODEL_NAME,
    apiKey: process.env.OPENAI_API_KEY,
    configuration: { baseURL: process.env.OPENAI_BASE_URL },
    temperature: 0,
});

const graph = new Neo4jGraph({
    url: 'bolt://localhost:7687',
    username: 'neo4j',
    password: '12345678'
});

const StateAnnotation = Annotation.Root({
    messages: Annotation({
        reducer: (left, right) =>
            left.concat(Array.isArray(right) ? right : [right]),
        default: () => [],
    }),
    cypher: Annotation({ default: () => null }),
    context: Annotation({ default: () => null }),
    answer: Annotation({ default: () => null }),
});

function userQuery(state) {
    const last = state.messages[state.messages.length - 1]
    return last.content
}


async function generateCypher(state) {
    const prompt = `
      你是一个专业的 Neo4j Cypher 生成器。
      严格按照下面的结构生成正确语句，只返回纯 Cypher 代码，不要任何解释、不要标点、不要 markdown。
  
      节点：
      - Product: 奶茶产品
      - Ingredient: 配料
      - Type: 奶茶类型
      - Method: 制作工艺
      - People: 适合人群
  
      关系方向（必须严格遵守）：
      - (Product)-[:属于]->(Type)
      - (Product)-[:包含]->(Ingredient)
      - (Product)-[:适合]->(People)
      - (Ingredient)-[:使用]->(Method)
  
      规则：
      1. 关系方向绝对不能反
      2. 多跳查询请使用多个 MATCH，不要连错路径
      3. 只返回最终可运行的 Cypher 语句
  
      用户问题：${userQuery(state)}
    `

    const res = await llm.invoke([new HumanMessage(prompt)]);
    console.log('cypher result =====> ', res)

    return { cypher: res.content }
}

async function executeGraphQuery(state) {
    try {
        const res = await graph.query(state.cypher)
        console.log('graph query result =====> ', res)
        return { context: JSON.stringify(res) }
    } catch (error) {
        return { context: '未查询到相关知识' }
    }
}

async function generateAnswer(state) {
    const prompt = `
    你是奶茶专家，根据下方「检索结果」回答用户问题；检索结果为空或不足时简要说明无法从图谱得到答案，不要编造。
    回答要求：
    - 直接列出事实，不要推断图谱里未出现的配料（如水、冰、添加剂等）。

    检索结果：${state.context}
    用户问题：${userQuery(state)}
  `

    const res = await llm.invoke([new HumanMessage(prompt)]);
    console.log('answer result =====> ', res)
    return { answer: res.content }
}

const workflow = new StateGraph(StateAnnotation)
    .addNode('generateCypher', generateCypher)
    .addNode('executeGraphQuery', executeGraphQuery)
    .addNode('generateAnswer', generateAnswer)
    .addEdge(START, 'generateCypher')
    .addEdge('generateCypher', 'executeGraphQuery')
    .addEdge('executeGraphQuery', 'generateAnswer')
    .addEdge('generateAnswer', END);

const app = workflow.compile()

async function printWorkflowMermaid() {
    const drawable = await app.getGraphAsync()
    const mermaid = drawable.drawMermaid({ withStyles: true })
    console.log('--- LangGraph 工作流 (Mermaid) ---')
    console.log(mermaid)
    console.log('-----------------------------------------------------------')
}

async function runGraphRAG(question) {
    const res = await app.invoke({ messages: [new HumanMessage(question)] });

    console.log('======================================')
    console.log('用户问题：', question)
    console.log('生成 Cypher：', res.cypher)
    console.log('检索结果：', res.context)
    console.log('最终回答：', res.answer)
    console.log('======================================')
}

(async () => {
    await printWorkflowMermaid()
    await Promise.all([
        runGraphRAG('我们这款珍珠奶茶有哪些配料？'),
        // runGraphRAG('台式奶茶的饮品都有哪些配料？'),
        // runGraphRAG('珍珠奶茶适合哪些人群饮用？'),
    ])
    
    // 关闭 Neo4j 连接，让进程可以退出
    await graph.close()
    console.log('\n✓ 已关闭 Neo4j 连接')
})().catch(console.error)