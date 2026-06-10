import { llm, embeddings } from './model.mjs'

import { Milvus } from "@langchain/community/vectorstores/milvus";
import { StateGraph, START, END, Annotation } from '@langchain/langgraph';
import { z } from 'zod'

const stateGraph = Annotation.Root({
    question: Annotation,
    k: Annotation,
    strategy: Annotation,
    routeReason: Annotation,
    documents: Annotation,
    generation: Annotation,
});

const RouteSchema = z.object({
    strategy: z.enum(["simple", "complex"]),
    reason: z.string(),
});

const routeQuestionNode = async (state) => {
    console.log("---ROUTE_QUESTION---");

    const router = llm.withStructuredOutput(RouteSchema);

    const res = await router.invoke(`
        你是问答路由器。请判断用户问题是否需要外部检索。

        规则：
        - simple: 常识问答、简短定义、无需特定小说细节即可回答。
        - complex: 需要《天龙八部》具体情节、人物关系、章节事实、原文细节或证据支持。

        用户问题：${state.question}
        `);

    console.log(`路由策略: ${route.strategy} (${route.reason})`);

    return {
        strategy: res.strategy,
        routeReason: res.reason,
    }
}

let vectorStore;

const retrieveRelevantContent = async (question, k) => {
    try {
        const docsWithScores = await vectorStore.similaritySearchWithScore(question, k);

        return docsWithScores.map(([doc, score]) => ({
            score,
            content: doc.pageContent,
            id: doc.metadata?.id ?? "unknown",
            book_id: doc.metadata?.book_id ?? "未知",
            chapter_num: doc.metadata?.chapter_num ?? "未知",
            index: doc.metadata?.index ?? "未知",
        }));
    } catch (error) {
        console.error("检索内容时出错:", error.message);
        return [];
    }
}

const retrieveNode = async (state) => {
    console.log("---RETRIEVE_CONTENT---");

    const documents = await retrieveRelevantContent(state.question, state.k);

    if (documents.length === 0) {
        console.log("RETRIEVE结果: 未命中文档");
    } else {
        console.log(`RETRIEVE结果: 命中 ${documents.length} 条`);
        documents.forEach((item, i) => {
            const preview =
                item.content.length > 120 ? `${item.content.substring(0, 120)}...` : item.content;
            console.log(
                `[R${i + 1}] score=${Number(item.score).toFixed(4)} chapter=${item.chapter_num} index=${item.index}`,
            );
            console.log(`      ${preview}`);
        });
    }

    return {
        documents,
    }
}

const ragGenerateNode = async (state) => {
    console.log("---RAG_GENERATE---");

    const context = state.documents.map((item, i) => `[片段 ${i + 1}]章节: 第 ${item.chapter_num} 章内容: ${item.content}`)
        .join("\n\n━━━━━\n\n");
    process.stdout.write("\n【AI 回答（流式）】\n");

    const prompt = `你是一个专业的《天龙八部》小说助手。基于小说内容回答问题，用准确、详细的语言。
                    请根据以下《天龙八部》小说片段内容回答问题：
                    ${context || "（未检索到相关内容）"}

                    用户问题: ${state.question}

                    回答要求：
                    1. 如果片段中有相关信息，请结合小说内容给出详细、准确的回答
                    2. 可以综合多个片段的内容，提供完整的答案
                    3. 如果片段中没有相关信息，请如实告知用户
                    4. 回答要准确，符合小说的情节和人物设定
                    5. 可以引用原文内容来支持你的回答

                    AI 助手的回答:`
    let generation = "";
    const stream = await llm.stream(prompt);

    for await (const chunk of stream) {
        const text = typeof chunk.content === 'string' ? chunk.content : '';
        if (!text) continue;

        generation += text;
        process.stdout.write(text);
    }
    process.stdout.write("\n");


    return {
        generation,
    }
}

const directAnswerNode = async (state) => {
    console.log("---DIRECT_ANSWER---");
    process.stdout.write("\n【AI 回答（流式）】\n");

    let generation = "";
    const stream = await llm.stream(`你是一个中文问答助手，请直接简洁回答问题。
                    问题：${state.question}`);
    for await (const chunk of stream) {
        const text = typeof chunk.content === 'string' ? chunk.content : '';
        if (!text) continue;

        generation += text;
        process.stdout.write(text);
    }
    process.stdout.write("\n");

    return {
        documents: [],
        generation,
    }
}

function decideNext(state) {
    return state.strategy === "simple" ? "direct_answer" : "retrieve";
}


const graph = new StateGraph(stateGraph)
    .addNode('routeQuestion', routeQuestionNode)
    .addNode('retrieve', retrieveNode)
    .addNode('ragGenerate', ragGenerateNode)
    .addNode('directAnswer', directAnswerNode)
    .addEdge(START, 'routeQuestion')
    .addConditionalEdges('routeQuestion', decideNext, {
        direct_answer: 'directAnswer',
        retrieve: 'retrieve',
    })
    .addEdge('retrieve', 'ragGenerate')
    .addEdge('ragGenerate', END)
    .addEdge('directAnswer', END)
    .compile();

const drawable = await graph.getGraphAsync();
const mermaid = drawable.drawMermaid({ withStyles: true });
console.log(mermaid);
