import fs from "node:fs";

const [, , inputPath, outputPath] = process.argv;
if (!inputPath || !outputPath) {
  throw new Error("Usage: node scripts/convert-spec-gloss.mjs input.glb output.glb");
}

const source = fs.readFileSync(inputPath);
if (source.toString("ascii", 0, 4) !== "glTF" || source.readUInt32LE(4) !== 2) {
  throw new Error("Only GLB v2 files are supported.");
}

const chunks = [];
let offset = 12;
while (offset < source.length) {
  const length = source.readUInt32LE(offset);
  const type = source.readUInt32LE(offset + 4);
  chunks.push({ type, data: source.subarray(offset + 8, offset + 8 + length) });
  offset += 8 + length;
}

const jsonChunk = chunks.find((chunk) => chunk.type === 0x4e4f534a);
if (!jsonChunk) throw new Error("GLB JSON chunk is missing.");
const gltf = JSON.parse(jsonChunk.data.toString("utf8").trimEnd());
let converted = 0;

for (const material of gltf.materials ?? []) {
  const specGloss = material.extensions?.KHR_materials_pbrSpecularGlossiness;
  if (!specGloss) continue;
  material.pbrMetallicRoughness = {
    baseColorFactor: specGloss.diffuseFactor ?? [1, 1, 1, 1],
    metallicFactor: 0,
    roughnessFactor: 1 - (specGloss.glossinessFactor ?? 1),
  };
  if (specGloss.diffuseTexture) material.pbrMetallicRoughness.baseColorTexture = specGloss.diffuseTexture;
  delete material.extensions.KHR_materials_pbrSpecularGlossiness;
  if (Object.keys(material.extensions).length === 0) delete material.extensions;
  converted += 1;
}

gltf.extensionsUsed = (gltf.extensionsUsed ?? []).filter((name) => name !== "KHR_materials_pbrSpecularGlossiness");
gltf.extensionsRequired = (gltf.extensionsRequired ?? []).filter((name) => name !== "KHR_materials_pbrSpecularGlossiness");
if (gltf.extensionsUsed.length === 0) delete gltf.extensionsUsed;
if (gltf.extensionsRequired.length === 0) delete gltf.extensionsRequired;
gltf.asset.extras = { ...gltf.asset.extras, osteoplotProcessing: "Specular-glossiness material converted to metallic-roughness for Three.js compatibility." };

const jsonBytes = Buffer.from(JSON.stringify(gltf), "utf8");
const jsonPadding = (4 - (jsonBytes.length % 4)) % 4;
const paddedJson = Buffer.concat([jsonBytes, Buffer.alloc(jsonPadding, 0x20)]);
const outputChunks = chunks.map((chunk) => chunk === jsonChunk ? { type: chunk.type, data: paddedJson } : chunk);
const totalLength = 12 + outputChunks.reduce((sum, chunk) => sum + 8 + chunk.data.length, 0);
const header = Buffer.alloc(12);
header.write("glTF", 0, 4, "ascii");
header.writeUInt32LE(2, 4);
header.writeUInt32LE(totalLength, 8);
const output = [header];
for (const chunk of outputChunks) {
  const chunkHeader = Buffer.alloc(8);
  chunkHeader.writeUInt32LE(chunk.data.length, 0);
  chunkHeader.writeUInt32LE(chunk.type, 4);
  output.push(chunkHeader, chunk.data);
}
fs.writeFileSync(outputPath, Buffer.concat(output));
console.log(`Converted ${converted} material(s): ${outputPath}`);
