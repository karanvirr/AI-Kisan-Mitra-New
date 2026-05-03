import { getMarketData } from "@/tools/getMarketData";
import { compareStateMarketData } from "@/tools/compareMandiPrices";
import { getGovernmentSchemes } from "@/tools/getGovernmentSchemes";
import { diagnoseCropDisease } from "@/tools/diagnoseCropDisease";
import { FunctionResponseScheduling } from "@google/genai";
import type { ToolResponse } from "@/types/tool_types";
import type { PreviousChats } from "@/types/tool_types";

interface HandleGeminiToolCallsParams {
  toolCall: any;
  setLoading?: (loading: { active: boolean; toolName?: string }) => void;
  onMarketDataReceived: (data: ToolResponse) => void;
  onRequestImageForDiagnosis?: (cb: (image: string) => void) => void;
  previousChats: PreviousChats;
  currentLanguage: string;
  geminiApiKey: string;
}

// --- Synthesis logic ---
export function synthesizeToolResults(
  toolResults: any[],
  toolCalls: any[],
  currentLanguage: string
): any {
  let summary = "";
  let marketData, comparisonData, schemeData, diseaseData;
  let charts: Array<{ type: string; data: any; title: string }> = [];
  let stats: Array<{
    label: string;
    value: string | number;
    icon?: string;
    color?: string;
  }> = [];
  let details: Record<string, any> = {};

  for (let i = 0; i < toolCalls.length; i++) {
    const call = toolCalls[i];
    const result = toolResults[i];
    switch (call.name) {
      case "get_market_data":
        marketData = result;
        break;
      case "compare_state_market_data":
        comparisonData = result;
        break;
      case "get_government_schemes":
        schemeData = result;
        break;
      case "diagnose_crop_disease":
        diseaseData = result;
        break;
      default:
        break;
    }
  }

  // Disease
  if (diseaseData) {
    details.disease = diseaseData;
    summary += diseaseData?.cause
      ? `🦠 Disease diagnosis: ${diseaseData.cause}. ${
          diseaseData.suggestion || ""
        }`
      : diseaseData?.error || "No disease info.";
  }

  // Market Data
  if (marketData) {
    details.market = marketData;
    if (marketData.chartData && marketData.chartType) {
      charts.push({
        type: marketData.chartType,
        data: marketData.chartData,
        title: marketData.title || "Market Data",
      });
    }
    if (marketData.records && Array.isArray(marketData.records)) {
      const prices = marketData.records
        .map((r: any) => parseFloat(r.Modal_Price))
        .filter((n: number) => !isNaN(n));
      const min = prices.length ? Math.min(...prices) : "-";
      const max = prices.length ? Math.max(...prices) : "-";
      const avg = prices.length
        ? (
            prices.reduce((a: number, b: number) => a + b, 0) / prices.length
          ).toFixed(0)
        : "-";
      stats.push({
        label: "Minimum Price",
        value: min,
        icon: "TrendingDown",
        color: "green",
      });
      stats.push({
        label: "Maximum Price",
        value: max,
        icon: "TrendingUp",
        color: "red",
      });
      stats.push({
        label: "Average Price",
        value: avg,
        icon: "Activity",
        color: "blue",
      });
      stats.push({
        label: "Records",
        value: marketData.records.length,
        icon: "BarChart3",
        color: "purple",
      });
    }
    summary +=
      (summary ? "\n" : "") +
      (marketData?.suggestion ||
        marketData?.summary ||
        marketData?.error ||
        "Market data available.");
  }

  // Comparison Data
  if (comparisonData) {
    details.comparison = comparisonData;
    if (comparisonData.chartData && comparisonData.chartType) {
      charts.push({
        type: comparisonData.chartType,
        data: comparisonData.chartData,
        title: comparisonData.title || "Comparison Data",
      });
    }
    summary +=
      (summary ? "\n" : "") +
      (comparisonData?.suggestion ||
        comparisonData?.summary ||
        comparisonData?.error ||
        "Comparison data available.");
  }

  // Government Schemes
  if (schemeData) {
    details.schemes = schemeData;
    summary +=
      (summary ? "\n" : "") +
      (schemeData?.suggestion ||
        schemeData?.summary ||
        schemeData?.error ||
        "Scheme info available.");
  }

  if (!summary) {
    summary = "No actionable information found.";
  }

  return {
    id: toolCalls[0]?.id || "synthesized",
    name: "synthesized_result",
    response: {
      result: {
        summary,
        charts,
        stats,
        details,
      },
      scheduling: FunctionResponseScheduling.INTERRUPT,
    },
  };
}

