import { type MappingProperty } from "@elastic/elasticsearch/lib/api/types";
import {
  EVENTS_INDEX,
  OPENAI_EMBEDDING_DIMENSION,
  SPAN_INDEX,
  TRACE_CHECKS_INDEX,
  TRACE_INDEX,
  esClient,
} from "../server/elasticsearch";
import {
  type Trace,
  type ElasticSearchSpan,
  type TraceCheck,
  type Event,
} from "../server/tracer/types";

const traceMapping: Record<keyof Trace, MappingProperty> = {
  trace_id: { type: "keyword" },
  project_id: { type: "keyword" },
  thread_id: { type: "keyword" },
  user_id: { type: "keyword" },
  customer_id: { type: "keyword" },
  labels: { type: "keyword" },
  timestamps: {
    properties: {
      started_at: { type: "date" },
      inserted_at: { type: "date" },
    },
  },
  input: {
    properties: {
      value: { type: "text" },
      openai_embeddings: {
        index: true,
        type: "dense_vector",
        dims: OPENAI_EMBEDDING_DIMENSION,
        similarity: "cosine",
      },
      satisfaction_score: { type: "float" },
    },
  },
  output: {
    properties: {
      value: { type: "text" },
      openai_embeddings: {
        index: true,
        type: "dense_vector",
        dims: OPENAI_EMBEDDING_DIMENSION,
        similarity: "cosine",
      },
    },
  },
  metrics: {
    properties: {
      first_token_ms: { type: "integer" },
      total_time_ms: { type: "integer" },
      prompt_tokens: { type: "integer" },
      completion_tokens: { type: "integer" },
      tokens_estimated: { type: "boolean" },
      total_cost: { type: "float" },
    },
  },
  error: {
    properties: {
      message: { type: "text" },
      stacktrace: { type: "text" },
    },
  },
  search_embeddings: {
    properties: {
      openai_embeddings: {
        index: true,
        type: "dense_vector",
        dims: OPENAI_EMBEDDING_DIMENSION,
        similarity: "cosine",
      },
    },
  },
  topics: {
    type: "keyword",
  },
  indexing_md5s: {
    type: "keyword",
  }
};

const spanMapping: Record<keyof ElasticSearchSpan, MappingProperty> = {
  project_id: { type: "keyword" },
  type: { type: "keyword" },
  name: { type: "text" },
  span_id: { type: "keyword" },
  parent_id: { type: "keyword" },
  trace_id: { type: "keyword" },
  input: {
    properties: {
      type: {
        type: "keyword",
      },
      value: { type: "text" },
    },
  },
  outputs: {
    type: "nested",
    properties: {
      type: {
        type: "keyword",
      },
      value: { type: "text" },
    },
  },
  error: {
    properties: {
      message: { type: "text" },
      stacktrace: { type: "text" },
    },
  },
  timestamps: {
    properties: {
      started_at: { type: "date" },
      first_token_at: { type: "date" },
      finished_at: { type: "date" },
    },
  },
  vendor: { type: "keyword" },
  model: { type: "keyword" },
  raw_response: { type: "text" },
  params: {
    properties: {
      temperature: { type: "float" },
      stream: { type: "boolean" },
      functions: { type: "nested" },
    },
  },
  metrics: {
    properties: {
      prompt_tokens: { type: "integer" },
      completion_tokens: { type: "integer" },
      tokens_estimated: { type: "boolean" },
      cost: { type: "float" },
    },
  },
  contexts: {
    type: "nested",
    properties: {
      document_id: { type: "keyword" },
      chunk_id: { type: "keyword" },
      content: { type: "text" },
    },
  },
};

const traceChecksMapping: Record<keyof TraceCheck, MappingProperty> = {
  trace_id: { type: "keyword" },
  project_id: { type: "keyword" },
  thread_id: { type: "keyword" },
  user_id: { type: "keyword" },
  customer_id: { type: "keyword" },
  labels: { type: "keyword" },
  check_id: { type: "keyword" },
  check_type: { type: "keyword" },
  check_name: { type: "text" },
  status: { type: "keyword" },
  raw_result: { type: "object", enabled: false },
  value: { type: "float" },
  error: {
    properties: {
      message: { type: "text" },
      stacktrace: { type: "text" },
    },
  },
  retries: { type: "integer" },
  timestamps: {
    properties: {
      started_at: { type: "date" },
      finished_at: { type: "date" },
      inserted_at: { type: "date" },
    },
  },
};

const eventsMapping: Record<keyof Event, MappingProperty> = {
  event_id: { type: "keyword" },
  project_id: { type: "keyword" },
  event_type: { type: "text" },
  metrics: {
    type: "nested",
    properties: {
      key: { type: "keyword" },
      value: { type: "float" },
    },
  },
  event_details: {
    type: "nested",
    properties: {
      key: { type: "keyword" },
      value: { type: "text" },
    },
  },
  // Grouping fields
  trace_id: { type: "keyword" },
  thread_id: { type: "keyword" },
  user_id: { type: "keyword" },
  customer_id: { type: "keyword" },
  labels: { type: "keyword" },
  // End grouping fields
  timestamps: {
    properties: {
      started_at: { type: "date" },
      inserted_at: { type: "date" },
    },
  },
};

export const createIndexes = async () => {
  const spanExists = await esClient.indices.exists({ index: SPAN_INDEX });
  if (!spanExists) {
    await esClient.indices.create({
      index: SPAN_INDEX,
      mappings: { properties: spanMapping },
    });
  }
  await esClient.indices.putMapping({
    index: SPAN_INDEX,
    properties: spanMapping,
  });

  const traceExists = await esClient.indices.exists({ index: TRACE_INDEX });
  if (!traceExists) {
    await esClient.indices.create({
      index: TRACE_INDEX,
      mappings: { properties: traceMapping },
    });
  }
  await esClient.indices.putMapping({
    index: TRACE_INDEX,
    properties: traceMapping,
  });

  const traceChecksExists = await esClient.indices.exists({
    index: TRACE_CHECKS_INDEX,
  });
  if (!traceChecksExists) {
    await esClient.indices.create({
      index: TRACE_CHECKS_INDEX,
      mappings: { properties: traceChecksMapping },
    });
  }
  await esClient.indices.putMapping({
    index: TRACE_CHECKS_INDEX,
    properties: traceChecksMapping,
  });

  const eventsExists = await esClient.indices.exists({ index: EVENTS_INDEX });
  if (!eventsExists) {
    await esClient.indices.create({
      index: EVENTS_INDEX,
      mappings: { properties: eventsMapping },
    });
  }
  await esClient.indices.putMapping({
    index: EVENTS_INDEX,
    properties: eventsMapping,
  });
};

export default async function execute() {
  await createIndexes();
}
