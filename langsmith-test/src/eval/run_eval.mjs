import { evaluate } from 'langsmith/evaluation';
import "dotenv/config";
import { ask } from '../rag_agent.mjs';
import { Client } from 'langsmith';
import { ragEvaluators } from './evaluators.mjs'

const DATASET_NAME = "rag-eval-v1";
const client = new Client({ apiKey: process.env.LANGCHAIN_API_KEY });

/** 被评测的 RAG Agent */
async function runRagAgent(inputs) {
    const { answer, context } = await ask(inputs.question);
    return {
        answer,
        context: context.map((d) => d.pageContent),
    };
}

async function main() {
    const result = await evaluate(runRagAgent, {
        data: DATASET_NAME,
        evaluators: ragEvaluators,
        client,
        experimentPrefix: `rag-openevals-${process.env.MODEL_NAME ?? "qwen"}`,
        maxConcurrency: 2,
    });

    console.log(result, 'result')


    // 等待全部样例跑完
    for await (const _row of result) {
        /* drain */
    }

    const project = process.env.LANGCHAIN_PROJECT ?? "default";
    console.log("✅ 评测完成");
    console.log("实验名:", result.experimentName);
    console.log(
        "指标: rag_groundedness | rag_helpfulness | rag_retrieval_relevance",
    );
    console.log(
        `报告: https://smith.langchain.com/o/default/projects/p/${encodeURIComponent(project)}`,
    );

}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});