import {
  Avatar,
  Box,
  Container,
  HStack,
  Heading,
  Skeleton,
  SkeletonCircle,
  Slide,
  Spacer,
  Spinner,
  Text,
  Tooltip,
  VStack,
  useBreakpointValue,
} from "@chakra-ui/react";
import { format, formatDistanceToNow } from "date-fns";
import ErrorPage from "next/error";
import { useRouter } from "next/router";
import React, {
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import Markdown from "react-markdown";
import { DashboardLayout } from "../../../../components/DashboardLayout";
import { SpanTree } from "../../../../components/traces/SpanTree";
import { TraceSummary } from "../../../../components/traces/Summary";
import { useOrganizationTeamProject } from "../../../../hooks/useOrganizationTeamProject";
import { useTraceDetailsState } from "../../../../hooks/useTraceDetailsState";
import type { Trace } from "../../../../server/tracer/types";
import { api } from "../../../../utils/api";
import { isNotFound } from "../../../../utils/trpcError";
import { TeamRoleGroup } from "../../../../server/api/permission";

export default function TraceDetails() {
  const router = useRouter();
  const { project, hasTeamPermission } = useOrganizationTeamProject();
  const { traceId, trace, openTab } = useTraceDetailsState();
  const [threadId, setThreadId] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (trace.data?.thread_id) {
      setThreadId(trace.data.thread_id);
    }
  }, [trace.data?.thread_id]);

  const [initialDelay, setInitialDelay] = useState<boolean>(false);
  const [isTabOpen, setTabOpen] = useState<boolean>(false);
  const drawerWidth = useBreakpointValue({
    base: "80%",
    lg: "70%",
    "2xl": "60%",
  });

  useEffect(() => {
    if (!hasTeamPermission(TeamRoleGroup.SPANS_DEBUG)) return;
    setTimeout(
      () => {
        const isOpen = (!!threadId || !!trace.data) && !!openTab;
        setTabOpen(isOpen);
        if (isOpen) setInitialDelay(true);
      },
      initialDelay ? 0 : 400
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!openTab, !!trace.data]);

  if (isNotFound(trace.error)) {
    return <ErrorPage statusCode={404} />;
  }

  return (
    <DashboardLayout backgroundColor="white">
      <VStack
        maxWidth="1600"
        paddingY={6}
        paddingX={12}
        alignSelf="flex-start"
        alignItems="flex-start"
        width="full"
        spacing={10}
      >
        <VStack spacing={6} alignItems="flex-start" width="full">
          <HStack
            gap={5}
            align={{ base: "start", md: "center" }}
            flexDirection={{ base: "column", md: "row" }}
          >
            <Heading as="h1">Message Details</Heading>
            <Text color="gray.400" fontFamily="mono">
              (ID: {traceId})
            </Text>
          </HStack>
        </VStack>
      </VStack>
      <Box
        alignSelf="flex-start"
        alignItems="flex-start"
        paddingX={12}
        width="100%"
        maxWidth={isTabOpen ? "2300" : "1600"}
      >
        <HStack
          align="start"
          width="full"
          spacing={0}
          border="1px solid"
          borderColor="gray.200"
          alignItems="stretch"
          height="100%"
        >
          <Box
            transition="all 0.3s ease-in-out"
            width={{
              base: isTabOpen ? "20%" : "full",
              lg: isTabOpen ? "30%" : "full",
              "2xl": isTabOpen ? "40%" : "full",
            }}
            height="100vh"
            maxHeight="100vh"
            overflowX="hidden"
            overflowY="auto"
            position="sticky"
            top={0}
            id="conversation-scroll-container"
            background={trace.data ? "gray.50" : "white"}
            paddingBottom="220px"
          >
            <Conversation threadId={threadId} />
          </Box>

          {isTabOpen && (
            <Slide
              transition={{ enter: { duration: 0.3, ease: "easeInOut" } }}
              direction="right"
              in={!!openTab}
              style={{ position: "static", minWidth: drawerWidth }}
            >
              <Box
                width="100%"
                height="100%"
                overflowY="hidden"
                paddingLeft="20px"
                marginLeft="-20px"
                position="relative"
              >
                <Box
                  position="absolute"
                  height="100%"
                  top="0"
                  left="0px"
                  width="40px"
                  cursor="e-resize"
                  zIndex={2}
                  onClick={() => {
                    void router.replace(
                      `/${project?.slug}/messages/${traceId}`
                    );
                  }}
                ></Box>
                <VStack
                  background="white"
                  maxWidth="1600px"
                  borderLeft="1px solid"
                  borderColor="gray.200"
                  height="100%"
                  boxShadow="2px 2px 20px rgba(0,0,0,.3)"
                >
                  <TraceSummary />
                  {openTab === "spans" && <SpanTree />}
                </VStack>
              </Box>
            </Slide>
          )}
        </HStack>
      </Box>
    </DashboardLayout>
  );
}

