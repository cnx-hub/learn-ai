import { LatexTextSplitter } from "@langchain/textsplitters";
import { Document } from '@langchain/core/documents';

const latexText = `\int x^{\mu}\mathrm{d}x=\frac{x^{\mu +1}}{\mu +1}+C, \left({\mu \neq -1}\right) \int \frac{1}{\sqrt{1-x^{2}}}\mathrm{d}x= \arcsin x +C \int \frac{1}{\sqrt{1-x^{2}}}\mathrm{d}x= \arcsin x +C \begin{pmatrix}  
  a_{11} & a_{12} & a_{13} \\  
  a_{21} & a_{22} & a_{23} \\  
  a_{31} & a_{32} & a_{33}  
\end{pmatrix} `;

const document = new Document({
    pageContent: latexText,
});

const splitter = new LatexTextSplitter({
    chunkSize: 200,
    chunkOverlap: 20,
});

const splitterDocuments = await splitter.splitDocuments([document]);

splitterDocuments.forEach((doc) => {
    console.log(doc.pageContent, 'doc');
    console.log('chunkSize :', doc.pageContent.length);
    // console.log('token length :', enc.encode(doc.pageContent).length);
})