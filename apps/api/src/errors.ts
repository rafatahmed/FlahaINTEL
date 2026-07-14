import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: Array<{ field: string; message: string }>;
  };
}

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: ApiErrorBody["error"]["details"],
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function apiErrorBody(
  code: string,
  message: string,
  details?: ApiErrorBody["error"]["details"],
): ApiErrorBody {
  return { error: { code, message, ...(details?.length ? { details } : {}) } };
}

export const errorResponse = apiErrorBody;

function validationDetails(error: FastifyError) {
  return error.validation?.map((issue) => ({
    field: issue.instancePath || issue.params.missingProperty?.toString() || "request",
    message: issue.message ?? "Invalid value",
  }));
}

export function apiErrorHandler(error: FastifyError, request: FastifyRequest, reply: FastifyReply) {
  if (error.validation) {
    return reply.code(400).send(apiErrorBody(
      "VALIDATION_ERROR",
      "Request validation failed.",
      validationDetails(error),
    ));
  }

  if (error instanceof AppError) {
    if (error.statusCode >= 500) request.log.error(error);
    return reply.code(error.statusCode).send(apiErrorBody(error.code, error.message, error.details));
  }

  if (error.code === "FST_ERR_CTP_INVALID_MEDIA_TYPE" || error.code === "FST_ERR_CTP_EMPTY_JSON_BODY") {
    return reply.code(415).send(apiErrorBody(
      "UNSUPPORTED_MEDIA_TYPE",
      "Requests with a body must use valid JSON.",
    ));
  }

  request.log.error(error);
  return reply.code(500).send(apiErrorBody("INTERNAL_ERROR", "Internal server error."));
}
