import type { StateComparisonData } from "@/tools/compareMandiPrices";
import type { CropDiseaseDiagnosis } from "@/tools/diagnoseCropDisease";
import type { GovernmentSchemesResult } from "@/tools/getGovernmentSchemes";
import type { MarketDataResult } from "@/tools/getMarketData";

export type PreviousChats = (
  | MarketDataResult
  | CropDiseaseDiagnosis
  | StateComparisonData
  | GovernmentSchemesResult
  | Record<string, MarketDataResult>
  | { error: string }
)[];

export type ToolResponse =
  | import("@/tools/getMarketData").MarketDataResult
  | Record<string, import("@/tools/getMarketData").MarketDataResult>
  | import("@/tools/getGovernmentSchemes").GovernmentSchemesResult
  | import("@/tools/diagnoseCropDisease").CropDiseaseDiagnosis
  | { error: string };
