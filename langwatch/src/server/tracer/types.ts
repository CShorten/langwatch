type ChatRole =
  | "system"
  | "user"
  | "assistant"
  | "function"
  | "tool"
  | "unknown";

interface FunctionCall {
  name?: string;
  arguments?: string;
}

interface ToolCall {
  id: string;
  type: string;
  function: FunctionCall;
}

interface ChatMessage {
  role?: ChatRole;
  content?: string | null;
  function_call?: FunctionCall | null;
  tool_calls?: ToolCall[] | null;
}

interface TypedValueChatMessages {
  type: "chat_messages";
  value: ChatMessage[];
}

interface TypedValueText {
  type: "text";
  value: string;
}

interface TypedValueRaw {
  type: "raw";
  value: string;
}

type JSONSerializable =
  | string
  | number
  | boolean
  | null
  | Record<string, any>
  | any[];

interface TypedValueJson {
  type: "json";
  value: JSONSerializable;
}

export type SpanInput =
  | TypedValueText
  | TypedValueChatMessages
  | TypedValueJson
  | TypedValueRaw;
export type SpanOutput =
  | TypedValueText
  | TypedValueChatMessages
  | TypedValueJson
  | TypedValueRaw;

export interface ErrorCapture {
  message: string;
  stacktrace: string[];
}

interface SpanMetrics {
  prompt_tokens?: number | null;
  completion_tokens?: number | null;
  tokens_estimated?: boolean | null;
  cost?: number | null;
}

interface SpanParams {
  temperature?: number;
  stream?: boolean;
  functions?: Record<string, any>[];
  tools?: Record<string, any>[];
  tool_choice?: string;
}

interface SpanTimestamps {
  started_at: number;
  first_token_at?: number | null;
  finished_at: number;
}

type SpanTypes = "span" | "llm" | "chain" | "tool" | "agent" | "rag";

export interface BaseSpan {
  span_id: string;
  parent_id?: string | null;
  trace_id: string;
  type: SpanTypes;
  name?: string | null;
  input?: SpanInput | null;
  outputs: SpanOutput[];
  error?: ErrorCapture | null;
  timestamps: SpanTimestamps;
}

export interface LLMSpan extends BaseSpan {
  type: "llm";
  vendor: string;
  model: string;
  raw_response?: string | Record<string, any> | any[];
  params: SpanParams;
  metrics: SpanMetrics;
}

export interface RAGChunk {
  document_id: string;
  chunk_id?: string | null;
  content: string | Record<string, any> | any[];
}

export interface RAGSpan extends BaseSpan {
  type: "rag";
  contexts: RAGChunk[];
}

export type Span = LLMSpan | RAGSpan | BaseSpan;

type SpanInputValidator = SpanInput & { value: any };
type SpanOutputValidator = SpanInput & { value: any };

export type SpanValidator = (
  | Omit<LLMSpan, "input" | "outputs">
  | Omit<RAGSpan, "input" | "outputs">
  | Omit<BaseSpan, "input" | "outputs">
) & {
  input?: SpanInputValidator | null;
  outputs: SpanOutputValidator[];
};

export type ElasticSearchInputOutput = {
  type: SpanInput["type"];
  value: string;
};

// Zod type will not be generated for this one, check ts-to-zod.config.js
export type ElasticSearchSpan = Omit<
  BaseSpan &
    Partial<Omit<RAGSpan, "type">> &
    Partial<Omit<LLMSpan, "type" | "raw_response">>,
  "input" | "outputs"
> & {
  project_id: string;
  input?: ElasticSearchInputOutput | null;
  outputs: ElasticSearchInputOutput[];
  raw_response?: string | null;
};

export type TraceInput = {
  value: string;
  openai_embeddings?: number[];
  satisfaction_score?: number;
};

export type TraceOutput = { value: string; openai_embeddings?: number[] };

export type Trace = {
  trace_id: string;
  project_id: string;
  // Grouping Fields
  thread_id?: string;
  user_id?: string;
  customer_id?: string;
  labels?: string[];
  // End Grouping Fields
  timestamps: { started_at: number; inserted_at: number };
  input: TraceInput;
  output?: TraceOutput;
  metrics: {
    first_token_ms?: number | null;
    total_time_ms?: number | null;
    prompt_tokens?: number | null;
    completion_tokens?: number | null;
    total_cost?: number | null;
    tokens_estimated?: boolean | null;
  };
  error?: ErrorCapture | null;
  search_embeddings: {
    openai_embeddings?: number[];
  };
  topics?: string[];
  indexing_md5s?: string[];
};

export type TraceCheck = {
  trace_id: string;
  check_id: string;
  project_id: string;
  // Grouping Fields
  thread_id?: string;
  user_id?: string;
  customer_id?: string;
  labels?: string[];
  // End Grouping Fields
  check_type: string;
  check_name: string;
  status: "scheduled" | "in_progress" | "error" | "failed" | "succeeded";
  raw_result?: object;
  value?: number;
  error?: ErrorCapture | null;
  retries?: number;
  timestamps: {
    inserted_at?: number;
    started_at?: number;
    finished_at?: number;
  };
};

export type Experiment = {
  experiment_id: string;
  variant: number;
};

export type CollectorRESTParams = {
  trace_id?: string | null | undefined;
  spans: Span[];
  user_id?: string | null | undefined;
  thread_id?: string | null | undefined;
  customer_id?: string | null | undefined;
  labels?: string[] | null | undefined;
  experiments?: Experiment[] | null | undefined;
};

export type CollectorRESTParamsValidator = Omit<CollectorRESTParams, "spans">;

export type Event = {
  event_id: string;
  event_type: string; // Type of event (e.g., 'thumbs_up_down', 'add_to_cart')
  project_id: string;
  metrics: Record<string, number>;
  event_details: Record<string, string>;
  // Grouping Fields
  // TODO: need a form to reconcile those with their traces if a trace_id is available
  trace_id?: string;
  thread_id?: string;
  user_id?: string;
  customer_id?: string;
  labels?: string[];
  // End Grouping Fields
  timestamps: { started_at: number; inserted_at: number };
};

export type ElasticSearchEvent = Omit<Event, "metrics" | "event_details"> & {
  metrics: { key: string; value: number }[];
  event_details: { key: string; value: string }[];
};

export type TrackEventRESTParamsValidator = Omit<
  Event,
  "event_id" | "project_id" | "timestamps" | "event_details"
> & {
  event_id?: string; // auto generated unless you want to guarantee idempotency
  event_details?: Record<string, string>;
  timestamp?: number; // The timestamp when the event occurred
};
