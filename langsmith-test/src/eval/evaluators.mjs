import {
    createLLMAsJudge,
    RAG_GROUNDEDNESS_PROMPT,
    RAG_HELPFULNESS_PROMPT,
    RAG_RETRIEVAL_RELEVANCE_PROMPT,
} from 'openevals';

import { ChatOpenAI } from '@langchain/openai'

const judge = new ChatOpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    configuration: { baseURL: process.env.OPENAI_BASE_URL },
    model: process.env.MODEL_NAME ?? "qwen-plus",
    temperature: 0,
});

// RAG_RETRIEVAL_RELEVANCE_PROMPT —— 检索相关性：召回片段与问题是否相关
const ragRetrievalRelevanceJudge = createLLMAsJudge({
    judge,
    prompt: RAG_RETRIEVAL_RELEVANCE_PROMPT,
    feedbackKey: "rag_retrieval_relevance",
    continuous: true
})

// RAG_HELPFULNESS_PROMPT —— 回答有用性：是否切题、是否答非所问
const ragHelpfulnessnessJudge = createLLMAsJudge({
    judge,
    prompt: RAG_HELPFULNESS_PROMPT,
    feedbackKey: "rag_helpfulnessness",
    continuous: true
})

// RAG_GROUNDEDNESS_PROMPT —— 忠实度：答案是否被检索上下文支撑，有无幻觉
const ragGroundednessJudge = createLLMAsJudge({
    judge,
    prompt: RAG_GROUNDEDNESS_PROMPT,
    feedbackKey: "rag_groundedness",
    continuous: true
})


export function ragGroundednessEvaluator({ outputs }) {
    return ragGroundednessJudge({
        context: { documents: outputs.context },
        outputs: { answer: outputs.answer },
    })
}

export function ragHelpfulnessEvaluator({ inputs, outputs }) {
    return ragHelpfulnessnessJudge({
        inputs, outputs: { answer: outputs.answer }
    })
}

export function ragRetrievalRelevanceEvaluator({ inputs, outputs }) {
    return ragRetrievalRelevanceJudge({
        inputs, context: { documents: outputs.context }
    })
}

export const ragEvaluators = [
    ragGroundednessEvaluator,
    ragHelpfulnessEvaluator,
    ragRetrievalRelevanceEvaluator,
];