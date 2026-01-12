import { SupabaseClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

export interface ScannerConfig {
  supabase: SupabaseClient;
  anthropicApiKey: string;
}

export interface ScanRunRecord {
  id: string;
  user_id: string;
  transcript_text: string;
}

export interface DetectedProduct {
  product_name: string;
  brand?: string;
  category?: string;
  context: string;
  confidence: number;
}

/**
 * ScannerService
 * Uses Claude to extract product entities from transcripts and
 * writes suggestions into scan_suggestions table.
 */
export class ScannerService {
  private supabase: SupabaseClient;
  private anthropic: Anthropic;

  constructor(config: ScannerConfig) {
    this.supabase = config.supabase;
    this.anthropic = new Anthropic({
      apiKey: config.anthropicApiKey,
    });
  }

  async processScan(scan: ScanRunRecord): Promise<DetectedProduct[]> {
    const prompt = this.buildPrompt(scan.transcript_text);

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20240620',
        max_tokens: 1024,
        temperature: 0,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        return [];
      }

      const raw = content.text.trim();

      // Expect JSON array, but be defensive
      let parsed: any;
      try {
        parsed = JSON.parse(raw);
      } catch {
        // Try to recover JSON from fenced code block
        const match = raw.match(/```json([\s\S]*?)```/i);
        if (match) {
          parsed = JSON.parse(match[1]);
        } else {
          return [];
        }
      }

      if (!Array.isArray(parsed)) return [];

      return parsed
        .map((p: any): DetectedProduct | null => {
          if (!p || typeof p.product_name !== 'string') return null;
          return {
            product_name: p.product_name,
            brand: typeof p.brand === 'string' ? p.brand : undefined,
            category: typeof p.category === 'string' ? p.category : undefined,
            context: typeof p.context === 'string' ? p.context : '',
            confidence:
              typeof p.confidence === 'number'
                ? Math.max(0, Math.min(100, p.confidence))
                : 75,
          };
        })
        .filter(Boolean) as DetectedProduct[];
    } catch (error) {
      console.error('ScannerService.processScan error:', error);
      // On failure, return empty suggestions so pipeline still completes
      return [];
    }
  }

  async writeSuggestions(scanId: string, userId: string, products: DetectedProduct[]) {
    if (!products.length) return [];

    const suggestionsToInsert = products.slice(0, 25).map((p) => ({
      scan_run_id: scanId,
      user_id: userId,
      detected_product_name: p.product_name,
      detected_brand: p.brand,
      detected_category: p.category,
      context_snippet: p.context,
      confidence_score: p.confidence,
      status: 'pending',
    }));

    const { data, error } = await this.supabase
      .from('scan_suggestions')
      .insert(suggestionsToInsert)
      .select();

    if (error) throw error;
    return data;
  }

  private buildPrompt(transcript: string): string {
    return `
You are an assistant that extracts product mentions from creator content transcripts.

Extract up to 25 distinct products mentioned in the transcript below.

For each product, return a JSON object with:
- "product_name": string (brand + model when possible, e.g. "Sony A7 III")
- "brand": string | null
- "category": string | null (e.g. "camera", "microphone", "keyboard")
- "context": short quote from the transcript where it is mentioned
- "confidence": number between 0 and 100 (your confidence this is a real product)

Return ONLY a JSON array, no additional text.

Transcript:
${transcript}
`.trim();
  }
}


