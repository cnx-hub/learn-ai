import { MarkdownTextSplitter } from "@langchain/textsplitters";
import { Document } from "@langchain/core/documents";


const readmeText = `# Project Name

> A brief description of your project

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## Features

- ✨ Feature 1
- 🚀 Feature 2
- 💡 Feature 3

## Installation

\`\`\`bash
npm install project-name
\`\`\`

## Usage

### Basic Usage

\`\`\`javascript
import { Project } from 'project-name';

const project = new Project();
project.init();
\`\`\`

### Advanced Usage

\`\`\`javascript
const project = new Project({
  config: {
    apiKey: 'your-api-key',
    timeout: 5000,
  }
});

await project.run();
\`\`\`

## API Reference

### \`Project\`

Main class for the project.

#### Methods

- \`init()\`: Initialize the project
- \`run()\`: Run the project
- \`stop()\`: Stop the project

## Contributing

Contributions are welcome! Please read our [contributing guide](CONTRIBUTING.md).

## License

MIT License`;

const document = new Document({
    pageContent: readmeText,
});

const splitter = new MarkdownTextSplitter({
    chunkSize: 400,
    chunkOverlap: 20,
});

const splitterDocuments = await splitter.splitDocuments([document]);

splitterDocuments.forEach((doc) => {
    console.log(doc.pageContent, 'doc');
    console.log('chunkSize :', doc.pageContent.length);
    // console.log('token length :', enc.encode(doc.pageContent).length);
});