export async function handleGeminiToolCalls({
  toolCall,
  setLoading,
  onMarketDataReceived,
  onRequestImageForDiagnosis,
  previousChats,
  currentLanguage,
  geminiApiKey,
}: HandleGeminiToolCallsParams) {
  if (setLoading)
    setLoading({
      active: true,
      toolName: toolCall.functionCalls?.[0]?.name || "Tool",
    });

  const toolResults: any[] = [];

  for (const fc of toolCall.functionCalls) {
    let toolResult: any;
    switch (fc.name) {
      case "get_market_data":
        if (fc.args && typeof fc.args.commodityName === "string") {
          toolResult = await getMarketData(
            fc.args.commodityName,
            fc.args.state,
            fc.args.district,
            fc.args.market,
            fc.args.arrivalDate,
            fc.args.startDate,
            fc.args.endDate,
            previousChats,
            currentLanguage,
            geminiApiKey
          );
        } else {
          toolResult = {
            error:
              "Missing or invalid 'commodityName' argument for get_market_data.",
          };
        }
        break;
      case "compare_state_market_data":
        if (
          fc.args &&
          typeof fc.args.commodityName === "string" &&
          (Array.isArray(fc.args.states) || Array.isArray(fc.args.district))
        ) {
          const regions =
            Array.isArray(fc.args.states) && fc.args.states.length > 0
              ? fc.args.states
              : fc.args.district;
          toolResult = await compareStateMarketData(
            fc.args.commodityName,
            regions,
            fc.args.arrivalDate,
            fc.args.startDate,
            fc.args.endDate,
            previousChats,
            currentLanguage,
            geminiApiKey
          );
        } else {
          toolResult = {
            error:
              "Missing or invalid arguments for compare_state_market_data. Must provide commodityName and at least one of states or district.",
          };
        }
        break;
      case "get_government_schemes":
        if (
          fc.args &&
          typeof fc.args.query === "string" &&
          typeof fc.args.location === "string"
        ) {
          toolResult = await getGovernmentSchemes(
            fc.args.query,
            fc.args.location,
            currentLanguage,
            previousChats,
            geminiApiKey
          );
        } else {
          toolResult = {
            error:
              "Missing or invalid arguments for get_government_schemes. Must provide query and location.",
          };
        }

        break;
      case "diagnose_crop_disease":
        if (onRequestImageForDiagnosis) {
          // Defer execution to UI for image capture
          await new Promise<void>((resolve) => {
            onRequestImageForDiagnosis(async (image: string) => {
              if (!image) return;
              try {
                const toolResult = await diagnoseCropDisease(
                  image,
                  currentLanguage,
                  previousChats,
                  geminiApiKey
                );

                toolResults.push(toolResult);
              } catch (err) {
                toolResults.push({ error: "Image diagnosis failed." });
              }
              resolve();
            });
          });
        } else {
          if (fc.args && typeof fc.args.image === "string") {
            if (!fc.args.image) {
              toolResults.push({ error: "No image provided." });
              continue;
            }
            toolResult = await diagnoseCropDisease(
              fc.args.image,
              currentLanguage,
              previousChats,
              geminiApiKey
            );
          } else {
            toolResult = {
              error:
                "Missing or invalid arguments for diagnose_crop_disease. Must provide image.",
            };
          }
        }
        continue;
      default:
        toolResult = { error: `Unknown tool: ${fc.name}` };
    }
    toolResults.push(toolResult);
  }

  if (setLoading) setLoading({ active: false });

  // Synthesize all tool results into a single, actionable summary
  const synthesized = synthesizeToolResults(
    toolResults,
    toolCall.functionCalls,
    currentLanguage
  );
  console.log(synthesized);
  onMarketDataReceived(synthesized);
  return [synthesized];
}
