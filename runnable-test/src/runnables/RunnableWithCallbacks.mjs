import { RunnableLambda, RunnableSequence } from "@langchain/core/runnables";

const clean = RunnableLambda.from((text) => {
    return text.trim().replace(/\s+/g, " ");
});

const tokenize = RunnableLambda.from((text) => {
    return text.split(" ");
});

const count = RunnableLambda.from((tokens) => {
    return { tokens, wordCount: tokens.length };
});

const chain = RunnableSequence.from([clean, tokenize, count]);

chain.invoke("  hello   world   from   langchain  ", {
    callbacks: [
        {
            handleChainStart: (chain) => {
                const step = chain?.id?.[chain.id.length - 1] ?? "unknown";
                console.log(`[START] ${step}`);
            },
            handleChainEnd: (output) => {
                console.log(`[END]   output=${JSON.stringify(output)}\n`);
            },
            handleChainError: (err) => {
                console.log(err)
            }
        },
        // {
        //     handleChainStart: (chain) => {
        //         const step = chain?.id?.[chain.id.length - 1] ?? "unknown";
        //         console.log(`[START] ${step}`);
        //     },
        //     handleChainEnd: (output) => {
        //         console.log(`[END]   output=${JSON.stringify(output)}\n`);
        //     },
        //     handleChainError: (err) => {
        //         console.log(err)
        //     }
        // }
    ]
})