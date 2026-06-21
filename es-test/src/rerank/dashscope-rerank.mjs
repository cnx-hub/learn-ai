import { BaseDocumentCompressor } from "@langchain/core/retrievers/document_compressors";
import dotenv from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../../../.env'), quiet: true });

export class DashscopeRerank extends BaseDocumentCompressor {
    constructor({ apiKey, model = "qwen3-rerank", topN = 3, baseUrl } = {}) {
        super();
        this.apiKey = apiKey;
        this.model = model;
        this.topN = topN;
        this.baseUrl = baseUrl ?? process.env.RERANK_URL;
    }

    async compressDocuments(documents, query, _callbacks) {
        const res = await fetch(this.baseUrl, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${this.apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: this.model,
                input: {
                    query,
                    documents: documents.map((d) => d.pageContent),
                },
                parameters: {
                    return_documents: false,
                    top_n: this.topN,
                },
            }),
        });

        const json = await res.json();
        if (!res.ok) {
            throw new Error(
                `DashScope rerank ${res.status}: ${JSON.stringify(json)}`,
            );
        }

        const results = json?.output?.results;
        if (!Array.isArray(results)) {
            throw new Error(`unexpected rerank response: ${JSON.stringify(json)}`);
        }

        return results.map((item) => documents[item.index]);
    }
}
