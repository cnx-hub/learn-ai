import { llm, embeddings } from './model.mjs';

import { Annotation } from '@langchain/langgraph';
import { z } from 'zod';

const stateGraph = Annotation.Root({
    question: Annotation,
    k: Annotation,
    strategy: Annotation,
    routeReason: Annotation,
    subQuestions: Annotation,
    nextSubIdx: Annotation,
    documents: Annotation,
    currentQuestion: Annotation,
    retrievalCount: Annotation,
    maxRetrievals: Annotation,
    plannedNext: Annotation,
    generation: Annotation
});

const RouteSchema = z.object({
    strategy: z.enum(["simple", "complex"]),
    reason: z.string()
});

const routerQuestionNode = async (state) => {
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
        routeReason: res.reason
    }

}

const DecomposeSchema = z.object({
    subQuestions: z.array(z.string()).min(1).max(8),
    reason: z.string(),
});

const decomposeQuestionNode = async (state) => {
    console.log("---DECOMPOSE_QUESTION---");

    const decomposer = llm.withStructuredOutput(DecomposeSchema);
    const out = await decomposer.invoke(`你是《天龙八部》多跳问答的「子问题拆解器」。
            用户原始问题：
            ${state.question}

            任务：将问题拆成**有序**子问题列表 sub_questions，用于**依次向量检索**。要求：
            1. 链式推理、多层关系、因果先后的问题，必须拆成多条；单跳即可答的也可只输出 1 条。
            2. 每条子问题必须是**可独立检索**的完整中文问句，**禁止**使用「他/她/此人/上文」等指代；可写全人物名与事件名。
            3. 顺序必须符合推理链：先搞清前置实体/事实，再查后续结论。
            4. **不要**把整句原题原样复制成唯一一条（除非确实无法拆分）；不要拆成过碎的关键词列表。
            5. 输出 1～8 条即可。

            请输出 sub_questions 与简短 reason。
        `);

    const subQuestions = out.sub_questions.map((s) => s.trim()).filter(Boolean);


    if (subQuestions.length === 0) {
        throw new Error("decompose_question: sub_questions 为空");
    }

    console.log(`拆解 ${subQuestions.length} 条子问题 (${out.reason})`);
    subQuestions.forEach((q, i) => {
        console.log(`  [${i + 1}] ${q}`);
    });

    return {
        subQuestions,
        nextSubIdx: 0,
        currentQuery: subQuestions[0],
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
        }))
    } catch (error) {
        console.error("检索内容时出错:", error.message);
        return [];
    }
}

function mergeUnique(existingDocs, newDocs) {
    const map = new Map();
    for (const d of [...existingDocs, ...newDocs]) {
        const key = String(d.id);
        const prev = map.get(key);

        if (!prev || Number(d.score) > Number(prev.score)) {
            map.set(key, d);
        }
    }

    return Array.from(map.values()).sort((a, b) => Number(b.score) - Number(a.score));
}

const retrieveNode = async (state) => {
    const subs = state.subQuestions || [];
    const idx = state.nextSubIdx || 0;
    const q = subs[idx]?.trim();

    if (!q) {
        throw new Error(`retrieve: 子问题下标 ${idx} 无有效文本（共 ${subs.length} 条）`);
    }

    const round = state.retrievalCount + 1;
    console.log(`---RETRIEVE (第 ${round} 轮，子问题 ${idx + 1}/${subs.length})---`);
    console.log(`查询: ${q}`);

    const newDocs = await retrieveRelevantContent(q, state.k);
    const merged = mergeUnique(state.documents ?? [], newDocs);

    if (newDocs.length === 0) {
        console.log("本轮未命中文档");
    } else {
        console.log(`本轮命中 ${newDocs.length} 条，累计去重后 ${merged.length} 条`);
        newDocs.forEach((item, i) => {
            const preview =
                item.content.length > 120 ? `${item.content.substring(0, 120)}...` : item.content;
            console.log(
                `[R${i + 1}] score=${Number(item.score).toFixed(4)} chapter=${item.chapter_num} index=${item.index}`,
            );
            console.log(`      ${preview}`);
        });
    }

    return {
        documents: merged,
        retrievalCount: round,
        nextSubIdx: idx + 1,
        currentQuery: q,
    }
};