function Conversation({ threadId }: { threadId?: string }) {
  const { traceId, trace, openTab } = useTraceDetailsState();
  const { project } = useOrganizationTeamProject();

  const currentTraceRef = useRef<HTMLDivElement>(null);
  const threadTraces = api.traces.getTracesByThreadId.useQuery(
    {
      projectId: project?.id ?? "",
      threadId: threadId ?? "",
    },
    {
      enabled: !!project && !!threadId,
    }
  );

  useEffect(() => {
    if (threadTraces.data && threadTraces.data?.length > 0) {
      const container = document.getElementById(
        "conversation-scroll-container"
      )!;
      container.scrollTop = (currentTraceRef.current?.offsetTop ?? 0) - 56;
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!threadTraces.data]);

  return (
    <Box width="full" minWidth="800px">
      {!!threadId || trace.data ? (
        <VStack
          align="start"
          width="full"
          spacing={0}
          background="white"
          borderBottom="1px solid"
          borderColor="gray.200"
        >
          {threadId ? (
            threadTraces.data ? (
              threadTraces.data.map((trace) => (
                <TraceMessages
                  key={trace.trace_id}
                  trace={trace}
                  ref={trace.trace_id == traceId ? currentTraceRef : undefined}
                  highlighted={trace.trace_id == traceId && !!openTab}
                />
              ))
            ) : threadTraces.error ? (
              <Container maxWidth="800px" paddingTop={8} paddingBottom={4}>
                <Text color="red.500">
                  Something went wrong trying to load previous messages
                </Text>
              </Container>
            ) : (
              <Container
                maxWidth="800px"
                height="56px"
                paddingTop={4}
                paddingBottom={4}
              >
                <HStack spacing={3}>
                  <Spinner size="sm" />
                  <Text>Loading messages...</Text>
                </HStack>
              </Container>
            )
          ) : null}
          {!threadId && <Box height="56px" />}
          {trace.data && !threadTraces.data && (
            <TraceMessages trace={trace.data} highlighted={!!openTab} />
          )}
          {trace.data && !trace.data.thread_id && (
            <Container maxWidth="800px" padding={8}>
              <Text fontStyle="italic" color="gray.500">
                Pass the thread_id on your integration to capture and visualize
                the whole conversation or associated actions. Read more on our
                docs.
              </Text>
            </Container>
          )}
        </VStack>
      ) : trace.isLoading ? (
        <Container
          width="full"
          maxWidth="800px"
          background="white"
          paddingTop="20px"
          paddingBottom="30px"
        >
          <VStack gap="40px" width="full" align="start" paddingTop="56px">
            <Message
              author=""
              avatar={<SkeletonCircle minWidth="32px" minHeight="32px" />}
            >
              <VStack gap={4} width="full" align="start">
                <Skeleton width="600px" height="20px" />
                <Skeleton width="600px" height="20px" />
              </VStack>
            </Message>
            <Message
              author=""
              avatar={<SkeletonCircle minWidth="32px" minHeight="32px" />}
            >
              <VStack gap={4} width="full" align="start">
                <Skeleton width="600px" height="20px" />
                <Skeleton width="600px" height="20px" />
              </VStack>
            </Message>
          </VStack>
        </Container>
      ) : null}
    </Box>
  );
}

const TraceMessages = React.forwardRef(function TraceMessages(
  {
    trace,
    highlighted,
  }: {
    trace: Trace;
    highlighted?: boolean;
  },
  ref
) {
  const { project } = useOrganizationTeamProject();

  return (
    <VStack
      ref={ref as any}
      align="start"
      width="full"
      spacing={2}
      _first={{ paddingTop: 4 }}
      _last={{ paddingBottom: 0 }}
    >
      <Box
        width="full"
        borderY="1px solid"
        borderColor={highlighted ? "blue.500" : "white"}
        background={highlighted ? "blue.50" : "white"}
        _hover={{ background: highlighted ? "blue.50" : "gray.50" }}
      >
        <Container maxWidth="800px">
          <Message
            trace={trace}
            author="Input"
            avatar={<Avatar size="sm" />}
            timestamp={trace.timestamps.started_at}
            paddingTop="20px"
          >
            <Text paddingY="6px" marginBottom="38px">
              {trace.input.value}
            </Text>
          </Message>
          <Message
            trace={trace}
            author={project?.name ?? ""}
            avatar={
              <Avatar size="sm" name={project?.name} background="orange.400" />
            }
            timestamp={trace.timestamps.inserted_at}
          >
            <Markdown className="markdown markdown-conversation-history">
              {trace.error ? trace.error.message : trace.output?.value}
            </Markdown>
          </Message>
        </Container>
      </Box>
    </VStack>
  );
});

function Message({
  trace,
  author,
  avatar,
  timestamp,
  paddingTop,
  children,
}: PropsWithChildren<{
  trace?: Trace;
  author: string;
  avatar: React.ReactNode;
  timestamp?: number;
  paddingTop?: string;
}>) {
  const router = useRouter();
  const { project } = useOrganizationTeamProject();
  const { traceId, openTab } = useTraceDetailsState();

  // show time ago if less than a day old
  const timestampDate = timestamp ? new Date(timestamp) : undefined;
  const timeAgo = timestampDate
    ? timestampDate.getTime() < Date.now() - 1000 * 60 * 60 * 24
      ? format(timestampDate, "dd/MMM HH:mm")
      : formatDistanceToNow(timestampDate, {
          addSuffix: true,
        })
    : undefined;

  if (!project) return null;

  return (
    <HStack
      width="full"
      paddingTop={paddingTop}
      align="start"
      spacing={3}
      cursor="pointer"
      role="button"
      onClick={() => {
        if (!trace) return;
        if (openTab && traceId === trace.trace_id) {
          void router.replace(`/${project.slug}/messages/${trace.trace_id}`);
        } else {
          void router.push(`/${project.slug}/messages/${trace.trace_id}/spans`);
        }
      }}
    >
      {avatar}
      <VStack align="start" spacing={0} width="full" className="content-hover">
        <HStack width="full">
          <Text fontWeight="bold">{author}</Text>
          <Spacer />
          {timestampDate && timeAgo && (
            <Tooltip label={timestampDate.toLocaleString()}>
              <Text color="gray.400">{timeAgo}</Text>
            </Tooltip>
          )}
        </HStack>
        {children}
      </VStack>
    </HStack>
  );
}
