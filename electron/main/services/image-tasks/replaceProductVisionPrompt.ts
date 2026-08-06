import type { ImageTaskRequest } from '../../../../src/shared/domain/imageFeatureApi.js';
import {
  createReplaceProductPromptTemplate,
  formatReplaceProductExecutionPrompt,
} from '../../../../src/shared/domain/replaceProductExecutionPrompt.js';
import { sanitizeRequestForInstruction } from './instructionPrompt.js';

export function buildReplaceProductVisionSystemPrompt(): string {
  const template = formatReplaceProductExecutionPrompt(createReplaceProductPromptTemplate());

  return [
    '你是电商产品替换任务的视觉理解助手。',
    '你会看到图1（场景）和图2（目标产品参考）。',
    '请分析两张图，输出 ONLY 一个 JSON 对象，不要 Markdown、不要解释。',
    'JSON 必须严格符合以下 schema 示例（字段可增删数组项，但结构保持一致）：',
    template,
    '规则：',
    '1. goal、product.preserve、product.forbidden_changes、scene.preserve_except_replaced_product、compositing.requirements 须结合两张图的实际内容填写，要具体可执行。',
    '2. 必须强调：图2产品表面贴纸/标签的版式、结构、色块、文字与图案位置不得重排或重设计。',
    '3. 必须强调：在图1中原位 in-place 编辑合成，匹配图1光照/阴影/透视，禁止抠图粘贴、贴图感、硬边。',
    '4. 根据图1识别需保留的背景、手部姿势、营销文案、标注圈选等场景元素。',
    '5. 若任务参数中有 user_prompt，将其要点写入 user_notes（可补充细节，不要丢弃）。',
    '6. 不要输出图片路径、base64 或任何非 JSON 文本。',
  ].join('\n');
}

export function buildReplaceProductVisionUserText(request: ImageTaskRequest): string {
  const parameters = sanitizeRequestForInstruction(request);
  const payload = {
    feature: 'replace_product',
    user_prompt: request.prompt?.trim() || undefined,
    structured_parameters: Object.keys(parameters).length > 0 ? parameters : undefined,
    regions: request.regions?.map((region) => ({
      id: region.id,
      imageRole: region.imageRole ?? 'source',
      bbox: {
        x: region.x,
        y: region.y,
        width: region.width,
        height: region.height,
      },
      hint: region.operationHint?.trim() || undefined,
      label: region.label?.trim() || undefined,
    })),
  };

  return [
    '请基于附带的图1（场景）与图2（目标产品）生成 replace_product JSON 指令。',
    JSON.stringify(payload, null, 2),
  ].join('\n\n');
}
