import { Link } from "@chakra-ui/next-js";
import {
  Alert,
  AlertIcon,
  Box,
  HStack,
  Heading,
  Skeleton,
  Tag,
  Text,
  Tooltip,
  VStack,
} from "@chakra-ui/react";
import { useRouter } from "next/router";
import numeral from "numeral";
import { useEffect } from "react";
import { Clock } from "react-feather";
import { useOrganizationTeamProject } from "../../hooks/useOrganizationTeamProject";
import type { ElasticSearchSpan } from "../../server/tracer/types";
import { api } from "../../utils/api";
import { formatMilliseconds } from "../../utils/formatMilliseconds";
import { isNotFound } from "../../utils/trpcError";
import { RenderInputOutput } from "./RenderInputOutput";
import { useTraceDetailsState } from "../../hooks/useTraceDetailsState";

type SpanWithChildren = ElasticSearchSpan & { children: SpanWithChildren[] };

function buildTree(
  spans: ElasticSearchSpan[]
): Record<string, SpanWithChildren> {
  const lookup: Record<string, SpanWithChildren> = {};

  spans.forEach((span) => {
    lookup[span.span_id] = { ...span, children: [] };
  });

  spans.forEach((span) => {
    const lookupSpan = lookup[span.span_id];
    if (span.parent_id && lookup[span.parent_id] && lookupSpan) {
      lookup[span.parent_id]?.children.push?.(lookupSpan);
    }
  });

  return lookup;
}

interface SpanNodeProps {
  span: SpanWithChildren;
  level: number;
  lastChild: boolean;
}

const SpanNode: React.FC<SpanNodeProps> = ({ span, level, lastChild }) => {
  const router = useRouter();
  const currentSpanId =
    typeof router.query.span === "string" ? router.query.span : undefined;
  const { project } = useOrganizationTeamProject();

  if (!project) return null;

  return (
    <VStack
      align="start"
      spacing={2}
      marginLeft={level == 0 ? "0" : level == 1 ? "10px" : "26px"}
      position="relative"
    >
      <Box
        zIndex={1}
        position="absolute"
        top="27px"
        marginLeft={level == 0 ? "21px" : "37px"}
        bottom={lastChild ? "56px" : level == 0 ? "-37px" : "56px"}
        width="1px"
        bgColor="gray.400"
        _before={
          level > 0
            ? {
                content: "''",
                width: "18px",
                height: "12px",
                borderColor: "gray.400",
                borderStyle: "solid",
                borderTopWidth: 0,
                borderRightWidth: 0,
                borderLeftWidth: "1px",
                borderBottomWidth: "1px",
                borderBottomLeftRadius: "6px",
                position: "absolute",
                top: "-19px",
                left: "-7px",
                transform: "translateX(-100%)",
              }
            : undefined
        }
      />

      <Link
        href={`/${project.slug}/messages/${span.trace_id}/spans/${span.span_id}`}
        replace={true}
        _hover={{ textDecoration: "none" }}
      >
        <HStack
          align="start"
          paddingY={2}
          paddingX={level > 0 ? 8 : 4}
          paddingRight={14}
          borderRadius={6}
          background={span.span_id === currentSpanId ? "gray.100" : undefined}
          _hover={{
            background: "gray.100",
          }}
        >
          <HStack spacing={4}>
            <Box
              background="white"
              borderColor={span.error ? "red.400" : "gray.400"}
              borderWidth="3px"
              borderRadius="100%"
              width="12px"
              height="12px"
              position="relative"
              zIndex={1}
            ></Box>
            <SpanTypeTag span={span} />
          </HStack>
          <VStack align="start">
            <Text>{span.name ?? span.model}</Text>
            <HStack fontSize={13} color="gray.500">
              <SpanDuration span={span} />
              {(span.metrics?.prompt_tokens !== undefined ||
                span.metrics?.completion_tokens !== undefined) && (
                <>
                  <Text>·</Text>
                  <Text>
                    {(span.metrics?.prompt_tokens ?? 0) +
                      (span.metrics?.completion_tokens ?? 0)}{" "}
                    tokens
                  </Text>
                </>
              )}
              {span.metrics?.cost !== undefined &&
                span.metrics?.cost !== null && (
                  <>
                    <Text>·</Text>
                    <Text fontSize={13} color="gray.500">
                      <SpanCost span={span} />
                    </Text>
                  </>
                )}
            </HStack>
          </VStack>
        </HStack>
      </Link>
      {span.children.map((childSpan, index) => (
        <SpanNode
          key={childSpan.span_id}
          span={childSpan}
          level={level + 1}
          lastChild={index == span.children.length - 1}
        />
      ))}
    </VStack>
  );
};

