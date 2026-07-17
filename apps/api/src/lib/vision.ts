import { readFile } from 'node:fs/promises';

export interface VisionAnalysis {
  sensitiveFlag: boolean;
  hints: string[];
  suggestedFileType?: string;
  summary?: string;
  source: 'minimax' | 'heuristic';
}

function heuristicImageAnalysis(fileName: string): VisionAnalysis {
  const hints: string[] = [];
  if (/身份证|idcard/i.test(fileName)) hints.push('文件名提示可能含身份证号');
  if (/手机|电话|contact/i.test(fileName)) hints.push('文件名提示可能含联系方式');
  if (/姓名|name/i.test(fileName)) hints.push('文件名提示可能含姓名');
  return {
    sensitiveFlag: hints.length > 0,
    hints,
    source: 'heuristic',
  };
}

export async function analyzeImageAttachment(
  filePath: string,
  mimeType: string,
  fileName: string,
): Promise<VisionAnalysis> {
  const apiKey = process.env.MULTIMODAL_API_KEY;
  const baseUrl = (process.env.MULTIMODAL_BASE_URL || 'https://api.minimaxi.com/anthropic').replace(
    /\/$/,
    '',
  );
  const model = process.env.MULTIMODAL_MODEL || 'MiniMax-M2.5';

  if (!apiKey) {
    return heuristicImageAnalysis(fileName);
  }

  try {
    const buffer = await readFile(filePath);
    const mediaType = mimeType.startsWith('image/') ? mimeType : 'image/jpeg';

    const res = await fetch(`${baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 512,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mediaType,
                  data: buffer.toString('base64'),
                },
              },
              {
                type: 'text',
                text: `你是临床运营证据审核助手。分析这张现场照片，仅输出 JSON：
{
  "sensitiveFlag": boolean,
  "hints": string[],
  "suggestedFileType": string,
  "summary": string
}
要求：检测姓名、身份证号、手机号、受试者编号等敏感信息；suggestedFileType 用中文如「知情同意」「药物管理」「原始记录」；不得编造看不清的内容。`,
              },
            ],
          },
        ],
      }),
    });

    const raw = await res.text();
    if (!res.ok) {
      throw new Error(`Vision API ${res.status}: ${raw.slice(0, 300)}`);
    }

    const payload = JSON.parse(raw) as {
      content?: Array<{ type: string; text?: string }>;
    };
    const textBlock = payload.content?.find((c) => c.type === 'text')?.text ?? '';
    const jsonMatch = textBlock.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Vision response missing JSON');

    const parsed = JSON.parse(jsonMatch[0]) as {
      sensitiveFlag?: boolean;
      hints?: string[];
      suggestedFileType?: string;
      summary?: string;
    };

    return {
      sensitiveFlag: Boolean(parsed.sensitiveFlag),
      hints: Array.isArray(parsed.hints) ? parsed.hints : [],
      suggestedFileType: parsed.suggestedFileType,
      summary: parsed.summary,
      source: 'minimax',
    };
  } catch (err) {
    console.warn('Vision analysis failed, using heuristic:', err);
    return heuristicImageAnalysis(fileName);
  }
}