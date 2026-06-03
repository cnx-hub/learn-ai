import { Annotation, StateGraph, START, END } from '@langchain/langgraph';

const StateAnnotation = Annotation.Root({
    tries: Annotation({
        reducer: (_prev, next) => next,
        default: () => 0,
    }),
    ok: Annotation({
        reducer: (_prev, next) => next,
        default: () => false,
    }),
    message: Annotation({
        reducer: (_prev, next) => next,
        default: () => '',
    })
});

const attempt = (state) => {
    const tries = state.tries + 1;
    const ok = tries >= 3;

    return {
        tries,
        ok,
        message: ok ? `第 ${tries} 次成功` : `第 ${tries} 次失败，继续重试`,
        // a: 1  不会被传递
    }
};


const graph = new StateGraph(StateAnnotation)
    .addNode('attempt', attempt)
    .addEdge(START, 'attempt')
    .addConditionalEdges('attempt', (state) => state.ok ? "done" : "retry", {
        retry: "attempt",
        done: END,
    })
    .compile();;


const drawable = await graph.getGraphAsync();
const mermaid = drawable.drawMermaid({ withStyles: true });
console.log(mermaid);

const result = await graph.invoke({ tries: 1 });
console.log("result:", result);