const TreeRenderer: React.FC<{ spans: ElasticSearchSpan[] }> = ({ spans }) => {
  const tree = buildTree(spans);
  const rootSpans = spans.filter((s) => !s.parent_id);

  return (
    <VStack align="start" flexShrink={0} spacing={6}>
      {rootSpans.map((rootSpan, index) => {
        const span = tree[rootSpan.span_id];
        if (!span) return null;
        return (
          <SpanNode
            key={rootSpan.span_id}
            span={span}
            level={0}
            lastChild={index == rootSpans.length - 1}
          />
        );
      })}
    </VStack>
  );
};

const SpanTypeTag = ({ span }: { span: ElasticSearchSpan }) => {
  return (
    <Tag
      colorScheme={
        span.error
          ? "red"
          : {
              llm: "green",
              agent: "blue",
              chain: "blue",
              tool: "orange",
              span: "gray",
              rag: "red",
            }[span.type]
      }
      fontSize={13}
    >
      {span.type.toUpperCase()}
    </Tag>
  );
};

const SpanDuration = ({ span }: { span: ElasticSearchSpan }) => {
  const duration = span.timestamps.finished_at - span.timestamps.started_at;

  return (
    <Tooltip
      label={
        <>
          Started at: {new Date(span.timestamps.started_at).toLocaleString()}
          <br />
          Finished at: {new Date(span.timestamps.finished_at).toLocaleString()}
        </>
      }
    >
      <HStack
        spacing={"6px"}
        color={
          !!span.error || duration > 30 * 1000
            ? "red"
            : duration > 10 * 1000
            ? "yellow.600"
            : "green"
        }
      >
        <Clock width={12} />
        <Text>{formatMilliseconds(duration)}</Text>
      </HStack>
    </Tooltip>
  );
};

const SpanCost = ({ span }: { span: ElasticSearchSpan }) => {
  if (span.metrics?.cost === undefined) return null;

  return numeral(span.metrics.cost).format("$0.00000a");
};

