import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

console.log('--- TEST 1: Validate JSON Schemas of all Definitions ---');
const definitionsDir = './src/registry/definitions';
const files = readdirSync(definitionsDir).filter(f => f.endsWith('.json'));

let totalNodes = 0;
const allDefinitions = [];

for (const file of files) {
  const filePath = join(definitionsDir, file);
  const content = readFileSync(filePath, 'utf-8');
  let json;
  try {
    json = JSON.parse(content);
  } catch (err) {
    console.error(`FAILED to parse JSON in ${file}:`, err);
    process.exit(1);
  }

  if (!json.id || !json.name || !Array.isArray(json.nodes)) {
    console.error(`Invalid library package in ${file}: missing id, name or nodes array`);
    process.exit(1);
  }

  for (const node of json.nodes) {
    totalNodes++;
    allDefinitions.push(node);

    if (!node.id || !node.label || !node.category || !node.codeTemplate) {
      console.error(`Node in ${file} missing basic fields: ${JSON.stringify(node)}`);
      process.exit(1);
    }

    if (!Array.isArray(node.inputs) || !Array.isArray(node.outputs) || !Array.isArray(node.properties)) {
      console.error(`Node ${node.id} missing inputs/outputs/properties array`);
      process.exit(1);
    }

    // Check codeTemplate.template
    if (typeof node.codeTemplate.template !== 'string') {
      console.error(`Node ${node.id} codeTemplate.template is not a string`);
      process.exit(1);
    }

    // Check if outputVariables is present and maps existing outputs
    if (node.codeTemplate.outputVariables) {
      for (const [outPort, varPattern] of Object.entries(node.codeTemplate.outputVariables)) {
        const portExists = node.outputs.some(o => o.id === outPort);
        if (!portExists) {
          console.warn(`WARNING: Node ${node.id} outputVariables maps '${outPort}', but no output port with that ID exists!`);
        }
      }
    }
  }

  console.log(`✓ ${file}: ${json.nodes.length} nodes parsed successfully.`);
}

console.log(`Total libraries: ${files.length}, Total nodes: ${totalNodes}\n`);
