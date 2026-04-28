import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';
import {z} from 'zod';

export const ai = genkit({
  plugins: [googleAI()],
  model: 'googleai/gemini-2.5-flash',
});

/**
 * Zod schema for the analyze-logs input.
 */
const AnalyzeLogsInputSchema = z.object({
  logs: z.array(z.string()).describe('Array of VPN activity log entries'),
  serverName: z.string().optional().describe('Currently connected server name'),
});

export type AnalyzeLogsInput = z.infer<typeof AnalyzeLogsInputSchema>;

/**
 * Genkit flow: Analyze VPN connection logs using AI.
 *
 * Accepts an array of log strings and returns a concise analysis
 * covering connection stability, latency patterns, and recommendations.
 */
export const analyzeLogsFlow = ai.defineFlow(
  {
    name: 'analyzeVpnLogs',
    inputSchema: AnalyzeLogsInputSchema,
    outputSchema: z.string(),
  },
  async (input) => {
    const logsText = input.logs.join('\n');

    const { text } = await ai.generate({
      prompt: `You are a VPN network analyst assistant for SuperTunnel. Analyze the following VPN connection logs and provide a concise summary (2-3 sentences) covering:
1. Connection stability and any issues detected
2. Performance observations (latency, throughput patterns)
3. One actionable recommendation

${input.serverName ? `Currently connected server: ${input.serverName}` : ''}

Logs:
${logsText}

Provide only the analysis summary, no headers or bullet points.`,
    });

    return text;
  }
);