export function SpanTree() {
  const { traceId, spanId, trace } = useTraceDetailsState();
  const router = useRouter();
  const { project } = useOrganizationTeamProject();
  const spans = api.spans.getAllForTrace.useQuery(
    { projectId: project?.id ?? "", traceId: traceId ?? "" },
    { enabled: !!project && !!traceId, refetchOnWindowFocus: false }
  );
  const span = spanId
    ? spans.data?.find((span) => span.span_id === spanId)
    : undefined;

  useEffect(() => {
    if (!spanId && project && traceId && spans.data && spans.data[0]) {
      void router.replace(
        `/${project.slug}/messages/${traceId}/spans/${spans.data[0].span_id}`
      );
    }
  }, [project, router, spanId, spans.data, traceId]);

  if (isNotFound(trace.error)) {
    return <Alert status="error">Trace not found</Alert>;
  }

  return (
    <VStack width="full" padding={4}>
      {spans.data ? (
        <HStack
          align="start"
          width="full"
          spacing={10}
          flexDirection={{ base: "column", xl: "row" }}
        >
          <TreeRenderer spans={spans.data} />
          {span && (
            <VStack flexGrow={1} spacing={3} align="start">
              <HStack>
                <SpanTypeTag span={span} />
                <Heading as="h2" fontSize={22}>
                  {span.name ?? span.model}
                </Heading>
              </HStack>
              <VStack align="start" color="gray.500">
                <HStack>
                  <Text>
                    <b>Timestamp:</b>{" "}
                    {new Date(span.timestamps.started_at).toISOString()}
                  </Text>
                </HStack>
                <HStack>
                  <Text>
                    <b>Duration:</b>
                  </Text>
                  <SpanDuration span={span} />
                </HStack>
                {(span.metrics?.prompt_tokens !== undefined ||
                  span.metrics?.completion_tokens !== undefined) && (
                  <Text>
                    <b>Tokens:</b>{" "}
                    {(span.metrics?.prompt_tokens ?? 0) +
                      " prompt + " +
                      (span.metrics?.completion_tokens ?? 0) +
                      " completion"}
                  </Text>
                )}
                {(span.vendor !== undefined || span.model !== undefined) && (
                  <Text>
                    <b>Model:</b>{" "}
                    {[span.vendor, span.model].filter((x) => x).join("/")}
                  </Text>
                )}
              </VStack>
              <VStack
                alignItems="flex-start"
                spacing={2}
                paddingTop={4}
                width="full"
              >
                <Box
                  fontSize={13}
                  color="gray.400"
                  textTransform="uppercase"
                  fontWeight="bold"
                >
                  Input
                </Box>
                <Box
                  as="pre"
                  borderRadius="6px"
                  padding={4}
                  borderWidth="1px"
                  borderColor="gray.300"
                  width="full"
                  whiteSpace="pre-wrap"
                >
                  <RenderInputOutput value={span.input?.value} />
                </Box>
              </VStack>
              {span.contexts && (
                <VStack
                  alignItems="flex-start"
                  spacing={2}
                  paddingTop={4}
                  width="full"
                >
                  <Box
                    fontSize={13}
                    color="gray.400"
                    textTransform="uppercase"
                    fontWeight="bold"
                  >
                    Contexts
                  </Box>
                  <Box
                    as="pre"
                    borderRadius="6px"
                    padding={4}
                    borderWidth="1px"
                    borderColor="gray.300"
                    width="full"
                    whiteSpace="pre-wrap"
                  >
                    <RenderInputOutput
                      value={JSON.stringify(
                        span.contexts.map((context) => {
                          if (typeof context.content === "string") {
                            try {
                              return {
                                ...context,
                                content: JSON.parse(context.content),
                              };
                            } catch (_) {
                              return context;
                            }
                          }
                          return context;
                        })
                      )}
                    />
                  </Box>
                </VStack>
              )}
              {span.error ? (
                <VStack alignItems="flex-start" spacing={2} width="full">
                  <Box
                    fontSize={13}
                    color="red.400"
                    textTransform="uppercase"
                    fontWeight="bold"
                  >
                    Exception
                  </Box>
                  <Box
                    as="pre"
                    borderRadius="6px"
                    padding={4}
                    borderWidth="1px"
                    borderColor="gray.300"
                    width="full"
                    whiteSpace="pre-wrap"
                    color="red.900"
                  >
                    {span.error.stacktrace}
                  </Box>
                </VStack>
              ) : (
                <VStack alignItems="flex-start" spacing={2} width="full">
                  <Box
                    fontSize={13}
                    color="gray.400"
                    textTransform="uppercase"
                    fontWeight="bold"
                  >
                    Generated
                  </Box>
                  {span.outputs.length == 0 && <Text>{"<empty>"}</Text>}
                  {span.outputs.map((output, index) => (
                    <Box
                      key={index}
                      as="pre"
                      borderRadius="6px"
                      padding={4}
                      borderWidth="1px"
                      borderColor="gray.300"
                      width="full"
                      whiteSpace="pre-wrap"
                    >
                      <RenderInputOutput value={output.value} />
                    </Box>
                  ))}
                </VStack>
              )}
            </VStack>
          )}
        </HStack>
      ) : spans.isError ? (
        <Alert status="error">
          <AlertIcon />
          An error has occurred trying to load the trace spans
        </Alert>
      ) : (
        <VStack gap={4} width="full" padding={4}>
          <Skeleton width="full" height="20px" />
          <Skeleton width="full" height="20px" />
          <Skeleton width="full" height="20px" />
        </VStack>
      )}
    </VStack>
  );
}
