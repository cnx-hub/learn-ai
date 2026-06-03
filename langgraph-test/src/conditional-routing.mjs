import { Annotation, StateGraph, START, END } from "@langchain/langgraph";

const StateAnnotation = Annotation.Root({
    query: Annotation({
        reducer: (_prev, next) => next,
        default: () => "",
    }),
    route: Annotation({
        reducer: (_prev, next) => next,
        default: () => "chat",
    }),
    answer: Annotation({
        reducer: (_prev, next) => next,
        default: () => "",
    })
});

const router = (state) => {
    const isMath = /[+\-*/]/.test(state.query);

    return { route: isMath ? "math" : "chat" };
}

const mathNode = (state) => {
    try {
        return { answer: String(eval(state.query)) };
    } catch {
        return { answer: "表达式无法计算" };
    }
}

const chatNode = (state) => ({ answer: `你说的是：${state.query}` });



const graph = new StateGraph(StateAnnotation)
    .addNode('router', router)
    .addNode('math', mathNode)
    .addNode('chat', chatNode)
    .addEdge(START, 'router').addConditionalEdges('router', (state) => state.route, {
        math: "math",
        chat: "chat",
    })
    .addEdge("math", END)
    .addEdge("chat", END)
    .compile();

const drawable = await graph.getGraphAsync();
const mermaid = drawable.drawMermaid({ withStyles: true });
console.log(mermaid);

// graph.invoke({ query: "10 * 8" })
const result = await graph.invoke({ query: "hello" });
console.log("result:", result);