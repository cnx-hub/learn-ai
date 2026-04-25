import { RunnablePassthrough, RunnableLambda, RunnableSequence, RunnableMap } from '@langchain/core/runnables';

// const chain = RunnableSequence.from([
//     RunnableLambda.from((input) => ({ concept: input })),
//     RunnableMap.from({
//         original: new RunnablePassthrough(),
//         processed: RunnableLambda.from((obj) => ({
//             upper: obj.concept.toUpperCase(),
//             length: obj.concept.length,
//         }))
//     })
// ]);

const chain = RunnableSequence.from([
    (input) => ({ concept: input }),
    {
        original: new RunnablePassthrough(),
        processed: RunnableLambda.from((obj) => ({
            upper: obj.concept.toUpperCase(),
            length: obj.concept.length,
        }))
    }
])

const chain2 = RunnableSequence.from([
    (input) => ({ concept: input }),
    RunnablePassthrough.assign({
        origin: new RunnablePassthrough(),
        processed: RunnableLambda.from((obj) => ({
            upper: obj.concept.toUpperCase(),
            length: obj.concept.length,
        }))
    })
])

const res = await chain2.invoke('神说一定要有光');

console.log(res);
